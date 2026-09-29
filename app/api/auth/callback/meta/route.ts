import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { encryptToken } from '@/lib/encryption';
import { createClient } from '@supabase/supabase-js';
import type { MetaConnectionStatus } from '@/integrations/meta/types';

// OAuth Meta callback — arquitetura existente respeitada
// META_APP_SECRET: NUNCA exposto no código/cliente/Git

function getSupabase() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

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

  // Obter org do cookie de sessão
  const sessionCookie = req.cookies.get('session')?.value;
  if (!sessionCookie) return redirectError(req, 'not_authenticated');

  let userId: string;
  let organizationId: string;
  try {
    const sessionData = JSON.parse(Buffer.from(sessionCookie, 'base64').toString('utf8'));
    userId = sessionData.userId;
    organizationId = sessionData.organizationId;
  } catch {
    return redirectError(req, 'not_authenticated');
  }

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

  // Persistir integração no banco
  try {
    const supabase = getSupabase();
    const expiresAt = expiresIn > 0
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null;

    const { error: upsertErr } = await supabase
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