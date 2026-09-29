// FASE META — AUTH / OAUTH FLUXO (seção 6, 8, 9, 10, 21, 11)
import { MetaAuthConfig, MetaConnectionStatus, OAuthState } from '../types';

export class MetaOAuthError extends Error {
  constructor(message: string, public code: string) { super(message); }
}

export function buildMetaAuthUrl(config: MetaAuthConfig, state: string, provider: 'facebook' | 'instagram' | 'whatsapp'): string {
  const base = 'https://www.facebook.com/v18.0/dialog/oauth';
  const scopes = config.scopes.join(',');
  return `${base}?client_id=${config.appId}&redirect_uri=${encodeURIComponent(config.redirectUri)}&state=${state}&scope=${encodeURIComponent(scopes)}`;
}

export function generateState(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function validateOAuthCallback(query: URLSearchParams, expectedState: string, organizationId: string): { code: string; state: string } {
  const code = query.get('code');
  const state = query.get('state');
  const error = query.get('error');
  if (error) throw new MetaOAuthError(`OAuth error: ${error}`, 'OAUTH_ERROR');
  if (!code || !state) throw new MetaOAuthError('Missing code or state', 'INVALID_CALLBACK');
  if (state !== expectedState) throw new MetaOAuthError('State mismatch', 'INVALID_STATE');
  return { code, state };
}

export function getMetaConnectionStatus(externalStatus: string | null): MetaConnectionStatus {
  if (!externalStatus) return 'NOT_CONNECTED';
  const s = externalStatus.toLowerCase();
  if (s === 'connected' || s === 'ok') return 'CONNECTED';
  if (s === 'expired') return 'EXPIRED';
  if (s === 'pending') return 'PENDING';
  if (s === 'auth_required') return 'REAUTH_REQUIRED';
  return 'ERROR';
}
