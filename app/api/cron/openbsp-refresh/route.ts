// FASE 3 — Cron de verificação de token OpenBSP
//
// POST /api/cron/openbsp-refresh → { ok, checked, errors }
//
// Verifica periodicamente se os tokens OpenBSP ainda são válidos.
// O OpenBSP NÃO fornece refresh tokens - o access_token é renovado automaticamente.
// Apenas verifica se há acesso válido no provedor.
//
// Protegido por `CRON_SECRET` (comparacao em tempo constante).
//
// Configuração no hPanel:
//   Hostinger → Websites → revolutionx.com.br → Cron Jobs
//   Período: Every 24 hours
//   Comando: curl -fsS -X POST -H "x-cron-secret: <SEGREDO>" https://revolutionx.com.br/api/cron/openbsp-refresh >/dev/null

import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { openbspConfig, fetchConnectedAddress } from '@/integrations/whatsapp/openbsp/client';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface ChannelData {
  id: string;
  user_id: string;
  meta: Record<string, unknown> | null;
  expires_at: string | null;
}

async function checkChannelToken(
  client: ReturnType<typeof createServiceRoleClient>,
  channel: ChannelData,
  cfg: ReturnType<typeof openbspConfig>,
): Promise<{ ok: boolean; reason?: string; refreshed: boolean }> {
  // Verificar se o token já expirou localmente
  if (channel.expires_at) {
    const expired = new Date(channel.expires_at) < new Date();
    if (expired) {
      return { ok: false, reason: 'token_expired', refreshed: false };
    }
  }

  const tokenId = channel.meta?.openbsp_onboarding_token_id as string | null;
  if (!tokenId) {
    return { ok: false, reason: 'no_token', refreshed: false };
  }

  // Verificar status no provedor OpenBSP
  const addressRes = await fetchConnectedAddress(tokenId, { fetchImpl: fetch });
  if (!addressRes.ok) {
    return { ok: false, reason: addressRes.error ?? 'fetch_failed', refreshed: false };
  }

  const address = addressRes.data;
  if (!address?.extra?.access_token) {
    return { ok: false, reason: 'no_access_token', refreshed: false };
  }

  // Atualizar access_token em cache (OpenBSP mantém token válido)
  const newExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await client
    .from('integrations')
    .update({
      external_account_id: address.extra.waba_id ?? null,
      access_token: address.extra.access_token,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', channel.id);

  if (error) {
    console.error(`[cron-openbsp-refresh] erro ao atualizar canal ${channel.id}:`, error.message);
    return { ok: false, reason: 'db_update_failed', refreshed: false };
  }

  return { ok: true, reason: undefined, refreshed: true };
}

export async function POST(req: NextRequest) {
  // 1) validar cron secret
  const expected = process.env.CRON_SECRET;
  if (!expected || expected.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'cron_not_configured', detail: 'CRON_SECRET ausente no ambiente' },
      { status: 503 },
    );
  }

  const provided = req.headers.get('x-cron-secret');
  const a = Buffer.from(provided ?? '', 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized', detail: 'x-cron-secret ausente ou inválido' },
      { status: 401 },
    );
  }

  // 2) verificar configuração OpenBSP
  const cfg = openbspConfig();
  if (!cfg) {
    return NextResponse.json({ ok: false, error: 'config_missing' }, { status: 503 });
  }

  // 3) buscar todos os canais WhatsApp conectados via OpenBSP
  const client = createServiceRoleClient();
  const { data: channels, error: listError } = await client
    .from('integrations')
    .select('id,user_id,meta,expires_at')
    .eq('channel', 'whatsapp')
    .eq('status', 'connected')
    .eq('provider', 'openbsp');

  if (listError) {
    console.error('[cron-openbsp-refresh] erro ao listar canais:', listError.message);
    return NextResponse.json({ ok: false, error: 'db_list_failed', detail: listError.message }, { status: 500 });
  }

  if (!channels || channels.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, errors: [] });
  }

  // 4) verificar status de token para cada canal
  let checked = 0;
  let errors: string[] = [];

  for (const channel of channels as ChannelData[]) {
    try {
      const result = await checkChannelToken(client, channel, cfg);
      checked += 1;
      if (!result.ok && result.reason) {
        errors.push(`Channel ${channel.id.slice(0, 8)}: ${result.reason}`);
      }
    } catch (e) {
      checked += 1;
      errors.push(`Channel ${channel.id.slice(0, 8)}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    checked,
    errors: errors.length > 0 ? errors : undefined,
  });
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: 'method_not_allowed', detail: 'use POST /api/cron/openbsp-refresh com x-cron-secret' },
    { status: 405 },
  );
}