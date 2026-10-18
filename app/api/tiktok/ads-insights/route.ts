// FASE 3 · slice 1 — Tracking de ANÚNCIOS do TikTok em tempo real via
// TikTok Business API (BAP) — relatórios do Gerenciador de Anúncios.
//
// GET /api/tiktok/ads-insights?date=2026-10-17&entity=AD_GROUP
//   → { ok, advertiserId, entity, date, rows: [ { …métricas por dia } ] }
//
// • Credencial em AgentMemory (provider `tiktok_ads`: Advertiser ID +
//   Access Token de Business) — o token BAP é distinto do token de usuário
//   do Content Posting API. Degrada honestamente: 409 (não conectado /
//   sem token / sem Advertiser ID), 503 (fila/memória indisponível),
//   502 (falha na API do TikTok).
// • `date` é um único dia (grão DAILY), `entity` escolha o nível de
//   agrupamento (default `AD_GROUP`).
//
// O segredo (access token) vive SÓ no banco — nunca no front-end, nunca no
// corpo de erro.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getTikTokAdsInsights,
  isValidTikTokAdsDate,
  TIKTOK_ADS_ENTITIES,
  type TikTokAdsEntity,
} from '@/integrations/tiktok/adsAnalytics';
import { resolveTenantTikTokAdsAccess } from '@/integrations/tiktok/resolveAccess';

export const dynamic = 'force-dynamic';

const ADVERTISER_DETAILS: Record<string, string | undefined> = {
  not_connected: 'Provedor TikTok Ads não conectado. Preencha em /integrations (TikTok Ads).',
  no_token: 'Access Token de Business (BAP) ausente. Conecte em /integrations.',
  no_advertiser: 'Advertiser ID ausente. Preencha em /integrations (TikTok Ads).',
  queue_unavailable: 'Memória de integrações indisponível (503) — tabela não migrada aqui.',
};

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const scope = { organizationId: user.organizationId, userId: user.id };

  const dateParam = req.nextUrl.searchParams.get('date');
  let date = 'yesterday';
  if (dateParam) {
    if (!isValidTikTokAdsDate(dateParam)) {
      return NextResponse.json(
        { ok: false, error: 'bad_date', detail: 'date inválida — use YYYY-MM-DD' },
        { status: 400 },
      );
    }
    date = dateParam;
  }

  const entityParam = req.nextUrl.searchParams.get('entity');
  let entity: TikTokAdsEntity = 'AD_GROUP';
  if (entityParam) {
    if (!(TIKTOK_ADS_ENTITIES as readonly string[]).includes(entityParam)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'bad_entity',
          detail: `entity inválida — aceitos: ${TIKTOK_ADS_ENTITIES.join(', ')}`,
        },
        { status: 400 },
      );
    }
    entity = entityParam as TikTokAdsEntity;
  }

  const resolved = await resolveTenantTikTokAdsAccess(prisma, scope);
  if (!resolved.ok) {
    const status = resolved.reason === 'queue_unavailable' ? 503 : 409;
    const detail = ADVERTISER_DETAILS[resolved.reason];
    return NextResponse.json({ ok: false, error: resolved.reason, detail }, { status });
  }

  const result = await getTikTokAdsInsights(resolved.access, { date, entity });
  if (result.ok) {
    return NextResponse.json(
      {
        ok: true,
        advertiserId: result.advertiserId,
        entity: result.entity,
        date: result.date,
        rows: result.rows,
      },
      { status: 200 },
    );
  }
  return NextResponse.json(
    { ok: false, error: result.error, detail: result.errorDetail },
    { status: 502 },
  );
}
