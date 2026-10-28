// Meta Plugin - Automação de Conexão de Contas Meta
// Plugin para fluxos automatizados de conexão e integração de contas Meta

import { config } from 'dotenv';
config({ path: '.env.local' });
import crypto from 'crypto';

// Credenciais de .env.local
const META_APP_ID = process.env.META_APP_ID || '1112157761403064';
const META_APP_SECRET = process.env.META_APP_SECRET || '';
const DEFAULT_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || 'https://revolutionx.com.br';

const DEFAULT_SCOPES = [
  'pages_show_list',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
  'business_management',
  'whatsapp_business_messaging',
  'pages_read_user_content',
  'whatsapp_business_management',
  'ads_read',
  'pages_read_engagement',
  'pages_manage_ads',
];

// Gerar state OAuth seguro
export function generateMetaState() {
  const cryptoImpl =
    (globalThis).crypto || (globalThis).msCrypto;
  if (cryptoImpl && cryptoImpl.randomBytes) {
    return cryptoImpl.randomBytes(24).toString('base64url');
  }
  return require('crypto').randomBytes(24).toString('base64url');
}

// Construir URL de autorização
export function buildMetaAuthUrl(provider, state) {
  const scopes = DEFAULT_SCOPES.join(',');
  return `https://www.facebook.com/v26.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(`${DEFAULT_ORIGIN}/api/auth/callback/meta`)}&state=${state}&scope=${encodeURIComponent(scopes)}`;
}

// Verificar se callback tem error
export function checkOAuthError(query) {
  const error = query.get('error');
  return error || null;
}

// Verificar se callback tem code
export function getOAuthCode(query) {
  const code = query.get('code');
  return code || null;
}

// Gerar verify token consistente para webhooks
export function generateWebhookVerifyToken() {
  return crypto.randomBytes(16).toString('hex');
}

// Validar token de webhook recebido
export function validateWebhookToken(receivedToken, expectedToken) {
  return receivedToken === expectedToken;
}

// Formatar resposta segura para painel (nunca expõe tokens)
export function formatSafeConnectionData({ connectionId, status, provider, displayName, phoneNumberId, wabaId, connectedAt, expiresAt }) {
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
// export interface AccountSummary {
//   id: string;
//   provider: string | null;
//   displayName: string | null;
//   phoneNumberId: string | null;
//   whatsappBusinessAccountId: string | null;
//   status: string | null;
// }
//
// Estrutura para resultado de OAuth
// export interface OAuthResult {
//   success: boolean;
//   code?: string;
//   error?: string;
//   stateMatch?: boolean;
// }
//
// Estrutura para refresh token
// export interface RefreshTokenResult {
//   ok: boolean;
//   accessToken?: string;
//   expiresIn?: number;
//   error?: string;
// }

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
export function checkCredentials() {
  const missing = [];

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
const pluginExports = {
  generateMetaState,
  buildMetaAuthUrl,
  checkOAuthError,
  getOAuthCode,
  generateWebhookVerifyToken,
  validateWebhookToken,
  formatSafeConnectionData,
  META_PRODUCTS,
  ALL_SCOPES,
  checkCredentials,
  getConfigSummary,
};

export default pluginExports;