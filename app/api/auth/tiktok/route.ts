// FASE 2 · slice 4 — INÍCIO do fluxo OAuth do TikTok (Content Posting API).
//
//   GET /api/auth/tiktok
//     → 302 para https://www.tiktok.com/v2/auth/authorize/
//       (state + code_challenge em cookie httpOnly p/ validar no callback).
//
// Pede uma sessão autenticada. Requer client_key/client_secret configurados
// (TIKTOK_CLIENT_KEY/TIKTOK_CLIENT_SECRET no .env). Se ausentes, degrada com
// 503 `tiktok_not_configured` (jamais simula conexão). O token trocado no
// callback é criptografado e persistido no AgentMemory do tenant.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { buildTikTokAuthUrl, generateOAuthState, generatePkce } from '@/integrations/tiktok/auth/oauth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    // P0 [HUMANO]: credenciais TikTok ausentes no host — degradação honesta.
    return NextResponse.json(
      {
        error: 'tiktok_not_configured',
        detail: 'TIKTOK_CLIENT_KEY/TIKTOK_CLIENT_SECRET ausentes no servidor',
      },
      { status: 503 },
    );
  }

  const redirectUri = `${req.nextUrl.origin}/api/auth/callback/tiktok`;
  const { verifier, challenge } = generatePkce();
  const state = generateOAuthState();

  const res = NextResponse.redirect(
    buildTikTokAuthUrl({ clientKey, clientSecret, redirectUri }, state, challenge),
  );
  // Cookie guarda state + verifier (PKCE) p/ o callback validar e trocar.
  res.cookies.set('tiktok_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60,
    path: '/',
  });
  res.cookies.set('tiktok_oauth_verifier', verifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60,
    path: '/',
  });
  return res;
}