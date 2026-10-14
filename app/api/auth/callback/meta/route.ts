import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { encryptToken } from '@/lib/encryption';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { withUserContext } from '@/lib/prisma';
import type { MetaConnectionStatus } from '@/integrations/meta/types';

// OAuth Meta callback — arquitetura existente respeitada
// META_APP_SECRET: NUNCA exposto no código/cliente/Git

// Timing-safe state comparison
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Erros explícitos — sem stack trace
  if (error) return redirectError(req, 'oauth_error', error);
  if (!state) return redirectError(req, 'state_missing');
  if (!code) return redirectError(req, 'code_missing');

  // State CSRF protection
  const sessionState = req.cookies.get('oauth_state')?.value ?? '';
  if (!sessionState || !secureCompare(state, sessionState)) {
    return redirectError(req, 'state_invalid');
  }

  // Autenticação robusta: validação via Supabase Auth (anon key → RLS sujeito)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectError(req, 'not_authenticated');
  }

  // Buscar membership do usuário no banco para validar a organização.
  // Wrapped in withUserContext so the "User_self" RLS policy is satisfied.
  // (Currently BYPASSRLS ignores this, but future-proof for role migration.)
  const dbUser = await withUserContext(user.id, async (tx) =>
    tx.user.findUnique({
      where: { id: user.id },
      include: { organizationMembers: true },
    })
  );

  if (!dbUser || dbUser.organizationMembers.length === 0) {
    return redirectError(req, 'not_authenticated');
  }

  // Usa a primeira (primary) organização do usuário
  const organizationId = dbUser.organizationMembers[0].organizationId;

  // Token exchange — servidor, META_APP_ID/SECRET do .env.local
  // NUNCA expor token na response/redirect
  let metaToken: string;
  let expiresIn = 0;
  let pageId = '';
  let instagramId = '';

  try {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) return redirectError(req, 'config_missing');

    const tokenRes = await fetch(
      `https://graph.facebook.com/v26.0/oauth/access_token?` +
      `client_id=${appId}&client_secret=${appSecret}&code=${code}&` +
      `redirect_uri=${encodeURIComponent(`${req.nextUrl.origin}/api/auth/callback/meta`)}`,
      { method: 'POST' }
    );

    if (!tokenRes.ok) {
      const err = await tokenRes.json().catch(() => ({}));
      console.error('[meta-oauth] token exchange failed:', err);
      return redirectError(req, 'token_exchange_failed');
    }

    const tokenData = await tokenRes.json() as { access_token: string; expires_in?: number };
    metaToken = tokenData.access_token;
    expiresIn = tokenData.expires_in ?? 0;

    // Buscar Facebook Page
    const pagesRes = await fetch(
      `https://graph.facebook.com/v26.0/me/accounts?access_token=${metaToken}`
    );
    if (pagesRes.ok) {
      const pages = await pagesRes.json() as { data: Array<{ id: string; name: string }> };
      pageId = pages.data?.[0]?.id ?? '';
    }

    // Buscar Instagram Business Account (se page existe)
    if (pageId) {
      const igRes = await fetch(
        `https://graph.facebook.com/v26.0/${pageId}?fields=instagram_business_account&access_token=${metaToken}`
      );
      if (igRes.ok) {
        const ig = await igRes.json() as { instagram_business_account?: { id: string } };
        instagramId = ig.instagram_business_account?.id ?? '';
      }
    }
  } catch (err) {
    console.error('[meta-oauth] token exchange error:', err);
    return redirectError(req, 'token_exchange_failed');
  }

  // Criptografar token antes de persistir
  let encryptedToken: string;
  try {
    encryptedToken = encryptToken(metaToken);
  } catch {
    return redirectError(req, 'encryption_failed');
  }

  // Persistir integração no banco via service_role (único caminho que precisa de privileged access)
  try {
    const serviceSupabase = createServiceRoleClient();
    const expiresAt = expiresIn > 0
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null;

    const { error: upsertErr } = await serviceSupabase
      .from('meta_integrations')
      .upsert(
        {
          organization_id: organizationId,
          provider: 'facebook',
          meta_page_id: pageId || null,
          instagram_account_id: instagramId || null,
          meta_app_id: process.env.META_APP_ID ?? null,
          encrypted_access_token: encryptedToken,
          token_expires_at: expiresAt,
          status: 'CONNECTED' as MetaConnectionStatus,
          connected_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,provider' }
      );

    if (upsertErr) {
      console.error('[meta-oauth] db error:', upsertErr);
      return redirectError(req, 'db_error');
    }
  } catch (err) {
    console.error('[meta-oauth] db error:', err);
    return redirectError(req, 'db_error');
  }

  // Token nunca em log/redirect
  return NextResponse.redirect(new URL('/onboarding/success', req.url));
}

function redirectError(req: NextRequest, reason: string, detail?: string) {
  const url = new URL('/onboarding/error', req.url);
  url.searchParams.set('reason', reason);
  if (detail) url.searchParams.set('detail', detail);
  return NextResponse.redirect(url);
}
