import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const limpa = (v?: string) => (v ?? "").replace(/^\uFEFF/, "").trim();

const PUB = limpa(process.env.OPENBSP_PUBLISHABLE_KEY) || "sb_publishable_jS_LQSbttNz2nRyAcjOVUw_J1KpXhUd";
const KEY = limpa(process.env.OPENBSP_API_KEY) || limpa(process.env.OPENBSP_SECRET_KEY) || "sk_dcca9cc0057142ce95bba1e051b01699";
const ORG = limpa(process.env.OPENBSP_ORG_ID) || "9d7114cd-013e-4e03-b91d-848518bf6514";
const BASE = (limpa(process.env.OPENBSP_BASE_URL) || "https://nheelwshzbgenpavwhcy.supabase.co").replace(/\/+$/, "");

async function ler(caminho: string) {
  try {
    const r = await fetch(`${BASE}/rest/v1/${caminho}`, {
      headers: { apikey: PUB, "api-key": KEY },
      cache: "no-store",
    });
    const t = await r.text();
    if (!r.ok) return { status: r.status, corpo: t.slice(0, 300) };
    return { status: r.status, dados: JSON.parse(t) };
  } catch (e) {
    return { status: 0, corpo: String(e) };
  }
}

export async function GET() {
  const [logs, enderecos, tokens] = await Promise.all([
    ler(`logs?select=created_at,level,message,metadata&organization_id=eq.${ORG}&category=eq.signup&order=created_at.desc&limit=15`),
    ler(`organizations_addresses?select=address,status,issue,extra,updated_at&organization_id=eq.${ORG}`),
    ler(`onboarding_tokens?select=id,status,callback_url,verify_token,created_at,expires_at&organization_id=eq.${ORG}&order=created_at.desc&limit=3`),
  ]);

  return NextResponse.json({ logs, enderecos, tokens }, { headers: { "cache-control": "no-store" } });
}