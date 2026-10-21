// FASE 3 · slice 1 — Tracking de ANÚNCIOS em tempo real: Meta Ad Manager
// (Marketing API) — insights da conta de anúncios do tenant.
//
// GET /api/meta/ads-insights?timeRange=last_7d
//   → { ok, adAccountId, timeRange, insights: [ { date?, spend?, impressions?,
//       clicks?, reach?, ctr?, cpc?, actionsCount? } ] }
//
// • O token vem da linha privilegiada `meta_integrations` (OAuth da Meta,
//   descriptografado); o ID da conta de anúncios fica em AgentMemory
//   (provider `meta_ads`). Pré-requisito: permissão `ads_read` no app da
//   Meta (sem ela, a API devolve erro de permissão → 502 com detalhe).
// • Degrada honestamente: 409 (não conectado / token ausente / sem ID da
//   conta), 503 (fila/memória indisponível), 502 (falha na API da Meta).
//
// O segredo (access token) vive SÓ no banco — nunca no front-end, nunca no
// corpo de erro.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMetaAdInsights, META_ADS_TIME_RANGES } from '@/integrations/meta/adsInsights';
import { resolveTenantMetaAdsAccess } from '@/integrations/meta/resolveAccess';

export const dynamic = 'force-dynamic';

const AD_ACCOUNT_DETAILS: Record<string, string | undefined> = {
  not_connected: 'Conexão Meta ausente. Conecte em /integrations (OAuth).',
  no_token: 'Token da Meta ausente. Reconecte em /integrations.',
  decrypt_failed: 'Falha ao descriptografar o token da Meta (credencial inválida).',
  no_ad_account: 'ID da Conta de Anúncios ausente. Preencha em /integrations (Meta Ads).',
  queue_unavailable: 'Memória de integrações indisponível (503) — tabela não migrada aqui.',
  account_not_found: 'Conta Meta não encontrada neste tenant (parâmetro `account` inválido).',
};

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const scope = { organizationId: user.organizationId, userId: user.id };

  const param = req.nextUrl.searchParams.get('timeRange');
  let timeRange = 'last_7d';
  if (param) {
    if ((META_ADS_TIME_RANGES as readonly string[]).includes(param)) {
      timeRange = param;
    } else {
      return NextResponse.json(
        {
          ok: false,
          error: 'bad_time_range',
          detail: `timeRange inválida — aceitos: ${META_ADS_TIME_RANGES.join(', ')}`,
        },
        { status: 400 },
      );
    }
  }

  // MULTICONTAS — `?account=rowId` ancora a conta; ausente → padrão.
  const account = req.nextUrl.searchParams.get('account')?.trim() || undefined;
  const resolved = await resolveTenantMetaAdsAccess(prisma, scope, {}, account);
  if (!resolved.ok) {
    const status = resolved.reason === 'queue_unavailable' ? 503 : 409;
    const detail = AD_ACCOUNT_DETAILS[resolved.reason];
    return NextResponse.json({ ok: false, error: resolved.reason, detail }, { status });
  }

  const result = await getMetaAdInsights(resolved.access, { timeRange });
  if (result.ok) {
    return NextResponse.json(
      { ok: true, adAccountId: result.adAccountId, timeRange, insights: result.insights },
      { status: 200 },
    );
  }
  return NextResponse.json(
    { ok: false, error: result.error, detail: result.errorDetail },
    { status: 502 },
  );
}
