// FASE 1 — INÍCIO do fluxo OAuth da Meta (complementa /api/auth/callback/meta).
//
//   GET /api/auth/meta?provider=whatsapp|facebook|instagram
//     → 302 para o dialog OAuth da Meta (state CSPRNG em cookie httpOnly).
//
// Pede uma sessão autenticada. Se as credenciais META_APP_ID/SECRET não estão no
// host, degrada com 503 `meta_not_configured` (jamais simula conexão). O token
// trocado no callback é criptografado e persistido; aqui só se abre o login.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { generateState, buildMetaAuthUrl } from '@/integrations/meta/auth/oauth';
import type { MetaAuthConfig } from '@/integrations/meta/types';

export const dynamic = 'force-dynamic';

type Provider = 'facebook' | 'instagram' | 'whatsapp';

const PROVIDERS: Provider[] = ['facebook', 'instagram', 'whatsapp'];

// Escopos padrão (suficientes p/ pages + Instagram + WhatsApp Business Messaging).
const DEFAULT_SCOPES = [
  'pages_show_list',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
  'business_management',
  'whatsapp_business_messaging',
];

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const provider = PROVIDERS.includes(req.nextUrl.searchParams.get('provider') as Provider)
    ? (req.nextUrl.searchParams.get('provider') as Provider)
    : 'facebook';

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    // P0 [HUMANO]: credenciais Meta ausentes no host — degradação honesta.
    return NextResponse.json(
      { error: 'meta_not_configured', detail: 'META_APP_ID/META_APP_SECRET ausentes no servidor' },
      { status: 503 },
    );
  }

  const redirectUri = `${req.nextUrl.origin}/api/auth/callback/meta`;
  const config: MetaAuthConfig = { appId, appSecret, redirectUri, scopes: DEFAULT_SCOPES };
  const state = generateState();

  const res = NextResponse.redirect(buildMetaAuthUrl(config, state, provider));
  res.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60,
    path: '/',
  });
  return res;
}
