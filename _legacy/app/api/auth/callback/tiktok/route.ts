// FASE 2 · slice 4 — CALLBACK do fluxo OAuth do TikTok (Content Posting API).
//
//   GET /api/auth/callback/tiktok?code=...&state=...
//     → valida state (CSRF, timing-safe) + PKCE verifier (cookies httpOnly
//       criados em /api/auth/tiktok), autentica o usuário (Supabase), troca
//       o code por tokens SERVIDOR (client_secret só no .env), cifra com
//       AES-256-GCM e persiste no AgentMemory do tenant (provider `tiktok`).
//
//   Degradações honestas → /onboarding/error?reason=... (NUNCA finge sucesso).
//   O token não entra em log nem em redirect.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { encryptToken } from '@/lib/encryption';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TaskQueueUnavailableError } from '@/lib/taskQueue';
import { saveTikTokOAuthTokens } from '@/integrations/tiktok/resolveAccess';
import { exchangeTikTokCode, TikTokOAuthError } from '@/integrations/tiktok/auth/oauth';

export const dynamic = 'force-dynamic';

// Comparação timing-safe (mesmo padrão do callback Meta).
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function redirectError(req: NextRequest, reason: string, detail?: string) {
  const url = new URL('/onboarding/error', req.url);
  url.searchParams.set('reason', reason);
  if (detail) url.searchParams.set('detail', detail);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) return redirectError(req, 'oauth_error', error);
  if (!state) return redirectError(req, 'state_missing');
  if (!code) return redirectError(req, 'code_missing');

  // State CSRF (cookie httpOnly do início do fluxo).
  const sessionState = req.cookies.get('tiktok_oauth_state')?.value ?? '';
  if (!sessionState || !secureCompare(state, sessionState)) {
    return redirectError(req, 'state_invalid');
  }
  const verifier = req.cookies.get('tiktok_oauth_verifier')?.value ?? '';
  if (!verifier) return redirectError(req, 'pkce_missing');

  // Credenciais da aplicação (NUNCA no banco/front). Ausentes → degrada honesto.
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    return redirectError(req, 'config_missing', 'TIKTOK_CLIENT_KEY/TIKTOK_CLIENT_SECRET ausentes no servidor');
  }

  // Autenticação: Supabase + membership no banco (com withUserContext interno).
  const user = await getAuthenticatedUser(req);
  if (!user) return redirectError(req, 'not_authenticated');

  // Troca o code por access/refresh (servidor; PKCE verifier + redirect_uri exato).
  let tokens;
  try {
    tokens = await exchangeTikTokCode(
      { clientKey, clientSecret, redirectUri: `${req.nextUrl.origin}/api/auth/callback/tiktok` },
      code,
      verifier,
    );
  } catch (e) {
    const detail = e instanceof TikTokOAuthError ? e.code : 'token_exchange_failed';
    console.error('[tiktok-oauth] token exchange failed:', detail);
    return redirectError(req, 'token_exchange_failed', detail);
  }

  // Cifra o access_token (AES-256-GCM) ANTES de persistir.
  let encrypted: string;
  try {
    encrypted = encryptToken(tokens.accessToken);
  } catch {
    return redirectError(req, 'encryption_failed');
  }

  // Persiste no AgentMemory do tenant (provider `tiktok`), mesclando com a
  // config existente (preserva clientKey/clientSecret manuais, se houver).
  try {
    await saveTikTokOAuthTokens(
      prisma,
      { organizationId: user.organizationId, userId: user.id },
      tokens,
      encrypted,
    );
  } catch (e) {
    if (e instanceof TaskQueueUnavailableError) {
      return redirectError(req, 'queue_unavailable', e.message);
    }
    console.error('[tiktok-oauth] persist failed:', (e as Error).message);
    return redirectError(req, 'db_error');
  }

  // Sucesso: limpa cookies de estado e redireciona.
  const res = NextResponse.redirect(new URL('/onboarding/success', req.url));
  res.cookies.set('tiktok_oauth_state', '', { maxAge: 0, path: '/' });
  res.cookies.set('tiktok_oauth_verifier', '', { maxAge: 0, path: '/' });
  return res;
}
