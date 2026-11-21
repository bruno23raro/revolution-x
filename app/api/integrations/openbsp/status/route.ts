import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptToken } from "@/lib/encryption";
import { fetchConnectedAddress } from "@/integrations/whatsapp/openbsp/client";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let canal: {
    verifyToken: string | null;
    status: string | null;
    callbackUrl: string | null;
    phoneNumberId: string | null;
  } | null = null;

  try {
    canal = await prisma.whatsappChannel.findUnique({
      where: { organizationId: user.organizationId },
      select: {
        verifyToken: true,
        status: true,
        callbackUrl: true,
        phoneNumberId: true,
      },
    });
  } catch {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const orgBsp = (process.env.OPENBSP_ORG_ID ?? "").trim();
  if (!orgBsp)
    return NextResponse.json({
      status: "error",
      reason: "openbsp_not_configured",
    });

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? "https://revolutionx.com.br"
  ).trim();
  const base = (process.env.OPENBSP_BASE_URL ?? "").trim();
  if (
    !base ||
    !process.env.OPENBSP_PUBLISHABLE_KEY ||
    !process.env.OPENBSP_API_KEY
  ) {
    return NextResponse.json({
      status: "error",
      reason: "openbsp_not_configured",
    });
  }

  const callbackUrl =
    canal?.callbackUrl ??
    `${appUrl}/api/integrations/openbsp/incoming?org=${user.organizationId}`;

  const r = await fetchConnectedAddress(
    canal?.verifyToken ?? "",
    { timeoutMs: 10_000 },
    callbackUrl,
  );

  // 2.1) org_divergente: se o endereço veio de outra org, rejeitar
  if (
    r.ok &&
    r.data &&
    r.data.organization_id &&
    r.data.organization_id !== orgBsp
  ) {
    try {
      await prisma.whatsappChannel.update({
        where: { organizationId: user.organizationId },
        data: { lastError: "org_divergente" },
      });
    } catch {}
    return NextResponse.json({ status: "pending", reason: "org_divergente" });
  }

  // 2.2) matchedBy: precisa provar por que casou
  if (r.ok && r.data && !r.matchedBy) {
    return NextResponse.json({
      status: "pending",
      reason: "endereco_sem_casamento",
    });
  }

  // 2.3) endereco_divergente: se o canal tem phoneNumberId e o endereço bateu diferente
  if (
    r.ok &&
    r.data &&
    canal?.phoneNumberId &&
    r.data.address !== canal.phoneNumberId
  ) {
    try {
      await prisma.whatsappChannel.update({
        where: { organizationId: user.organizationId },
        data: { lastError: "endereco_divergente" },
      });
    } catch {}
    return NextResponse.json({
      status: "pending",
      reason: "endereco_divergente",
    });
  }

  if (r.ok && r.data) {
    const e = r.data;
    const token = e.extra?.access_token ?? null;

    try {
      await prisma.whatsappChannel.update({
        where: { organizationId: user.organizationId },
        data: {
          provider: "openbsp",
          status: "CONNECTED",
          phoneNumberId: e.address,
          wabaId: e.extra?.waba_id ?? null,
          phoneNumber: e.extra?.phone_number ?? null,
          verifiedName: e.extra?.verified_name ?? null,
          accessTokenEnc: token ? await encryptToken(token) : null,
          callbackUrl,
          lastError: null,
        },
      });
    } catch {
      /* o provedor continua sendo a verdade */
    }

    return NextResponse.json({
      status: "connected",
      wabaId: e.extra?.waba_id ?? null,
      phoneNumberId: e.address,
      phone: e.extra?.phone_number ?? null,
      displayName: e.extra?.verified_name ?? null,
      callback_url: e.extra?.callback_url ?? null,
    });
  }

  // 6) network_error/http_error -> pending, nunca error
  const detalhe = r.errorDetail ?? r.error ?? "desconhecido";
  if (canal?.status === "CONNECTED" && canal?.phoneNumberId) {
    return NextResponse.json({ status: "connected", reason: detalhe });
  }
  return NextResponse.json({ status: "pending", reason: detalhe });
}
