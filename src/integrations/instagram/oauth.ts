// FASE 21 — OAuth 2.0 do Instagram (Meta Graph API).
// Versão consistente em todos os módulos do projeto (facebookPublisher,
// instagramPublisher, whatsapp, adsInsights) para consistência.
//
// Fluxo OAuth 2.0 idêntico ao Facebook/Meta já implementado em
// src/integrations/meta/auth/oauth.ts, com provider='instagram'.
// Os escopos Instagram são: instagram_basic, instagram_content_publish,
// pages_show_list, pages_manage_posts, business_management.
//
// O token de acesso é CRIPTOGRAFADO (AES-256-GCM, mesmo mecanismo do Meta)
// e armazenado no AgentMemory do tenant (provider `instagram`).
// client_id/client_secret são do .env (META_APP_ID/META_APP_SECRET) —
// NUNCA no banco. O provider 'instagram' compartilha as mesmas credenciais
// do Facebook, mas usa escopos diferentes.
//
// O token de acesso expira e requer refresh pelo mesmo endpoint:
// POST https://graph.facebook.com/v26.0/oauth/access_token?grant_type=refresh_token&
// client_id=...&client_secret=...&refresh_token=...

import crypto from 'crypto';
import { MetaAuthConfig, MetaConnectionStatus, OAuthState } from '../../integrations/meta/types';

const INSTAGRAM_SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'pages_show_list',
  'pages_manage_posts',
  'business_management',
] as const;

export type InstagramScope = (typeof INSTAGRAM_SCOPES)[number];

export interface InstagramOAuthConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
  scopes?: string[];
}

export interface InstagramTokenSet {
  accessToken: string;
  expiresIn: number;
  userId: string;
  username: string;
  instagramBusinessAccountId: string;
  scope: string;
}

/** Gera state CSPRNG (CSRF). */
export function generateInstagramOAuthState(): string {
  const cryptoImpl =
    (globalThis as any).crypto || (globalThis as any).msCrypto;
  if (cryptoImpl && cryptoImpl.randomBytes) {
    return cryptoImpl.randomBytes(24).toString('base64url');
  }
  return require('crypto').randomBytes(24).toString('base64url');
}

/** Monta a URL de autorização do Instagram (Meta Graph API v26.0). */
export function buildInstagramAuthUrl(
  config: InstagramOAuthConfig,
  state: string,
): string {
  const scopes = (config.scopes || INSTAGRAM_SCOPES).join(',');
  return `${AUTHORIZE_URL}?client_id=${config.appId}&redirect_uri=${encodeURIComponent(
    config.redirectUri,
  )}&state=${state}&scope=${encodeURIComponent(scopes)}`;
}

/** Exchange do code por tokens do Instagram (Meta Graph API). */
export async function exchangeInstagramCode(
  config: InstagramOAuthConfig,
  code: string,
  fetchImpl: typeof fetch = fetch,
): Promise<InstagramTokenSet> {
  const url = new URL('https://graph.facebook.com/v26.0/oauth/access_token');

  const params = new URLSearchParams({
    client_id: config.appId,
    client_secret: config.appSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: config.redirectUri,
  });

  url.search = params.toString();

  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Instagram token exchange failed ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token || '',
    expiresIn: data.expires_in || 0,
    userId: data.user_id || '',
    username: data.username || '',
    instagramBusinessAccountId: data.instagram_business_account_id || '',
    scope: data.scope || '',
  };
}

/** Retorna dados seguros para exibição no painel (NUNCA expõe tokens puros). */
export function getSafeInstagramConnectionData(
  state: {
    connectionId: string;
    status: MetaConnectionStatus;
    provider: 'instagram';
    userId: string;
    username: string;
    instagramBusinessAccountId: string;
    connectedAt: Date;
    expiresAt?: Date;
  },
) {
  return {
    id: state.connectionId,
    status: state.status,
    provider: state.provider,
    userId: state.userId,
    username: state.username,
    instagramBusinessAccountId: state.instagramBusinessAccountId,
    connectedAt: state.connectedAt,
    expiresAt: state.expiresAt,
  };
}

export const AUTHORIZE_URL = 'https://www.facebook.com/v26.0/dialog/oauth';