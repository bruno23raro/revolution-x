// FASE 3 — Verificação de token do OpenBSP (WhatsApp oficial)
//
// POST /api/integrations/openbsp/refresh-token → { ok, tokenId, expiresIn? } | { error }
//
// O OpenBSP NÃO fornece refresh tokens como Meta/TikTok. O access_token é:
//   1. Gerado durante o onboarding e armazenado em organizations_addresses.extra.access_token
//   2. Renovado AUTOMATICAMENTE pelo OpenBSP enquanto o onboarding token não expirar
//   3. Acesso expirado quando: onboarding_token.status != 'used' OU onboarding token expirou
//
// Este endpoint verifica se o canal ainda tem acesso válido e renova o access_token
// em cache/local se necessário. NUNCA loga tokens. Degrada com códigos honestos:
//   • 409 not_connected / no_token              (nada para renovar)
//   • 409 token_expired                         (onboarding expirou, requer re-onboarding)
//   • 503 config_missing / queue_unavailable
//   • 502 fetch_failed                          (API do OpenBSP indisponível)
//
// Só admin/owner (mesmo gate do refresh Meta/TikTok).

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getAllOrganizationMemberships } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { openbspConfig, fetchConnectedAddress } from '@/integrations/whatsapp/openbsp/client';

export const dynamic = 'force-dynamic';

async function requireAdmin(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;
  if (user.role === 'admin' || user.role === 'owner') return user;
  const memberships = await getAllOrganizationMemberships(req);
  const ok = memberships?.some((m) => m.role === 'admin' || m.role === 'owner');
  return ok ? user : null;
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 1) verificar configuração OpenBSP
  const cfg = openbspConfig();
  if (!cfg) return NextResponse.json({ error: 'config_missing' }, { status: 503 });

  // 2) buscar canal conectado (único por tenant)
  const service = createServiceRoleClient();
  const { data: integrations } = await service
    .from('integrations')
    .select('id,user_id,meta:openbsp_onboarding_token_id,external_account_id,expires_at')
    .eq('user_id', user.organizationId)
    .eq('channel', 'whatsapp')
    .eq('status', 'connected')
    .eq('provider', 'openbsp');

  if (!integrations || integrations.length === 0) {
    return NextResponse.json({ error: 'not_connected' }, { status: 409 });
  }

  const integration = integrations[0] as {
    id: string;
    user_id: string;
    meta: Record<string, unknown> | null;
    external_account_id: string | null;
    expires_at: string | null;
  };

  // 3) verificar se o token já expirou localmente
  if (integration.expires_at) {
    const expired = new Date(integration.expires_at) < new Date();
    if (expired) {
      return NextResponse.json({ error: 'token_expired', detail: 'onboarding expirou' }, { status: 409 });
    }
  }

  const tokenId = integration.meta?.openbsp_onboarding_token_id as string | null;
  if (!tokenId) {
    return NextResponse.json({ error: 'no_token' }, { status: 409 });
  }

  // 4) buscar endereço conectado do OpenBSP para verificação do token
  const addressRes = await fetchConnectedAddress(tokenId, { fetchImpl: fetch });
  if (!addressRes.ok) {
    return NextResponse.json({ error: 'fetch_failed', detail: addressRes.errorDetail }, { status: 502 });
  }

  const address = addressRes.data;
  if (!address) {
    return NextResponse.json({ error: 'not_connected', detail: 'sem linha conectada no provedor' }, { status: 409 });
  }

  // 5) verificar se o token ainda é válido (OpenBSP pode ter revogado)
  if (!address.extra?.access_token) {
    return NextResponse.json({ error: 'token_revoked', detail: 'access_token ausente no provedor' }, { status: 409 });
  }

  // 6) atualizar access_token em cache (OpenBSP renovou automaticamente)
  const newExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 dias

  const { error } = await service
    .from('integrations')
    .update({
      external_account_id: address.extra.waba_id ?? null,
      access_token: address.extra.access_token,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', integration.id);

  if (error) {
    console.error('[openbsp-refresh] erro ao atualizar:', error.message);
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tokenId, expiresIn: 60 * 24 * 60 * 60 }, { status: 200 });
}