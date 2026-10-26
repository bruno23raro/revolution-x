// Meta Plugin - Automação de Conexão de Contas Meta
// Plugin para fluxos automatizados de conexão e integração de contas Meta

import crypto from 'crypto';

// Credenciais fixas
const META_APP_ID = '1112157761403064';
const META_APP_SECRET = 'ff2edcdec00e1e843433b860c717a3ab';
const DEFAULT_ORIGIN = 'https://revolutionx.com.br';

const DEFAULT_SCOPES = [
  'pages_show_list',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
  'business_management',
  'whatsapp_business_messaging',
];

// Gerar state OAuth seguro
export function generateMetaState(): string {
  const cryptoImpl =
    (globalThis as any).crypto || (globalThis as any).msCrypto;
  if (cryptoImpl && cryptoImpl.randomBytes) {
    return cryptoImpl.randomBytes(24).toString('base64url');
  }
  return require('crypto').randomBytes(24).toString('base64url');
}

// Construir URL de autorização
export function buildMetaAuthUrl(provider: 'whatsapp' | 'instagram' | 'facebook', state: string): string {
  const scopes = DEFAULT_SCOPES.join(',');
  return `https://www.facebook.com/v26.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(`${DEFAULT_ORIGIN}/api/auth/callback/meta`)}&state=${state}&scope=${encodeURIComponent(scopes)}`;
}

// Verificar se callback tem error
export function checkOAuthError(query: URLSearchParams): string | null {
  const error = query.get('error');
  return error || null;
}

// Verificar se callback tem code
export function getOAuthCode(query: URLSearchParams): string | null {
  const code = query.get('code');
  return code || null;
}

// Gerar verify token consistente para webhooks
export function generateWebhookVerifyToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Validar token de webhook recebido
export function validateWebhookToken(receivedToken: string, expectedToken: string): boolean {
  return receivedToken === expectedToken;
}

// Formatar resposta segura para painel (nunca expõe tokens)
export function formatSafeConnectionData({
  connectionId,
  status,
  provider,
  displayName,
  phoneNumberId,
  wabaId,
  connectedAt,
  expiresAt,
}: {
  connectionId: string;
  status: string;
  provider: string;
  displayName: string | null;
  phoneNumberId: string | null;
  wabaId: string | null;
  connectedAt: Date;
  expiresAt?: Date;
}) {
  return {
    id: connectionId,
    status,
    provider,
    displayName,
    phoneNumberId,
    wabaId,
    connectedAt: connectedAt.toISOString(),
    expiresAt: expiresAt?.toISOString(),
  };
}

// Estrutura de resposta para listar contas
export interface AccountSummary {
  id: string;
  provider: string | null;
  displayName: string | null;
  phoneNumberId: string | null;
  whatsappBusinessAccountId: string | null;
  status: string | null;
}

// Estrutura para resultado de OAuth
export interface OAuthResult {
  success: boolean;
  code?: string;
  error?: string;
  stateMatch?: boolean;
}

// Estrutura para refresh token
export interface RefreshTokenResult {
  ok: boolean;
  accessToken?: string;
  expiresIn?: number;
  error?: string;
}

// Configurações de produto no Developer Portal
export const META_PRODUCTS = {
  facebookLogin: {
    name: 'Facebook Login',
    endpoint: 'https://developers.facebook.com/apps/',
    setupRequired: true,
    scopes: ['pages_show_list', 'pages_manage_posts', 'instagram_basic'],
  },
  instagramGraphAPI: {
    name: 'Instagram Graph API',
    endpoint: 'https://developers.facebook.com/apps/',
    setupRequired: true,
    scopes: ['instagram_basic', 'instagram_content_publish'],
  },
  whatsAppBusinessAPI: {
    name: 'WhatsApp Business API',
    endpoint: 'https://developers.facebook.com/apps/',
    setupRequired: true,
    scopes: ['whatsapp_business_messaging'],
  },
};

// Escopos padrão consolidados
export const ALL_SCOPES = [
  'pages_show_list',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
  'business_management',
  'whatsapp_business_messaging',
];

// Verificar se todas as credenciais estão presentes
export function checkCredentials(): { ok: boolean; missing: string[] } {
  const missing: string[] = [];

  if (!META_APP_ID) missing.push('META_APP_ID');
  if (!META_APP_SECRET) missing.push('META_APP_SECRET');

  return {
    ok: missing.length === 0,
    missing,
  };
}

// Gerar resumo de configurações para exibição
export function getConfigSummary() {
  const creds = checkCredentials();

  return {
    appId: META_APP_ID || 'Não configurado',
    appSecret: creds.ok ? '[Configurado]' : 'Não configurado',
    origin: DEFAULT_ORIGIN,
    webhookVerifyToken: crypto.randomBytes(16).toString('hex').substring(0, 8) + '...', // Somente preview
    scopes: ALL_SCOPES,
    defaultOrigin: DEFAULT_ORIGIN,
  };
}

// Exportar para uso com o sistema de plugins
export default {
  generateMetaState,
  buildMetaAuthUrl,
  checkOAuthError,
  getOAuthCode,
  generateWebhookVerifyToken,
  validateWebhookToken,
  formatSafeConnectionData,
  AccountSummary,
  OAuthResult,
  RefreshTokenResult,
  META_PRODUCTS,
  ALL_SCOPES,
  checkCredentials,
  getConfigSummary,
};