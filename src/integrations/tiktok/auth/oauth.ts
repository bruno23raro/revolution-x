// FASE 2 · slice 4 — OAuth 2.0 do TikTok (Content Posting API).
//
// Fluxo real (documentação oficial TikTok for Developers):
//   • Início:  GET https://www.tiktok.com/v2/auth/authorize/
//               client_key + scope + redirect_uri + state + response_type=code
//               + PKCE (code_challenge S256) → 302 com `code`.
//   • Troca:   POST https://open.tiktokapis.com/v2/oauth/token/
//               grant_type=authorization_code → { access_token, refresh_token,
//               expires_in, open_id, scope }.
//   • Refresh:  POST https://open.tiktokapis.com/v2/oauth/token/
//               grant_type=refresh_token → novo access_token + refresh_token.
//
// Escopos: `video.publish` (publicar) + `user.info.basic` (identidade).
// O `video.publish` exige aprovação da app pelo TikTok (audit) — degradação
// honesta se não houver permissão.
//
// O token de usuário (access/refresh) é CRIPTOGRAFADO (AES-256-GCM, mesmo
// mecanismo do Meta) e armazenado no AgentMemory do tenant (provider `tiktok`).
// client_key/client_secret são do .env (TIKTOK_CLIENT_KEY/SECRET) — NUNCA no banco.

import crypto from 'crypto';

const AUTHORIZE_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';

/** Escopos padrão para a Content Posting API. */
export const DEFAULT_TIKTOK_SCOPES = ['video.publish', 'user.info.basic'] as const;

export type TikTokScope = (typeof DEFAULT_TIKTOK_SCOPES)[number];

export interface TikTokOAuthConfig {
  clientKey: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
}

export interface TikTokTokenSet {
  accessToken: string;
  refreshToken: string;
  openId: string;
  scope: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

export class TikTokOAuthError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'TikTokOAuthError';
  }
}

/** Gera code_verifier + code_challenge (PKCE S256) para o fluxo web. */
export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

/** Gera state CSPRNG (CSRF). */
export function generateOAuthState(): string {
  return crypto.randomBytes(24).toString('base64url');
}

/** Monta a URL de autorização do TikTok. */
export function buildTikTokAuthUrl(config: TikTokOAuthConfig, state: string, challenge: string): string {
  const scopes = (config.scopes && config.scopes.length > 0 ? config.scopes : DEFAULT_TIKTOK_SCOPES).join(',');
  const q = new URLSearchParams({
    client_key: config.clientKey,
    response_type: 'code',
    scope: scopes,
    redirect_uri: config.redirectUri,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  return `${AUTHORIZE_URL}?${q.toString()}`;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  open_id?: string;
  scope?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  error?: string;
  error_description?: string;
}

/** Troca o authorization_code por tokens (servidor — client_secret NUNCA no front). */
export async function exchangeTikTokCode(
  config: TikTokOAuthConfig,
  code: string,
  verifier: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TikTokTokenSet> {
  const body = new URLSearchParams({
    client_key: config.clientKey,
    client_secret: config.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: config.redirectUri,
    code_verifier: verifier,
  });
  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !data.access_token) {
    throw new TikTokOAuthError(
      data.error_description || data.error || `token exchange failed (HTTP ${res.status})`,
      'TOKEN_EXCHANGE_FAILED',
    );
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || '',
    openId: data.open_id || '',
    scope: data.scope || '',
    expiresIn: Number(data.expires_in) || 0,
    refreshExpiresIn: Number(data.refresh_expires_in) || 0,
  };
}

/** Renova o access_token com o refresh_token (sem interação do usuário). */
export async function refreshTikTokToken(
  config: TikTokOAuthConfig,
  refreshToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TikTokTokenSet> {
  const body = new URLSearchParams({
    client_key: config.clientKey,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !data.access_token) {
    throw new TikTokOAuthError(
      data.error_description || data.error || `token refresh failed (HTTP ${res.status})`,
      'TOKEN_REFRESH_FAILED',
    );
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    openId: data.open_id || '',
    scope: data.scope || '',
    expiresIn: Number(data.expires_in) || 0,
    refreshExpiresIn: Number(data.refresh_expires_in) || 0,
  };
}