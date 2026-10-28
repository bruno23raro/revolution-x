// FASE META — AUTH / OAUTH FLUXO (seção 6, 8, 9, 10, 21, 11)

import crypto from 'crypto';
import { MetaAuthConfig, MetaConnectionStatus, OAuthState } from '../types';
import { DEFAULT_SCOPES } from '../constants';

export class MetaOAuthError extends Error {
  constructor(message: string, public code: string) { super(message); }
}

/**
 * URL de autorização OAuth v26.0 da Meta (Facebook/Instagram/WhatsApp).
 * Versão consistente em todos os módulos do projeto (facebookPublisher,
 * instagramPublisher, whatsapp, adsInsights).
 *
 * @param config Configuração do aplicativo Meta (appId, redirectUri, scopes)
 * @param state State OAuth gerado (CSRF protection — CSPRNG)
 * @param provider 'whatsapp' | 'instagram' | 'facebook'
 */
export function buildMetaAuthUrl(
  config: MetaAuthConfig,
  state: string,
  provider: 'whatsapp' | 'instagram' | 'facebook',
): string {
  const base = 'https://www.facebook.com/v26.0/dialog/oauth';
  const scopes = (config.scopes || []).join(',');
  return `${base}?client_id=${config.appId}&redirect_uri=${encodeURIComponent(
    config.redirectUri,
  )}&state=${state}&scope=${encodeURIComponent(scopes)}`;
}

/**
 * Gera um state OAuth seguro usando Crypto API (CSPRNG).
 * Math.random é previsível — OAuth state exige aleatoriedade segura.
 * @returns state string codificado em base64url
 */
export function generateOAuthState(): string {
  const cryptoImpl =
    (globalThis as any).crypto || (globalThis as any).msCrypto;
  if (cryptoImpl && cryptoImpl.randomBytes) {
    return cryptoImpl.randomBytes(24).toString('base64url');
  }
  // Fallback para Node.js
  return require('crypto').randomBytes(24).toString('base64url');
}

/**
 * Alias mantido para compatibilidade com testes e código existente.
 * @deprecated Use generateOAuthState em vez disso.
 */
export const generateState: () => string = generateOAuthState;

/**
 * Valida o callback OAuth da Meta.
 * Extrai o code e valida o state (proteção contra CSRF).
 * Retorna { code, stateMatch, error } em vez de lançar exceções,
 * para que o chamador decida como tratar (redirecionar, error page, etc.).
 */
export function validateOAuthCallback(
  query: URLSearchParams,
  expectedState: string,
  organizationId: string,
): { code: string; stateMatch: boolean; error?: string } {
  const code = query.get('code');
  const state = query.get('state');
  const error = query.get('error');

  if (error) {
    return { code: '', stateMatch: false, error: `OAuth error: ${error}` };
  }

  if (!code || !state) {
    return { code: '', stateMatch: false, error: 'Missing code or state' };
  }

  if (state !== expectedState) {
    return { code: '', stateMatch: false, error: 'State mismatch' };
  }

  // Sucesso — código válido e state confirma
  return { code, stateMatch: true };
}

/**
 * Converte o status textual da Meta para o enum local MetaConnectionStatus.
 * Os valores vêm da API da WhatsApp Business Platform e da Facebook Graph API.
 */
export function getMetaConnectionStatus(
  externalStatus: string | null,
): MetaConnectionStatus {
  if (!externalStatus) return 'NOT_CONNECTED';

  const s = externalStatus.toLowerCase();
  if (s === 'connected' || s === 'ok') return 'CONNECTED';
  if (s === 'expired') return 'EXPIRED';
  if (s === 'pending') return 'PENDING';
  if (s === 'auth_required') return 'REAUTH_REQUIRED';
  return 'ERROR';
}

/**
 * Retorna dados seguros para exibição no painel (NUNCA expõe tokens puros).
 * Apenas metadados que podem ser mostrados ao usuário/admin.
 */
export function getSafeConnectionData(
  state: {
    connectionId: string;
    status: MetaConnectionStatus;
    provider: 'whatsapp' | 'facebook';
    displayName: string | null;
    phoneNumberId: string | null;
    wabaId: string | null;
    connectedAt: Date;
    expiresAt?: Date;
  },
) {
  return {
    id: state.connectionId,
    status: state.status,
    provider: state.provider,
    displayName: state.displayName,
    phoneNumberId: state.phoneNumberId,
    wabaId: state.wabaId,
    connectedAt: state.connectedAt,
    expiresAt: state.expiresAt,
  };
}

/**
 * Exchange do código OAuth por credenciais da Meta.
 *
 * POST para a Graph API: https://graph.facebook.com/v26.0/oauth/access_token
 * com parâmetros: client_id, client_secret, redirect_uri, code
 *
 * O response viria com:
 * - access_token (para ser cifrado e stored server-side)
 * - waba_id (se o número selecionado for da WhatsApp Business Platform)
 * - phone_number_id
 * - expires_in
 *
 * @param code Código de autorização retornado pelo OAuth callback
 * @param config Configuração do aplicativo Meta (appId, appSecret, redirectUri)
 * @param redirectUri Redirect URI registrado no aplicativo Meta
 * @returns Resultado do exchange com tokens e metadados
 */
async function exchangeOAuthCodeForTokens(
  code: string,
  config: MetaAuthConfig,
  redirectUri: string,
): Promise<{
  accessToken: string;
  expiresIn?: number;
  wabaId?: string;
  phoneNumberId?: string;
  error?: string;
}> {
  const url = new URL('https://graph.facebook.com/v26.0/oauth/access_token');

  const params = new URLSearchParams({
    client_id: config.appId,
    client_secret: config.appSecret,
    code,
    redirect_uri: redirectUri,
  });

  url.search = params.toString();

  const fetchImpl = (globalThis as any).fetch;
  if (!fetchImpl) {
    return { error: 'Fetch not available', accessToken: '' };
  }

  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { error: `Meta API error ${response.status}: ${errorText}`, accessToken: '' };
  }

  const data = await response.json();

  return {
    accessToken: data.access_token || '',
    expiresIn: data.expires_in ?? undefined,
    wabaId: data.waba_id ?? undefined,
    phoneNumberId: data.phone_number_id ?? undefined,
    error: data.error,
  };
}

/**
 * Processa o fluxo completo de callback OAuth.
 * Valida o state, troca o code por tokens e retorna o estado da conexão.
 *
 * @param query URLSearchParams do callback Meta
 * @param expectedState State que foi gerado anteriormente
 * @param organizationId ID da organização
 * @param origin Origin string (for redirectUri)
 * @returns Resultado do processamento OAuth
 */
export async function processOAuthCallback(
  query: URLSearchParams,
  expectedState: string,
  organizationId: string,
  origin: string,
): Promise<{
  success: boolean;
  code?: string;
  error?: string;
  connectionState?: {
    status: MetaConnectionStatus;
    wabaId: string | null;
    phoneNumberId: string | null;
    displayName: string | null;
  };
}> {
  const { code, stateMatch, error } = validateOAuthCallback(
    query,
    expectedState,
    organizationId,
  );

  if (!code) {
    return { success: false, error };
  }

  // Exchange do code por tokens usando as credenciais do aplicativo Meta
  const redirectUri = `${origin}/api/auth/callback/meta`;

  const config: MetaAuthConfig = {
    appId: process.env.META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
    redirectUri,
    scopes: DEFAULT_SCOPES,
  };

  // TODO: Em produção, o redirectUri viria do request ou configuração,
  // e as credenciais viriam de forma segura (não hardcoded).
  // Por ora, usamos as environment variables configuradas no host.

  const tokenResult = await exchangeOAuthCodeForTokens(code, config, redirectUri);

  if (tokenResult.error) {
    return { success: false, error: tokenResult.error };
  }

  // Montar estado da conexão a partir dos tokens recebidos
  const connectionState = {
    status: tokenResult.error ? 'ERROR' : 'CONNECTED' as MetaConnectionStatus,
    wabaId: tokenResult.wabaId || null,
    phoneNumberId: tokenResult.phoneNumberId || null,
    displayName: null, // Será preenchido ao buscar dados do perfil
  };

  return {
    success: true,
    code,
    connectionState,
  };
}