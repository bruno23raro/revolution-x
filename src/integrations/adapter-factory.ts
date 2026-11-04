// FASE 1 — Factory de Adaptadores de Integração
// Resolve o adaptador baseado em (channel, provider, connection_mode).

import type {
  IntegrationAdapter,
  Channel,
  Provider,
  ConnectionMode,
  IntegrationRow,
  AdapterReadiness,
  DiagnosticReport,
} from './types';
import {
  UnsupportedIntegrationError,
  ArchivedIntegrationError,
  MetaOAuthDisabledError,
} from './types';
import { OfficialWhatsAppAdapter } from './openbsp/adapter';
import { MetaOAuthAdapter } from './meta/oauth-adapter';
import { validateProviderMode, isMetaOAuthEnabled } from './capabilities';

/** Registro tipado exaustivo: `${Channel}:${Provider}` → factory function */
const ADAPTER_REGISTRY: Record<string, (client: any) => IntegrationAdapter> = {
  'whatsapp:openbsp': (client) => new OfficialWhatsAppAdapter(client),
  'instagram:oauth_meta': (client) => new MetaOAuthAdapter(client, 'instagram'),
  'facebook:oauth_meta': (client) => new MetaOAuthAdapter(client, 'facebook'),
  'meta:oauth_meta': (client) => new MetaOAuthAdapter(client, 'meta'),
  // EvolutionWhatsAppAdapter e SessionLoginAdapter serão implementados nas Fases 3-5
  // 'whatsapp:evolution': (client) => new EvolutionWhatsAppAdapter(client),
  // 'instagram:session_login': (client) => new SessionLoginAdapter(client, 'instagram'),
  // 'facebook:session_login': (client) => new SessionLoginAdapter(client, 'facebook'),
};

/**
 * Cria o adaptador correto a partir de uma linha da tabela integrations.
 * Valida coerência provider↔modo, flag ENABLE_META_OAUTH e estado arquivado.
 */
export function createIntegrationAdapter(
  row: IntegrationRow,
  client: any
): IntegrationAdapter {
  // 1. Registro arquivado
  if (row.deleted_at) {
    throw new ArchivedIntegrationError(row.id);
  }

  // 2. Validação de coerência provider ↔ modo
  validateProviderMode(row.channel, row.provider, row.connection_mode);

  // 3. OAuth Meta requer flag habilitada
  if (
    row.provider === 'oauth_meta' &&
    !isMetaOAuthEnabled(row.channel)
  ) {
    throw new MetaOAuthDisabledError(row.channel);
  }

  // 4. Resolver factory no registro
  const key = `${row.channel}:${row.provider}`;
  const adapterFactory = ADAPTER_REGISTRY[key];

  if (!adapterFactory) {
    throw new UnsupportedIntegrationError(
      row.channel,
      row.provider as Provider,
      row.connection_mode
    );
  }

  // 5. Instanciar adaptador via factory
  return adapterFactory(client);
}

/**
 * Verifica se o adaptador tem credenciais suficientes.
 * Nunca lança exceção — retorna pending_credentials se faltar.
 */
export function checkAdapterReadiness(
  adapter: IntegrationAdapter,
): AdapterReadiness {
  try {
    const capabilities = (adapter as any).capabilities?.();
    if (capabilities?.needsCredentials === false) {
      return { ready: true };
    }
    if (!((adapter as any).hasCredentials?.())) {
      return {
        ready: false,
        pending: `Credenciais não configuradas`,
      };
    }
    return { ready: true };
  } catch (e) {
    return { ready: false, error: e instanceof Error ? e.message : 'Erro desconhecido' };
  }
}

/**
 * Gera relatório de diagnóstico para o bloco "Diagnóstico" da UI.
 * Nunca retorna stack trace ou erro interno — sempre strings amigáveis.
 */
export function generateDiagnosticReport(
  channel: Channel,
  provider: Provider | undefined,
  connection_mode: ConnectionMode,
): DiagnosticReport {
  const cm = connection_mode.toUpperCase() as 'OFFICIAL' | 'MANUAL';
  const pr = provider || '';

  let recommended = 'unknown';
  let needsApiOfficial = false;
  let credentialsStatus: 'configured' | 'pending' | 'missing' = 'pending';

  if (channel === 'whatsapp') {
    if ((provider && provider === 'openbsp') || cm === 'OFFICIAL') {
      recommended = 'OfficialWhatsAppAdapter (OpenBSP)';
      needsApiOfficial = true;
      credentialsStatus = provider ? 'configured' : 'pending';
    } else if (provider === 'evolution') {
      recommended = 'EvolutionWhatsAppAdapter';
      credentialsStatus = 'pending';
    } else if (provider === 'session_login') {
      recommended = 'SessionLoginAdapter';
      credentialsStatus = 'pending';
    } else {
      recommended = 'OpenBSP (OFICIAL) ou Evolution (MANUAL)';
      credentialsStatus = 'pending';
    }
  }

  if (channel === 'instagram') {
    if (provider === 'oauth_meta' || cm === 'OFFICIAL') {
      recommended = 'MetaOAuthAdapter (Instagram OAuth)';
      credentialsStatus = 'pending';
    } else {
      recommended = 'SessionLoginAdapter (Instagram session)';
      credentialsStatus = 'pending';
    }
  }

  if (channel === 'facebook') {
    if (provider === 'oauth_meta' || cm === 'OFFICIAL') {
      recommended = 'MetaOAuthAdapter (Facebook OAuth)';
      credentialsStatus = 'pending';
    } else {
      recommended = 'SessionLoginAdapter (Facebook session)';
      credentialsStatus = 'pending';
    }
  }

  if (channel === 'meta') {
    if (provider === 'oauth_meta' || cm === 'OFFICIAL') {
      recommended = 'MetaOAuthAdapter (Meta OAuth)';
      credentialsStatus = 'pending';
    } else {
      recommended = 'SessionLoginAdapter (Meta session)';
      credentialsStatus = 'pending';
    }
  }

  return {
    mode: cm,
    provider: pr || 'undefined',
    recommendedAdapter: recommended,
    credentialsStatus,
    needsApiOfficial,
  };
}

/**
 * Gera relatório simplificado para o card de integração.
 */
export function cardDiagnosticSummary(
  channel: Channel,
  provider: Provider | undefined,
  connection_mode: ConnectionMode,
): {
  modeBadge: string; // 'OFICIAL' | 'MANUAL' com cor apropriada
  providerLabel: string;
  statusLabel: string;
  needsCredentials: boolean;
  credentialsNote: string;
} {
  const pr = (provider || '').toLowerCase().trim();
  const cm = connection_mode.toUpperCase() as 'OFFICIAL' | 'MANUAL';

  let modeBadge = 'OFICIAL';
  let providerLabel = 'OpenBSP';
  let statusLabel = 'Desconectado';
  let needsCredentials = false;
  let credentialsNote = '';

  if (channel === 'whatsapp') {
    if (pr === 'openbsp' || cm === 'OFFICIAL') {
      modeBadge = 'OFICIAL';
      providerLabel = 'OpenBSP';
      statusLabel = 'Desconectado';
      needsCredentials = true;
      credentialsNote = 'Configure OPENBSP_API_KEY e OPENBSP_BASE_URL';
    } else if (pr === 'evolution') {
      modeBadge = 'MANUAL';
      providerLabel = 'Evolution';
      statusLabel = 'Desconectado — Gere QR Code';
      needsCredentials = true;
      credentialsNote = 'Configure a instância da Evolution';
    } else if (pr === 'session_login') {
      modeBadge = 'MANUAL';
      providerLabel = 'Session Login';
      statusLabel = 'Desconectado — Faça login';
      needsCredentials = true;
      credentialsNote = 'Email e senha do provedor';
    } else {
      modeBadge = 'INDETERMINADO';
      providerLabel = 'Não identificado';
      statusLabel = 'Sem configuração';
      needsCredentials = true;
      credentialsNote = 'Selecione um provedor';
    }
  }

  if (channel === 'instagram') {
    if (pr === 'oauth_meta' || cm === 'OFFICIAL') {
      modeBadge = 'OFICIAL';
      providerLabel = 'Meta OAuth';
      statusLabel = 'Desconectado';
      needsCredentials = true;
      credentialsNote = 'Habilite ENABLE_META_OAUTH ou faça login';
    } else {
      modeBadge = 'MANUAL';
      providerLabel = 'Session Login';
      statusLabel = 'Desconectado — Faça login';
      needsCredentials = true;
      credentialsNote = 'Email e senha do Instagram';
    }
  }

  if (channel === 'facebook') {
    if (pr === 'oauth_meta' || cm === 'OFFICIAL') {
      modeBadge = 'OFICIAL';
      providerLabel = 'Meta OAuth';
      statusLabel = 'Desconectado';
      needsCredentials = true;
      credentialsNote = 'Habilite ENABLE_META_OAUTH ou faça login';
    } else {
      modeBadge = 'MANUAL';
      providerLabel = 'Session Login';
      statusLabel = 'Desconectado — Faça login';
      needsCredentials = true;
      credentialsNote = 'Email e senha do Facebook';
    }
  }

  if (channel === 'meta') {
    if (pr === 'oauth_meta' || cm === 'OFFICIAL') {
      modeBadge = 'OFICIAL';
      providerLabel = 'Meta OAuth';
      statusLabel = 'Desconectado';
      needsCredentials = true;
      credentialsNote = 'Habilite ENABLE_META_OAUTH ou faça login';
    } else {
      modeBadge = 'MANUAL';
      providerLabel = 'Session Login';
      statusLabel = 'Desconectado — Faça login';
      needsCredentials = true;
      credentialsNote = 'Email e senha do Meta';
    }
  }

  return {
    modeBadge,
    providerLabel,
    statusLabel,
    needsCredentials,
    credentialsNote,
  };
}