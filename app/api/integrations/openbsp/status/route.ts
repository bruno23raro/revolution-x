import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fetchConnectedAddress } from '@/integrations/whatsapp/openbsp/client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let canal: { verifyToken: string | null; status: string | null; callbackUrl: string | null } | null = null;
  try {
    canal = await prisma.whatsappChannel.findUnique({
      where: { organizationId: user.organizationId },
      select: { verifyToken: true, status: true, callbackUrl: true },
    });
  } catch {
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://revolutionx.com.br').trim();
  const base = (process.env.OPENBSP_BASE_URL ?? '').trim();
  if (!base || !process.env.OPENBSP_PUBLISHABLE_KEY || !process.env.OPENBSP_API_KEY) {
    return NextResponse.json({ status: 'error', reason: 'openbsp_not_configured' });
  }

  const callbackUrl =
    canal?.callbackUrl ??
    `${appUrl}/api/integrations/openbsp/incoming?org=${user.organizationId}`;

  const r = await fetchConnectedAddress(canal?.verifyToken ?? '', { timeoutMs: 10_000 }, callbackUrl);

  if (r.ok && r.data) {
    const endereco = r.data;

    try {
      await prisma.whatsappChannel.update({
        where: { organizationId: user.organizationId },
        data: { status: 'CONNECTED' },
      });
    } catch {
      /* o status do provedor continua sendo a verdade */
    }

    return NextResponse.json({
      status: 'connected',
      wabaId: endereco.extra?.waba_id ?? null,
      phoneNumberId: endereco.address ?? null,
      displayName: endereco.extra?.verified_name ?? null,
      callback_url: endereco.extra?.callback_url ?? null,
    });
  }

  const detalhe = r.errorDetail ?? r.error ?? 'desconhecido';
  if (canal?.status === 'CONNECTED') {
    return NextResponse.json({ status: 'connected', reason: detalhe });
  }
  return NextResponse.json({ status: 'pending', reason: detalhe });
}