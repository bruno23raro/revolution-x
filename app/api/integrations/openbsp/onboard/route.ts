import { NextResponse } from "next/server";

const BASE =
  process.env.OPENBSP_BASE_URL ?? "https://nheelwshzbgenpavwhcy.supabase.co";
const PUB =
  process.env.OPENBSP_PUBLISHABLE_KEY ??
  "sb_publishable_jS_LQSbttNz2nRyAcjOVUw_J1KpXhUd";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const r = await fetch(`${BASE}/functions/v1/whatsapp-management/onboard`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PUB}`,
      apikey: PUB,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await r.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  return NextResponse.json(
    {
      ok: r.ok,
      status: r.status,
      message: (json?.message as string) ?? (r.ok ? "conectado" : "falha"),
      cause: json?.cause ?? null,
      address: json?.address ?? null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
