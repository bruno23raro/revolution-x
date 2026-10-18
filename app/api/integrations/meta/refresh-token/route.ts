// FASE 1 — Refresh (troca) do access token da Meta.
// Troca o token salvo (descriptografado) via `fb_exchange_token` e persiste o
// novo (re-criptografado). Nunca loga tokens. Degrada com códigos honestos.
//
//   POST /api/integrations/meta/refresh-token → { ok, expiresIn? } | { error }

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getAllOrganizationMemberships } from '@/lib/auth';
import { encryptToken } from '@/lib/encryption';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { resolveTenantMetaAccess } from '@/integrations/meta/resolveAccess';
import { refreshMetaAccessToken } from '@/integrations/meta/tokenRefresh';

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

  // 1) token atual (service_role + decrypt)
  const resolved = await resolveTenantMetaAccess(user.organizationId);
  if (!resolved.ok) {
    const status = resolved.reason === 'not_connected' ? 409 : 503;
    return NextResponse.json({ error: resolved.reason }, { status });
  }

  // 2) credenciais da app Meta (env do host)
  const appId = process.env.META_APP_ID ?? '';
  const appSecret = process.env.META_APP_SECRET ?? '';
  const refresh = await refreshMetaAccessToken(
    { appId, appSecret },
    resolved.access.accessToken,
  );
  if (!refresh.ok || !refresh.accessToken) {
    return NextResponse.json(
      { error: refresh.error ?? 'refresh_failed', detail: refresh.errorDetail },
      { status: 502 },
    );
  }

  // 3) re-criptografa e persiste a linha lida
  let encrypted: string;
  try {
    encrypted = encryptToken(refresh.accessToken);
  } catch {
    return NextResponse.json({ error: 'encryption_failed' }, { status: 503 });
  }

  try {
    const service = createServiceRoleClient();
    const payload: Record<string, unknown> = {
      encrypted_access_token: encrypted,
      status: 'CONNECTED',
    };
    if (refresh.expiresIn && refresh.expiresIn > 0) {
      payload.token_expires_at = new Date(Date.now() + refresh.expiresIn * 1000).toISOString();
    }
    const q = service.from('meta_integrations').update(payload);
    const finished = resolved.row.id ? await q.eq('id', resolved.row.id) : await q.eq('organization_id', user.organizationId).eq('provider', resolved.row.provider ?? 'facebook');
    if (finished.error) {
      return NextResponse.json({ error: 'db_error' }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, expiresIn: refresh.expiresIn ?? 0 }, { status: 200 });
}
