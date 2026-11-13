// FASE 2 · slice 4 — Refresh do access token do TikTok (Content Posting API).
//
// POST /api/integrations/tiktok/refresh-token → { ok, expiresIn? } | { error }
//
// Usa o refresh_token persistido no AgentMemory (provider `tiktok`, somente
// quando o tenant conectou via OAuth). Troca via `/v2/oauth/token/` (servidor,
// client_secret só no .env), re-cifra o novo access_token (AES-256-GCM) e
// persiste de volta. Nunca loga tokens. Degrada com códigos honestos:
//   • 409 not_connected / no_refresh_token  (nada para renovar)
//   • 503 config_missing / queue_unavailable / encryption_failed
//   • 502 refresh_failed                     (API do TikTok rejeitou)
//
// Só admin/owner (mesmo gate do refresh Meta).

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getAllOrganizationMemberships } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encryptToken } from '@/lib/encryption';
import { TaskQueueUnavailableError } from '@/lib/taskQueue';
import { resolveTenantTikTokAccess, saveTikTokOAuthTokens } from '@/integrations/tiktok/resolveAccess';
import { refreshTikTokToken, TikTokOAuthError } from '@/integrations/tiktok/auth/oauth';

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

  const scope = { organizationId: user.organizationId, userId: user.id };

  // MULTICONTAS — corpo opcional { account } (openId) seleciona a conta a
  // renovar; ausente/'default' renova a conta padrão (mais recente).
  let account = '';
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (body && typeof body.account === 'string') account = body.account.trim();
  } catch {
    /* corpo ausente/inválido → renovam a conta padrão */
  }

  // 1) estado atual (resolver AgentMemory; decrypt do access salvo)
  const resolved = await resolveTenantTikTokAccess(prisma, scope, account || undefined);
  if (!resolved.ok) {
    const status =
      resolved.reason === 'not_connected' || resolved.reason === 'account_not_found' ? 409 : 503;
    return NextResponse.json({ error: resolved.reason }, { status });
  }

  // Só dá pra renovar via OAuth (refresh_token). Cadastro manual não tem.
  const oauth = resolved.oauth;
  if (!oauth || !oauth.refreshToken) {
    return NextResponse.json({ error: 'no_refresh_token' }, { status: 409 });
  }

  // 2) credenciais da app TikTok (env do host). Ausentes → degrada honesto.
  const clientKey = process.env.TIKTOK_CLIENT_KEY ?? '';
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET ?? '';
  if (!clientKey || !clientSecret) {
    return NextResponse.json({ error: 'config_missing' }, { status: 503 });
  }

  // 3) renova o access_token com o refresh_token (sem interação do usuário)
  let tokens;
  try {
    tokens = await refreshTikTokToken({ clientKey, clientSecret, redirectUri: '' }, oauth.refreshToken);
  } catch (e) {
    const detail = e instanceof TikTokOAuthError ? e.code : 'refresh_failed';
    console.error('[tiktok-oauth] refresh failed:', detail);
    return NextResponse.json({ error: 'refresh_failed', detail }, { status: 502 });
  }

  // MULTICONTAS — o endpoint de refresh pode não devolver open_id; preserva a
  // identidade da conta resolvida para atualizar a entrada correta (sem
  // criar um registro órfao com openId vazio).
  if (!tokens.openId && resolved.selectedAccount?.openId) {
    tokens.openId = resolved.selectedAccount.openId;
  }

  // 4) re-criptografa e persiste (mesmo key `integration:tiktok`)
  let encrypted: string;
  try {
    encrypted = encryptToken(tokens.accessToken);
  } catch {
    return NextResponse.json({ error: 'encryption_failed' }, { status: 503 });
  }

  try {
    await saveTikTokOAuthTokens(prisma, scope, tokens, encrypted);
  } catch (e) {
    if (e instanceof TaskQueueUnavailableError) {
      return NextResponse.json({ error: 'queue_unavailable' }, { status: 503 });
    }
    console.error('[tiktok-oauth] persist failed:', (e as Error).message);
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, expiresIn: tokens.expiresIn }, { status: 200 });
}
