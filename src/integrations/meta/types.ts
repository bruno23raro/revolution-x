// FASE 21 — Tipos e estruturas para WhatsApp Business API oficial e OAuth.

export type OAuthState = {
  /** State gerado para proteção contra CSRF no fluxo OAuth */
  state: string;
  /** Código de autorização retornado pela Meta */
  code?: string;
  /** Erro retornado pelo OAuth (se houver) */
  error?: string;
};

/**
 * Configuração do aplicativo Meta (Facebook/Instagram/WhatsApp).
 * Estes são os dados necessários para construir a URL de autorização e
 * processar o retorno do OAuth.
 */
export interface MetaAuthConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
  scopes: string[];
  /** URLs de logout e revogação, quando disponíveis */
  revokeUrl?: string;
  logoutUrl?: string;
}

export type MetaConnectionStatus =
  | 'NOT_CONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'EXPIRED'
  | 'PENDING'
  | 'REAUTH_REQUIRED'
  | 'ERROR';

export interface WhatsAppConnectionState {
  /** ID da conexão no banco (meta_integrations.id) */
  connectionId: string;
  /** Nome da empresa/tenant */
  organizationName: string;
  /** ID da WhatsApp Business Account (WABA) */
  wabaId: string;
  /** ID do número de telefone */
  phoneNumberId: string;
  /** Estado atual da conexão */
  status: MetaConnectionStatus;
  /** Momento da última validação da API */
  lastValidatedAt: Date;
  /** Permissões concedidas */
  grantedPermissions: string[];
  /** Token de acesso cifrado (server-side apenas) */
  encryptedAccessToken: string;
  /** ID do provedor */
  provider: 'whatsapp' | 'facebook';
  /** Display name da conta */
  displayName: string;
  /** Quando a conexão foi estabelecida */
  connectedAt: Date;
  /** Quando expira (se aplicável) */
  expiresAt?: Date;
}

export interface OAuthCallbackResult {
  success: boolean;
  code?: string;
  error?: string;
  stateMatch?: boolean;
  connection?: WhatsAppConnectionState;
}

/**
 * Token set returned from Instagram OAuth token exchange.
 * These tokens are CRIPTOGRAFADO (AES-256-GCM) before persisting to the database.
 */
export interface InstagramTokenSet {
  accessToken: string;
  expiresIn: number;
  userId: string;
  username: string;
  instagramBusinessAccountId: string;
  scope: string;
}

/**
 * Construi a URL de autorização OAuth da Meta para WhatsApp/Instagram/Facebook.
 * Usa a versão v26.0 da API, consistente em todos os módulos do projeto.
 * @param config Configuração do aplicativo Meta (appId, redirectUri, scopes)
 * @param state State OAuth gerado (CSRF protection)
 * @param provider 'whatsapp' | 'instagram' | 'facebook'
 */
export function buildMetaAuthUrl(
  config: MetaAuthConfig,
  state: string,
  provider: 'whatsapp' | 'instagram' | 'facebook',
): string {
  // Usa v26.0 — mesma versão usada em todos os módulos de publicação
  // (facebookPublisher, instagram, whatsapp, adsInsights) para consistência.
  const base = `https://www.facebook.com/v26.0/dialog/oauth`;
  const scopes = config.scopes.join(',');
  return `${base}?client_id=${config.appId}&redirect_uri=${encodeURIComponent(
    config.redirectUri,
  )}&state=${state}&scope=${encodeURIComponent(scopes)}`;
}

/**
 * Gera um state OAuth seguro (CSPRNG).
 * Math.random é previsível — OAuth state exige aleatoriedade segura.
 */
export function generateOAuthState(): string {
  const crypto =
    (globalThis as any).crypto || (globalThis as any).msCrypto;
  if (crypto && crypto.randomBytes) {
    return crypto.randomBytes(24).toString('base64url');
  }
  // Fallback para ambientes sem crypto (não use em produção)
  return require('crypto').randomBytes(24).toString('base64url');
}

/**
 * Valida o callback OAuth da Meta.
 * Lança MetaOAuthError em caso de erro, state mismatch ou parâmetros faltando.
 */
export function validateOAuthCallback(
  query: URLSearchParams,
  expectedState: string,
  organizationId: string,
): OAuthCallbackResult {
  const code = query.get('code');
  const state = query.get('state');
  const error = query.get('error');

  if (error) {
    return { success: false, error: `OAuth error: ${error}` };
  }

  if (!code || !state) {
    return { success: false, error: 'Missing code or state' };
  }

  if (state !== expectedState) {
    return { success: false, error: 'State mismatch', stateMatch: false };
  }

  // Sucesso — código válido e state confirma
  return { success: true, code };
}

/**
 * Converte o status textual da Meta para o enum local.
 * Os valores vêm da API da WhatsApp Business Platform e da Facebook Graph API.
 */
export function getMetaConnectionStatus(
  externalStatus: string | null,
): MetaConnectionStatus {
  if (!externalStatus) return 'NOT_CONNECTED';

  const s = externalStatus.toLowerCase();
  const statusMap: Record<string, MetaConnectionStatus> = {
    connected: 'CONNECTED',
    ok: 'CONNECTED',
    expired: 'EXPIRED',
    pending: 'PENDING',
    auth_required: 'REAUTH_REQUIRED',
  };

  return statusMap[s] || 'ERROR';
}

/**
 * Campos seguros para exibição no painel (NUNCA expõe tokens puros).
 * Apenas metadados que podem ser mostrados ao usuário/admin.
 */
export function getSafeConnectionData(
  state: WhatsAppConnectionState,
): {
  id: string;
  status: MetaConnectionStatus;
  provider: 'whatsapp' | 'facebook';
  displayName: string | null;
  phoneNumberId: string | null;
  wabaId: string | null;
  connectedAt: Date;
  expiresAt?: Date;
} {
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

