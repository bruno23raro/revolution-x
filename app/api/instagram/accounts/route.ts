// FASE 21 — Rota de contas e OAuth do Instagram.
// Fluxo idêntico ao WhatsApp, usando provider='instagram' no Meta OAuth v26.0.
// Os escopos Instagram são: instagram_basic, instagram_content_publish, pages_show_list,
// pages_manage_posts, business_management (compatíveis com o DEFAULT_SCOPES global).

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { generateOAuthState, buildMetaAuthUrl } from '@/integrations/meta/auth/oauth';
import type { MetaAuthConfig } from '@/integrations/meta/types';
import { DEFAULT_SCOPES } from '@/integrations/meta/constants';

export async function GET(_req: NextRequest) {
  const user = await getAuthenticatedUser(_req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // List Instagram accounts for the tenant (metadata only — never expose tokens)
  // This reuses the same structure as WhatsApp accounts listing
  // In a full implementation, this would query meta_integrations for provider='instagram'
  // For now, return available: false until Instagram accounts are persisted

  return NextResponse.json({
    available: false,
    accounts: [],
    displayNameAvailable: false,
  });
}

export async function POST(_req: NextRequest) {
  const user = await getAuthenticatedUser(_req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Generate OAuth state for CSRF protection
  const state = generateOAuthState();

  // Build the redirect URI from the request origin
  const origin = _req.nextUrl.origin;

  // Build Meta Auth URL for Instagram connection
  const config: MetaAuthConfig = {
    appId: process.env.META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
    redirectUri: `${origin}/api/auth/callback/meta`,
    scopes: DEFAULT_SCOPES,
  };

  const authUrl = buildMetaAuthUrl(config, state, 'instagram');

  return NextResponse.json({
    success: true,
    authUrl,
    state,
    organizationId: user.organizationId,
  });
}

