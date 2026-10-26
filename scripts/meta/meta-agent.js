// Meta Agent - Integração e Gestão de Apps Meta
// Este agente gerencia todas as operações de integração Meta usando as credenciais fornecidas.

import { execute } from '@cloudflare/cli';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Credenciais fixas para esta automação
const META_APP_ID = '1112157761403064';
const META_APP_SECRET = 'ff2edcdec00e1e843433b860c717a3ab';
const DEFAULT_ORIGIN = 'https://revolutionx.com.br';

// Escopos padrão
const DEFAULT_SCOPES = [
  'pages_show_list',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
  'business_management',
  'whatsapp_business_messaging',
];

// Estado global para tracking de operações
const operationLog = {
  operations: [],
  log(message: string) {
    const timestamp = new Date().toISOString();
    this.operations.push({ timestamp, message });
    console.log(`[${timestamp}] ${message}`);
  },
  getLastOperations(n: number = 5) {
    return this.operations.slice(-n);
  }
};

// Gerar state OAuth seguro (CSPRNG)
function generateOAuthState(): string {
  const cryptoImpl =
    (globalThis as any).crypto || (globalThis as any).msCrypto;
  if (cryptoImpl && cryptoImpl.randomBytes) {
    return cryptoImpl.randomBytes(24).toString('base64url');
  }
  return require('crypto').randomBytes(24).toString('base64url');
}

// Validar callback OAuth da Meta
function validateOAuthCallback(query: URLSearchParams, expectedState: string): {
  code: string;
  stateMatch: boolean;
  error?: string
} {
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

  return { code, stateMatch: true };
}

// Construir URL de autorização OAuth v26.0
function buildMetaAuthUrl(config: { appId: string; redirectUri: string; scopes: string[] }, state: string, provider: 'whatsapp' | 'instagram' | 'facebook'): string {
  const base = 'https://www.facebook.com/v26.0/dialog/oauth';
  const scopes = config.scopes.join(',');
  return `${base}?client_id=${config.appId}&redirect_uri=${encodeURIComponent(config.redirectUri)}&state=${state}&scope=${encodeURIComponent(scopes)}`;
}

// Exchange do código OAuth por tokens
async function exchangeOAuthCodeForTokens(code: string, config: { appId: string; appSecret: string; redirectUri: string }): Promise<{ accessToken: string; expiresIn?: number; wabaId?: string; phoneNumberId?: string; error?: string }> {
  const fetchImpl = (globalThis as any).fetch;
  if (!fetchImpl) {
    return { error: 'Fetch not available', accessToken: '' };
  }

  const url = new URL('https://graph.facebook.com/v26.0/oauth/access_token');
  const params = new URLSearchParams({
    client_id: config.appId,
    client_secret: config.appSecret,
    code,
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

// Refresh de token via fb_exchange_token
async function refreshMetaAccessToken(
  appId: string,
  appSecret: string,
  exchangeToken: string
): Promise<{ ok: boolean; accessToken?: string; expiresIn?: number; error?: string }> {
  const fetchImpl = (globalThis as any).fetch;
  if (!fetchImpl) {
    return { ok: false, error: 'Fetch not available' };
  }

  const base = 'https://graph.facebook.com'.replace(/^\/+/, '');
  const version = 'v26.0';
  const qs = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: exchangeToken,
  }).toString();
  const url = `${base}/${version}/oauth/access_token?${qs}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);

  try {
    const response = await fetchImpl(url, { method: 'GET', signal: ctrl.signal });
    const parsed = (await response.json()) as { access_token?: string; expires_in?: number; error?: { message?: string } };

    if (response.ok && parsed.access_token) {
      return { ok: true, accessToken: parsed.access_token, expiresIn: parsed.expires_in };
    }

    return { ok: false, error: parsed.error?.message ?? `HTTP ${response.status}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: 'network_error', errorDetail: msg };
  } finally {
    clearTimeout(timer);
  }
}

// Dados seguros para exibição (nunca expõe tokens puros)
function getSafeConnectionData(connectionId: string, status: string, provider: string, displayName: string | null, phoneNumberId: string | null, wabaId: string | null, connectedAt: Date, expiresAt?: Date) {
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

// Listar contas Meta conectadas para uma organização
async function listTenantWhatsAppAccounts(organizationId: string): Promise<{ ok: true; accounts: any[]; displayNameAvailable: boolean } | { ok: false; reason: string }> {
  // Integrar com Supabase service role client
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from('meta_integrations')
      .select('id, provider, phone_number_id, whatsapp_business_account_id, meta_app_id, status, connected_at, display_name')
      .eq('organization_id', organizationId)
      .in('provider', ['whatsapp', 'facebook'])
      .neq('status', 'DISCONNECTED')
      .order('connected_at', { ascending: false });

    if (error) throw new Error(String(error.message ?? error));

    if (!data || data.length === 0) {
      return { ok: false, reason: 'not_connected' };
    }

    const accounts = data.map((r: any) => ({
      id: r.id,
      provider: r.provider,
      displayName: r.display_name ?? null,
      phoneNumberId: r.phone_number_id ?? null,
      whatsappBusinessAccountId: r.whatsapp_business_account_id ?? null,
      status: r.status,
    }));

    return { ok: true, accounts, displayNameAvailable: !!data[0]?.display_name };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { ok: false, reason: 'query_failed' };
  }
}

// Processar callback OAuth completo
async function processOAuthCallback(
  query: URLSearchParams,
  expectedState: string,
  organizationId: string,
  origin: string
): Promise<{
  success: boolean;
  code?: string;
  error?: string;
  connectionState?: {
    status: string;
    wabaId: string | null;
    phoneNumberId: string | null;
    displayName: string | null;
  };
}> {
  const { code, stateMatch, error: callbackError } = validateOAuthCallback(
    query,
    expectedState
  );

  if (!code) {
    return { success: false, error: callbackError || 'Missing code' };
  }

  // Exchange code por tokens
  const redirectUri = `${origin}/api/auth/callback/meta`;

  const config: { appId: string; appSecret: string; redirectUri: string } = {
    appId: META_APP_ID,
    appSecret: META_APP_SECRET,
    redirectUri,
  };

  const tokenResult = await exchangeOAuthCodeForTokens(code, config, redirectUri);

  if (tokenResult.error) {
    return { success: false, error: tokenResult.error };
  }

  // Montar estado da conexão
  const connectionState = {
    status: tokenResult.error ? 'ERROR' : 'CONNECTED',
    wabaId: tokenResult.wabaId || null,
    phoneNumberId: tokenResult.phoneNumberId || null,
    displayName: null,
  };

  return {
    success: true,
    code,
    connectionState,
  };
}

// Publicar post no Facebook Page
async function publishFacebookPagePost(
  facebookPageId: string,
  accessToken: string,
  spec: {
    message?: string;
    link?: string;
    scheduledAt?: string;
  },
  opts?: {
    timeoutMs?: number;
    apiBase?: string;
    version?: string;
  }
): Promise<{
  ok: boolean;
  postId?: string;
  error?: string;
  errorDetail?: string;
  scheduled?: boolean;
}> {
  const fetchImpl = (globalThis as any).fetch;
  if (!fetchImpl) {
    return { ok: false, error: 'fetch_unavailable' };
  }

  const BASE_URL = 'https://graph.facebook.com';
  const DEFAULT_VERSION = 'v26.0';
  const base = (opts?.apiBase ?? BASE_URL).replace(/^\/+\/\//, '');
  const version = opts?.version ?? DEFAULT_VERSION;

  const payload: Record<string, unknown> = {};
  if (spec.message?.trim()) payload.message = spec.message.trim();
  if (spec.link?.trim()) payload.link = spec.link.trim();

  // Handle scheduling
  if (spec.scheduledAt) {
    const ms = new Date(spec.scheduledAt).getTime();
    if (!Number.isNaN(ms)) {
      const scheduledStart = Math.floor(ms / 1000);
      if (scheduledStart > 0) {
        payload.published = false;
        payload.scheduled_publish_time = scheduledStart;
        payload.unpublished_content_type = 'SCHEDULED';
      }
    }
  }

  if (!payload.message && !payload.link) {
    return { ok: false, error: 'no_content_source' };
  }

  const url = `${base}/${version}/${facebookPageId}/feed`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts?.timeoutMs ?? 20000);

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });

    const parsed = (await response.json()) as { id?: string; error?: { message?: string; code?: number } };

    if (response.ok) {
      return { ok: true, postId: parsed.id, scheduled: !!spec.scheduledAt };
    }

    const detail = parsed.error?.message
      ? `${parsed.error.code ?? response.status}: ${parsed.error.message}`
      : `HTTP ${response.status}`;

    return { ok: false, error: 'http_error', errorDetail: detail };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: 'network_error', errorDetail: msg };
  } finally {
    clearTimeout(timer);
  }
}

// Inicializar agente - verificar configurações
async function init(): Promise<void> {
  console.log('🤖 Meta Agent - Inicializando integração Meta');
  console.log('============================================');
  console.log('');

  // Verificar variáveis de ambiente
  const missing: string[] = [];

  if (!process.env.META_APP_ID) missing.push('META_APP_ID');
  if (!process.env.META_APP_SECRET) missing.push('META_APP_SECRET');
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  if (missing.length > 0) {
    console.log('⚠️  Variáveis de ambiente faltando:');
    missing.forEach(m => console.log(`   - ${m}`));
    console.log('');
    console.log('Execute `meta init` para criar .env.example ou configure no Hostinger.');
    console.log('');
  } else {
    console.log('✅ Todas as variáveis de ambiente estão configuradas');
    console.log(`   META_APP_ID: ${process.env.META_APP_ID}`);
    console.log(`   META_APP_SECRET: [mascarado]`);
    console.log(`   NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
    console.log('');
  }

  // Verificar conexão Supabase
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Testar conexão simples
    const { data, error } = await supabase.from('meta_integrations').select('count').limit(1);

    if (error) throw error;
    console.log('✅ Conexão Supabase OK - pode consultar meta_integrations');
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.log('❌ Erro ao conectar Supabase:', error.message);
  }

  console.log('');
  console.log('📋 Comandos disponíveis:');
  console.log('   list-accounts <org-id>       - Listar contas conectadas');
  console.log('   start-oauth <provider>       - Iniciar OAuth flow');
  console.log('   check-status <org-id>        - Verificar status');
  console.log('   refresh-token <org-id>       - Refresh automático');
  console.log('   publish <page-id>            - Publicar post');
  console.log('   help                         - Mostrar ajuda');
  console.log('');
}

// Exportar funções para uso externo
export type {
  MetaAppCreds,
  RefreshResult,
  RefreshOptions,
  MetaIntegrationRow,
  ResolveResult,
  ResolveDeps,
  OAuthState,
  MetaAuthConfig,
  WhatsAppConnectionState,
  OAuthCallbackResult,
  InstagramTokenSet,
  PagePostResult,
  FbPubOptions,
  FbPubError,
  CreatePagePostSpec,
  FacebookPageAccess,
  SafeConnectionData,
};

export {
  init,
  generateOAuthState,
  buildMetaAuthUrl,
  validateOAuthCallback,
  exchangeOAuthCodeForTokens,
  refreshMetaAccessToken,
  getSafeConnectionData,
  listTenantWhatsAppAccounts,
  processOAuthCallback,
  publishFacebookPagePost,
  DEFAULT_SCOPES,
};

// Se executado diretamente, inicializar
if (require.main === module) {
  init().catch((err) => {
    console.error('❌ Erro fatal:', err);
    process.exit(1);
  });
}