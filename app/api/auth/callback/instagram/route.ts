// FASE 21 — Callback OAuth do Instagram.
// Fluxo idêntico ao Facebook/Meta, usando validateOAuthCallback e
// exchangeInstagramCode do oauth.ts. State CSRF protection via
// crypto.timingSafeEqual, token exchange via Graph API v26.0,
// persistência cifrada no banco, isolamento por tenant.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { generateInstagramOAuthState, exchangeInstagramCode, getSafeInstagramConnectionData } from '@/integrations/instagram/oauth';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { withUserContext } from '@/lib/prisma';
import { encryptToken } from '@/lib/encryption';
import type { MetaConnectionStatus, InstagramTokenSet } from '@/integrations/meta/types';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Erros explícitos — sem stack trace
  if (error) return NextResponse.redirect(new URL('/onboarding/error?reason=oauth_error&detail=' + error, req.url));
  if (!state) return NextResponse.redirect(new URL('/onboarding/error?reason=state_missing', req.url));
  if (!code) return NextResponse.redirect(new URL('/onboarding/error?reason=code_missing', req.url));

  // State CSRF protection — timing-safe comparison with length guard (prevents RangeError DoS)
  const sessionState = req.cookies.get('instagram_oauth_state')?.value ?? '';
  function secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
  if (!sessionState || !secureCompare(state, sessionState)) {
    return NextResponse.redirect(new URL('/onboarding/error?reason=state_invalid', req.url));
  }

  // Autenticação robusta: validação via Supabase Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/onboarding/error?reason=not_authenticated', req.url));
  }

  // Buscar membership do usuário no banco para validar a organização.
  const dbUser = await withUserContext(user.id, async (tx) =>
    tx.user.findUnique({
      where: { id: user.id },
      include: { organizationMembers: true },
    })
  );

  if (!dbUser || dbUser.organizationMembers.length === 0) {
    return NextResponse.redirect(new URL('/onboarding/error?reason=not_authenticated', req.url));
  }

  // Usa a primeira (primary) organização do usuário
  const organizationId = dbUser.organizationMembers[0].organizationId;

  // Exchange do code por tokens do Instagram usando o código compartilhado
  let tokenResult: InstagramTokenSet;
  try {
    const config = {
      appId: process.env.META_APP_ID || '',
      appSecret: process.env.META_APP_SECRET || '',
      redirectUri: `${req.nextUrl.origin}/api/auth/callback/instagram`,
    };

    const result = await exchangeInstagramCode(config, code);
    // O exchangeInstagramCode lança erro se falhar; se chegar aqui, sucesso
    tokenResult = result;
  } catch (err: any) {
    console.error('[instagram-oauth] token exchange error:', err);
    return NextResponse.redirect(new URL('/onboarding/error?reason=token_exchange_failed', req.url));
  }

  // Criptografar token antes de persistir — usa encryptToken() compartilhado (META_TOKEN_ENCRYPTION_KEY)
  let encryptedToken: string;
  try {
    encryptedToken = encryptToken(tokenResult.accessToken);
  } catch {
    return NextResponse.redirect(new URL('/onboarding/error?reason=encryption_failed', req.url));
  }

  // Persistir integração no banco via service_role
  try {
    const serviceSupabase = createServiceRoleClient();
    const expiresAt = tokenResult.expiresIn > 0
      ? new Date(Date.now() + tokenResult.expiresIn * 1000).toISOString()
      : null;

    // Para Instagram, usamos o user_id do Instagram e o instagram_business_account_id
    const { data, error } = await serviceSupabase
      .from('meta_integrations')
      .upsert({
        organization_id: organizationId,
        provider: 'instagram',
        instagram_account_id: tokenResult.userId || null,
        meta_page_id: null, // Instagram não tem "páginas" no mesmo sentido do Facebook
        instagram_business_account_id: tokenResult.instagramBusinessAccountId || null,
        meta_app_id: process.env.META_APP_ID ?? null,
        encrypted_access_token: encryptedToken,
        token_expires_at: expiresAt,
        status: 'CONNECTED' as MetaConnectionStatus,
        connected_at: new Date().toISOString(),
        // Campos extras do token exchange
        access_token_username: tokenResult.username || null,
        scope: tokenResult.scope || null,
      }, {
        onConflict: 'organization_id,provider',
      });

    if (error) {
      console.error('[instagram-oauth] db error:', error);
      return NextResponse.redirect(new URL('/onboarding/error?reason=db_error', req.url));
    }
  } catch (err) {
    console.error('[instagram-oauth] db error:', err);
    return NextResponse.redirect(new URL('/onboarding/error?reason=db_error', req.url));
  }

  // Nunca expor token na response/redirect — apenas dados seguros
  return NextResponse.redirect(new URL('/onboarding/success', req.url));
}

