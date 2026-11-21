import { NextResponse } from "next/server";

const BASE = process.env.OPENBSP_BASE_URL ?? "https://nheelwshzbgenpavwhcy.supabase.co";
const PUB = process.env.OPENBSP_PUBLISHABLE_KEY ?? "sb_publishable_jS_LQSbttNz2nRyAcjOVUw_J1KpXhUd";
const SEC = process.env.OPENBSP_SECRET_KEY ?? "sk_dcca9cc0057142ce95bba1e051b01699";
const ORG = process.env.OPENBSP_ORG_ID ?? "9d7114cd-013e-4e03-b91d-848518bf6514";

async function ler(path: string) {
  const r = await fetch(`${BASE}/rest/v1/${path}`, {
    headers: { apikey: PUB, "api-key": SEC },
    cache: "no-store",
  });
  const t = await r.text();
  try {
    return JSON.parse(t);
  } catch {
    return { erro: r.status, corpo: t };
  }
}

export async function GET() {
  const [logs, enderecos] = await Promise.all([
    ler(`logs?select=created_at,level,message,metadata&organization_id=eq.${ORG}&category=eq.signup&order=created_at.desc&limit=15`),
    ler(`organizations_addresses?select=address,status,issue,updated_at&organization_id=eq.${ORG}`),
  ]);

  return NextResponse.json({ logs, enderecos }, { headers: { "cache-control": "no-store" } });
}
