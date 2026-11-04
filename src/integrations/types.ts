// FASE 1 — Tipos e interface comum para adaptadores de integração

/**
 * Estados possíveis que um adaptador pode retornar em status()/connect()/disconnect().
 * A UI deve usar apenas estes valores e nunca inferir de outros fontes.
 */
export type AdapterStatus =
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'ERROR'
  | 'EXPIRED'
  | 'PENDING'
  | 'REAUTH_REQUIRED';

/** Canais de integração suportados */
export type Channel = 'whatsapp' | 'instagram' | 'facebook' | 'meta';

/** Provedores técnicos por canal */
export type Provider =
  | 'openbsp'        // WhatsApp oficial (Cloud API via OpenBSP)
  | 'evolution'      // WhatsApp não-oficial (Evolution API / QR Code)
  | 'session_login'  // Instagram/Facebook via login de sessão (Playwright)
  | 'oauth_meta';    // Instagram/Facebook via OAuth Meta (Graph API)

/** Modo de conexão */
export type ConnectionMode = 'official' | 'non_official';

/** Features disponíveis por adaptador */
export type Feature =
  | 'templates_hsm'
  | 'messages_template'
  | 'webhooks_status'
  | 'perfil_comercial'
  | 'numero_verificado'
  | 'multi_atendente'
  | 'janela_24h'
  | 'dm_via_graph'
  | 'comentarios_via_graph'
  | 'insights'
  | 'selecao_pagina_facebook'
  | 'qr_code_login'
  | 'qr_code_refresh'
  | 'qr_expiration_monitor'
  | 'health_check'
  | 'sessao_persistida'
  | '2fa_checkpoint'
  | 'validacao_perfil'
  | 'reconexao_automatica'
  | 'long_lived_token'
  | 'token_refresh_agendado'
  | 'pkce_oauth'
  | 'state_signed';

/**
 * Linha da tabela integrations (schema Supabase) — derivada do banco.
 * Usada pela fábrica e repositório.
 */
export interface IntegrationRow {
  id: string;
  user_id: string;
  workspace_id: string; // alias para user_id no contexto multi-tenant
  channel: Channel;
  provider: Provider | null;
  connection_mode: ConnectionMode;
  status: 'disconnected' | 'pending_credentials' | 'connecting' | 'connected' | 'expired' | 'error' | 'archived';
  status_reason: string | null;
  last_checked_at: string | null;
  last_error_at: string | null;
  external_account_id: string | null;
  external_account_label: string | null;
  credentials_ref: string | null;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  meta_account_id: string | null;
  meta_account_name: string | null;
  phone_number: string | null;
  waba_id: string | null;
  meta: Record<string, unknown>;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  mode: 'OFFICIAL' | 'MANUAL'; // legado, mantido até Fase 8
}

/**
 * Interface comum a TODOS os adaptadores de integração.
 * Cada adaptador deve implementar este contrato exato.
 */
export interface IntegrationAdapter {
  /** Verifica se este adaptador corresponde aos parâmetros dados (channel, provider, mode). */
  matches(channel: Channel, provider?: Provider, connectionMode?: ConnectionMode): boolean;

  /** Conecta a integração. Retorna sucesso + status final. */
  connect(organizationId: string, metadata?: Record<string, unknown>): Promise<{
    success: boolean;
    status: AdapterStatus;
    reason?: string;
    data?: Record<string, unknown>;
  }>;

  /**
   * Desconecta a integração.
   * `integrationId` é opcional e uniforme em todos os adaptadores: quem tem o id do
   * registro passa; quem não tem (chamada vinda da UI, por canal) não passa e o
   * adaptador resolve o registro sozinho. Nenhum adaptador pode exigir argumento
   * obrigatório aqui — ver docs/decisions.md §7.
   */
  disconnect(integrationId?: string): Promise<{
    success: boolean;
    status: 'DISCONNECTED';
    reason?: string;
  }>;

  /** Retorna o status atual da integração. */
  status(): Promise<{
    success: boolean;
    status: AdapterStatus;
    reason?: string;
    data?: Record<string, unknown>;
  }>;

  /** Envia mensagem/dado pela integração. */
  send(data: any): Promise<{
    success: boolean;
    error?: string;
  }>;

  /** Verifica se o adaptador tem credenciais configuradas. */
  hasCredentials(): boolean;

  /** Retorna o nome da credencial que precisa ser configurada. */
  neededCredentialName(): string;

  /** Retorna capacidades do adaptador (features, limites, etc.). */
  capabilities(): Record<string, unknown>;
}

/**
 * Retorno do checkAdapterReadiness — indica se o adaptador pode operar.
 */
export type AdapterReadiness = {
  ready: boolean;
  pending?: string; // O que falta para ficar pronto
  error?: string; // Erro interno (nunca vaza detalhes técnicos)
};

/**
 * Relatório de diagnóstico para o bloco "Diagnóstico" da UI.
 * Todas as strings são amigáveis — nenhum stack trace, nenhum termo técnico puro.
 */
export type DiagnosticReport = {
  mode: string; // 'OFFICIAL' | 'MANUAL'
  provider: string; // 'openbsp' | 'evolution' | 'session_login' | 'oauth_meta' | 'undefined'
  recommendedAdapter: string; // Nome legível do adaptador
  credentialsStatus: 'configured' | 'pending' | 'missing'; // Para a UI exibir
  needsApiOfficial: boolean; // Se a feature exigir API oficial
};

/**
 * Configuração mínima que a UI passa para o adaptador na hora de conectar.
 */
export type AdapterConnectInput = {
  organizationId: string;
  // Dados opcionais dependendo do adaptador (ex.: credenciais preliminares)
  metadata?: Record<string, unknown>;
};

/**
 * Dados que a UI exibe após uma conexão bem-sucedida.
 */
export type ConnectionData = {
  status: AdapterStatus;
  provider: string;
  mode: string;
  channel: string;
  externalAccountLabel: string | null; // Número WhatsApp, @handle IG, page_name FB
  connectedAt: Date | null;
  expiresAt?: Date | null;
};

/** Eventos que podem ser registrados em integration_events */
export type IntegrationEventType =
  | 'connection_success'
  | 'connection_failed'
  | 'disconnection'
  | 'credential_renewal'
  | 'mode_switch'
  | 'error';

export interface IntegrationEvent {
  event_id: string;
  integration_id: string;
  event_type: IntegrationEventType;
  payload_hash: string;
  processed_at: string;
  meta_event_id?: string;
}

/** Erro tipado para combinação inválida de canal/provider/modo */
export class UnsupportedIntegrationError extends Error {
  constructor(
    public readonly channel: Channel,
    public readonly provider: Provider | null,
    public readonly connectionMode: ConnectionMode
  ) {
    super(`Combinação inválida: channel=${channel}, provider=${provider}, mode=${connectionMode}`);
    this.name = 'UnsupportedIntegrationError';
  }
}

/** Erro tipado para integração arquivada */
export class ArchivedIntegrationError extends Error {
  constructor(public readonly integrationId: string) {
    super(`Integração ${integrationId} está arquivada (deleted_at preenchido)`);
    this.name = 'ArchivedIntegrationError';
  }
}

/** Erro tipado para OAuth Meta desligado */
export class MetaOAuthDisabledError extends Error {
  constructor(public readonly channel: Channel) {
    super(`ENABLE_META_OAUTH desligado — não disponível para ${channel}`);
    this.name = 'MetaOAuthDisabledError';
  }
}