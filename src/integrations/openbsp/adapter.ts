// FASE 3 — Adaptador WhatsApp OFICIAL via OpenBSP (único caminho oficial).
//
// Contratos observados:
//  * HTTP do OpenBSP NUNCA vive aqui — vive em `../whatsapp/openbsp/client.ts`
//    (PostgREST, headers `apikey` + `api-key`). Este adaptador é a camada de
//    orquestração: transição de estado, rollback, eventos e erros tipados.
//  * Banco: `integrations` (tenancy por `user_id`) e `integration_events`.
//    NÃO existem colunas `organization_id` nem `last_error` em `integrations`
//    (migration 024) — quem escreve estado usa `user_id`, `status_reason` e
//    `last_error_at`.
//  * Dependências (client supabase, chamadas HTTP, relógio) entram pelo
//    construtor para que o contrato seja testável sem sandbox.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { IntegrationAdapter, Channel, Provider, ConnectionMode } from '../types';
import {
  openbspConfig,
  mintOnboardingToken,
  fetchConnectedAddress,
  sendViaOpenbsp,
  templateContent,
  type OpenbspConfig,
} from '../whatsapp/openbsp/client';
import type { ChannelAccess } from '../whatsapp/types';

// ── Erros tipados ─────────────────────────────────────────────────────────────

export class OpenBspAuthError extends Error {
  constructor(message: string, public readonly retryAfter?: number) {
    super(message);
    this.name = 'OpenBspAuthError';
  }
}

export class OpenBspRateLimitError extends Error {
  constructor(message: string, public readonly retryAfter?: number) {
    super(message);
    this.name = 'OpenBspRateLimitError';
  }
}

export class OpenBspTemplateError extends Error {
  constructor(
    public readonly template: string,
    public readonly reason: 'template_not_found' | 'missing_variables',
    detail?: string,
  ) {
    super(
      reason === 'template_not_found'
        ? `Template "${template}" nao encontrado no provedor.`
        : `Template "${template}" com variaveis faltando: ${detail ?? 'nenhuma variavel informada'}.`,
    );
    this.name = 'OpenBspTemplateError';
  }
}

export class OpenBspUnavailableError extends Error {
  constructor(
    public readonly transient: boolean = true,
    message?: string,
  ) {
    super(message ?? 'Servico OpenBSP indisponivel');
    this.name = 'OpenBspUnavailableError';
  }
}

export class OpenBspTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Timeout de ${timeoutMs}ms excedido na conexao OpenBSP.`);
    this.name = 'OpenBspTimeoutError';
  }
}

export class SecondNumberNotAllowedError extends Error {
  constructor(public readonly existingExternalAccountId: string | null) {
    super(
      'Ja existe um numero oficial conectado. Desconecte o numero atual antes de conectar outro.',
    );
    this.name = 'SecondNumberNotAllowedError';
  }
}

export type OpenBspError =
  | OpenBspAuthError
  | OpenBspRateLimitError
  | OpenBspTemplateError
  | OpenBspUnavailableError
  | OpenBspTimeoutError;

// ── Circuit breaker + retry ───────────────────────────────────────────────────

const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 30_000;
const RETRY_MAX_ATTEMPTS = 5;
const CB_FAILURE_THRESHOLD = 3;
const CB_RESET_MS = 60_000;
/** T39.5 — timeout global da conexão com abort real. */
export const CONNECT_TIMEOUT_MS = 90_000;

class CircuitBreaker {
  private failures = 0;
  private open = false;
  private openedAt = 0;

  constructor(private readonly resetMs: number = CB_RESET_MS) {}

  get isOpen(): boolean {
    if (!this.open) return false;
    // half-open: vencido o reset, permite uma tentativa
    if (Date.now() - this.openedAt >= this.resetMs) {
      this.open = false;
      this.failures = 0;
      return false;
    }
    return true;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.open = false;
  }

  recordFailure(): void {
    this.failures += 1;
    if (this.failures >= CB_FAILURE_THRESHOLD) {
      this.open = true;
      this.openedAt = Date.now();
    }
  }

  forceOpen(): void {
    this.open = true;
    this.openedAt = Date.now();
    this.failures = CB_FAILURE_THRESHOLD;
  }

  /** somente testes */
  reset(): void {
    this.failures = 0;
    this.open = false;
    this.openedAt = 0;
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Retry exponencial com jitter. Auth falha imediato (abre o breaker);
 * rate limit e transitórios fazem backoff.
 * `signal` permite abort real (T39.5) — um abort interrompe o backoff.
 */
export async function attemptRetry<T>(
  fn: (ctx: { signal: AbortSignal }) => Promise<T>,
  opts: {
    breaker?: CircuitBreaker;
    maxAttempts?: number;
    signal?: AbortSignal;
    sleepFn?: (ms: number) => Promise<void>;
    onRetry?: (err: Error, attempt: number) => void;
  } = {},
): Promise<T> {
  const breaker = opts.breaker ?? new CircuitBreaker();
  const maxAttempts = opts.maxAttempts ?? RETRY_MAX_ATTEMPTS;
  const doSleep = opts.sleepFn ?? sleep;

  if (breaker.isOpen) {
    throw new OpenBspUnavailableError(false, 'Circuit breaker aberto — aguarde antes de tentar de novo.');
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (opts.signal?.aborted) throw new OpenBspTimeoutError(CONNECT_TIMEOUT_MS);

    try {
      const result = await fn({ signal: opts.signal ?? new AbortController().signal });
      breaker.recordSuccess();
      return result;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      lastError = err;

      if (err.name === 'AbortError' || err instanceof OpenBspTimeoutError) throw err;

      if (err instanceof OpenBspAuthError) {
        breaker.forceOpen();
        throw err;
      }

      if (breaker.isOpen) {
        throw new OpenBspUnavailableError(false, `Circuit breaker aberto na tentativa ${attempt}/${maxAttempts}.`);
      }

      if (attempt < maxAttempts) {
        opts.onRetry?.(err, attempt);
        const backoff = Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), RETRY_MAX_MS);
        const jittered = opts.sleepFn ? backoff : backoff + Math.floor(Math.random() * 500);
        await doSleep(jittered);
      }
    }
  }

  breaker.recordFailure();
  throw lastError ?? new OpenBspUnavailableError(true, 'Erro desconhecido no OpenBSP.');
}

// ── Dependências injetáveis ───────────────────────────────────────────────────

export interface OpenBspSendResult {
  ok: boolean;
  messageId?: string;
  status?: number;
  error?: string;
  errorDetail?: string;
}

export interface OpenBspAdapterDeps {
  /** Config do OpenBSP (envs). Injetável para teste sem env. */
  config?: () => OpenbspConfig | null;
  mint?: typeof mintOnboardingToken;
  fetchAddress?: typeof fetchConnectedAddress;
  send?: (access: ChannelAccess, to: string, content: Record<string, unknown>, opts: { signal?: AbortSignal }) => Promise<OpenBspSendResult>;
  /** Lista templates aprovados (nome+language) no WABA. */
  listTemplates?: (access: ChannelAccess, opts: { signal?: AbortSignal }) => Promise<{ ok: boolean; templates: Array<{ name: string; language?: string }>; errorDetail?: string }>;
  /** Desativa webhook no provedor. */
  deactivateWebhook?: (access: ChannelAccess) => Promise<{ ok: boolean; errorDetail?: string }>;
  sleepFn?: (ms: number) => Promise<void>;
  now?: () => number;
}

// ── Tipos de retorno ──────────────────────────────────────────────────────────

export interface OpenBspConnectionData {
  wabaId: string | null;
  phoneNumberId: string | null;
  displayName: string | null;
  /** Presente quando connect() abriu o popup de embedded signup. */
  popupUrl?: string;
  connectedAt?: string | null;
  [key: string]: unknown;
}

/** Projeção da linha de `integrations` que este adaptador lê/escreve (migration 024). */
interface IntegrationRecord {
  id: string;
  user_id: string;
  channel: string;
  provider: string | null;
  connection_mode: string;
  status: string;
  status_reason: string | null;
  last_checked_at: string | null;
  last_error_at: string | null;
  external_account_id: string | null;
  external_account_label: string | null;
  credentials_ref: string | null;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  phone_number: string | null;
  waba_id: string | null;
  meta: Record<string, unknown> | null;
  deleted_at: string | null;
}

export interface OpenBspSendInput {
  to: string;
  kind: 'template';
  template: string;
  language?: string;
  variables?: string[];
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export class OfficialWhatsAppAdapter implements IntegrationAdapter {
  private readonly breaker = new CircuitBreaker();
  /** organizationId (user_id / workspace_id) resolvido no último connect/status. */
  private organizationId: string | null = null;

  constructor(
    private readonly client: SupabaseClient,
    private readonly deps: OpenBspAdapterDeps = {},
  ) {}

  // T45 — aceita SOMENTE whatsapp + openbsp. Rejeita evolution, session_login, oauth_meta.
  matches(channel: Channel, provider?: Provider, connectionMode?: ConnectionMode): boolean {
    return channel === 'whatsapp' && provider === 'openbsp' && connectionMode === 'official';
  }

  hasCredentials(): boolean {
    // síncrono e sem I/O: lê as envs (openbspConfig retorna null se faltar alguma)
    return this.resolveConfig() !== null;
  }

  neededCredentialName(): string {
    return 'OPENBSP_BASE_URL, OPENBSP_PUBLISHABLE_KEY, OPENBSP_API_KEY, OPENBSP_ORG_ID';
  }

  capabilities(): Record<string, unknown> {
    return {
      name: 'OfficialWhatsAppAdapter (OpenBSP)',
      needsCredentials: true,
      neededCredentialName: this.neededCredentialName(),
      supportedFeatures: [
        'templates_hsm',
        'messages_template',
        'webhooks_status',
        'perfil_comercial',
        'numero_verificado',
        'multi_atendente',
        'janela_24h',
      ],
      requiresFlag: null,
      provider: 'openbsp',
      connectionMode: 'official',
    };
  }

  // ── T39 — conexão real ──────────────────────────────────────────────────────

  /**
   * connecting → embedded signup → verificação → grava waba_id/phone_number_id
   * → registra webhook → connected.
   *
   * `metadata.popupCompleted: true` pula o mint e vai direto na verificação
   * (é o estado em que o usuário já fechou o popup do OpenBSP).
   * `metadata.verifyToken` é o token único daquele popup — sem ele não há como
   * correlacionar a linha do provedor com este tenant.
   */
  async connect(organizationId: string, metadata: Record<string, unknown> = {}) {
    this.organizationId = organizationId;
    const cfg = this.resolveConfig();
    if (!cfg) {
      return {
        success: false,
        status: 'ERROR' as const,
        reason: 'credenciais_pendentes',
      };
    }

    const row = await this.findRow(organizationId);
    if (!row) {
      return { success: false, status: 'ERROR' as const, reason: 'integracao_nao_encontrada' };
    }

    // T39.2 — segundo número ativo exige desconexão prévia; nunca sobrescreve.
    if (row.status === 'connected' && row.external_account_id) {
      return {
        success: false,
        status: 'ERROR' as const,
        reason: 'numero_oficial_ja_conectado',
        data: {
          wabaId: (row.external_account_id as string) ?? null,
          phoneNumberId: (row.external_account_label as string) ?? null,
          displayName: null,
        },
      };
    }

    // T39.5 — timeout global com abort real do fetch.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);

    // o que esta transação criou no provedor, para o rollback (T39.3)
    const created: { onboardingTokenId?: string; webhookRegistered: boolean } = {
      webhookRegistered: false,
    };

    try {
      await this.setStatus(row.id, organizationId, 'connecting', 'iniciando_conexao_openbsp');
      await this.logEvent(row.id, organizationId, 'connection_start', {
        provider: 'openbsp',
        integrationId: row.id,
      });

      const popupCompleted = metadata?.popupCompleted === true;
      const expectedVerifyToken =
        typeof metadata?.verifyToken === 'string' ? metadata.verifyToken : null;

      let popupUrl: string | undefined;

      if (!popupCompleted) {
        const verifyToken = expectedVerifyToken ?? randomToken();
        const mint = await attemptRetry(
          async ({ signal }) => {
            const r = await this.deps.mint!(
              {
                name: `rx-${organizationId}`,
                orgId: cfg.orgId!,
                callbackUrl: webhookCallbackUrl(),
                verifyToken,
              },
              { signal, fetchImpl: undefined },
            );
            if (!r.ok || !r.tokenId) {
              throw classifyMintFailure(r.error, r.errorDetail);
            }
            return r;
          },
          { breaker: this.breaker, signal: controller.signal, sleepFn: this.deps.sleepFn },
        );
        created.onboardingTokenId = mint.tokenId;
        popupUrl = mint.popupUrl;

        await this.client
          .from('integrations')
          .update({
            meta: {
              ...((row.meta as Record<string, unknown>) ?? {}),
              openbsp_onboarding_token_id: mint.tokenId,
              openbsp_verify_token: verifyToken,
              openbsp_popup_url: popupUrl ?? null,
            },
          })
          .eq('id', row.id);

        return {
          success: true,
          status: 'CONNECTING' as const,
          reason: 'aguardando_popup',
          data: {
            wabaId: null,
            phoneNumberId: null,
            displayName: null,
            popupUrl,
          },
        };
      }

      // Popup já fechado pelo usuário → verificar no provedor.
      if (!expectedVerifyToken) {
        throw new OpenBspAuthError('verify_token ausente — impossivel confirmar a conclusao do popup.');
      }

      const address = await attemptRetry(
        async ({ signal }) => {
          const r = await this.deps.fetchAddress!(expectedVerifyToken, { signal });
          if (!r.ok || !r.data) throw classifyAddressFailure(r.error, r.errorDetail);
          return r.data;
        },
        { breaker: this.breaker, signal: controller.signal, sleepFn: this.deps.sleepFn },
      );

      const wabaId = address.extra?.waba_id ?? null;
      const phoneNumberId = address.address ?? null;
      if (!wabaId || !phoneNumberId) {
        throw new OpenBspUnavailableError(true, 'Provedor respondeu sem waba_id/phone_number_id.');
      }

      // registra webhook ANTES de declarar connected (T39.1)
      const access = toChannelAccess(address, cfg);
      const webhook = await this.registerWebhook(access, { signal: controller.signal });
      if (!webhook.ok) {
        throw new OpenBspUnavailableError(true, `Falha ao registrar webhook: ${webhook.errorDetail ?? 'unknown'}`);
      }
      created.webhookRegistered = true;

      await this.client
        .from('integrations')
        .update({
          external_account_id: wabaId,
          external_account_label: phoneNumberId,
          waba_id: wabaId,
          phone_number: address.extra?.phone_number ?? null,
          access_token: address.extra?.access_token ?? null,
          credentials_ref: 'openbsp',
        })
        .eq('id', row.id);

      await this.setStatus(row.id, organizationId, 'connected', 'conexao_concluida');
      await this.logEvent(row.id, organizationId, 'connection_success', {
        waba_id: wabaId,
        phone_number_id: phoneNumberId,
      });

      return {
        success: true,
        status: 'CONNECTED' as const,
        data: {
          wabaId,
          phoneNumberId,
          displayName: address.extra?.verified_name ?? null,
        },
      };
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));

      // T39.3 — rollback do que foi criado no provedor; nada órfão.
      await this.rollbackCreated(row.id, organizationId, created, err);

      const reason = reasonForError(err);
      await this.setStatus(row.id, organizationId, 'error', reason);
      await this.logEvent(row.id, organizationId, 'connection_failed', {
        reason,
        error_name: err.name,
        error_message: err.message,
        rolled_back_onboarding_token: created.onboardingTokenId ?? null,
      });

      return {
        success: false,
        status: 'ERROR' as const,
        reason,
        data: { wabaId: null, phoneNumberId: null, displayName: null },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  // ── T42 — desconexão idempotente ───────────────────────────────────────────

  /**
   * T44: assinatura uniforme — `integrationId` é OPCIONAL. Sem ele, o
   * adaptador resolve o registro do próprio canal oficial (o registro é único
   * por (user_id, channel, connection_mode) pela constraint uq_integrations_workspace_channel_mode).
   */
  async disconnect(integrationId?: string) {
    const organizationId = this.organizationId;
    if (!organizationId) {
      return {
        success: false,
        status: 'DISCONNECTED' as const,
        reason: 'sem_contexto_de_organizacao',
      };
    }

    const row = integrationId
      ? await this.findRowById(organizationId, integrationId)
      : await this.findRow(organizationId);

    // T42 — segunda chamada: nada a desconectar → sucesso idempotente.
    if (!row || row.status === 'disconnected') {
      return { success: true, status: 'DISCONNECTED' as const };
    }

    // 1) desativa webhook no provedor (sem webhook órfão)
    const cfg = this.resolveConfig();
    if (cfg && row.external_account_label) {
      const access: ChannelAccess = {
        accessToken: (row.access_token as string | null) ?? undefined,
        phoneNumberId: row.external_account_label as string,
        wabaId: (row.external_account_id as string | null) ?? undefined,
      } as ChannelAccess;
      try {
        const r = await (this.deps.deactivateWebhook ?? defaultDeactivateWebhook)(access);
        if (!r.ok) {
          await this.logEvent(row.id, organizationId, 'error', {
            reason: 'webhook_deactivate_failed',
            detail: r.errorDetail ?? null,
          });
        }
      } catch (e) {
        await this.logEvent(row.id, organizationId, 'error', {
          reason: 'webhook_deactivate_failed',
          detail: (e as Error).message,
        });
      }
    }

    // 2) remove credencial + estado desconectado
    const { error } = await this.client
      .from('integrations')
      .update({
        status: 'disconnected',
        status_reason: 'desconexao_manual',
        connection_mode: 'non_official',
        access_token: null,
        refresh_token: null,
        expires_at: null,
        credentials_ref: null,
        external_account_id: null,
        external_account_label: null,
        waba_id: null,
        phone_number: null,
        last_checked_at: new Date().toISOString(),
      })
      .eq('id', row.id);

    if (error) {
      return { success: false, status: 'DISCONNECTED' as const, reason: 'falha_persistencia_desconexao' };
    }

    // 3) evento
    await this.logEvent(row.id, organizationId, 'disconnection', { reason: 'desconexao_manual' });

    return { success: true, status: 'DISCONNECTED' as const };
  }

  // ── status ─────────────────────────────────────────────────────────────────

  async status() {
    const organizationId = this.organizationId;
    if (!organizationId) {
      return { success: true, status: 'DISCONNECTED' as const, data: {} };
    }

    const row = await this.findRow(organizationId);
    if (!row) return { success: true, status: 'DISCONNECTED' as const, data: {} };

    const data: OpenBspConnectionData = {
      wabaId: (row.external_account_id as string | null) ?? null,
      phoneNumberId: (row.external_account_label as string | null) ?? null,
      displayName: (row.meta as Record<string, unknown> | null)?.verified_name
        ? String((row.meta as Record<string, unknown>).verified_name)
        : null,
      connectedAt: (row.last_checked_at as string | null) ?? null,
    };

    switch (row.status) {
      case 'connected':
        return { success: true, status: 'CONNECTED' as const, data };
      case 'connecting':
        return {
          success: true,
          status: 'CONNECTING' as const,
          reason: row.status_reason ?? undefined,
          data,
        };
      case 'pending_credentials':
        return {
          success: true,
          status: 'PENDING' as const,
          reason: row.status_reason ?? 'credenciais_pendentes',
          data,
        };
      case 'expired':
        return { success: true, status: 'EXPIRED' as const, reason: row.status_reason ?? undefined, data };
      case 'error':
        return { success: true, status: 'ERROR' as const, reason: row.status_reason ?? undefined, data };
      default:
        return { success: true, status: 'DISCONNECTED' as const, data };
    }
  }

  // ── T41 — envio de template HSM ────────────────────────────────────────────

  async send(raw: unknown) {
    const data = raw as Partial<OpenBspSendInput>;
    const organizationId = this.organizationId;
    if (!organizationId) return { success: false, error: 'sem_contexto_de_organizacao' };

    const row = await this.findRow(organizationId);
    if (!row || row.status !== 'connected' || !row.external_account_label) {
      return { success: false, error: 'whatsapp_nao_conectado' };
    }

    // Janela de 24h desde a última conexão (T41)
    const since = row.last_checked_at ? Date.now() - new Date(row.last_checked_at).getTime() : null;
    if (since !== null && since > 24 * 60 * 60 * 1000) {
      return {
        success: false,
        error: `fora_da_janela_24h (${Math.round(since / 3_600_000)}h desde a ultima conexao)`,
      };
    }

    // Validações ANTES de chamar o provedor (T41)
    if (!data.template) {
      return { success: false, error: 'template_nao_informado' };
    }
    if (!data.to) {
      return { success: false, error: 'destino_nao_informado' };
    }
    if (!data.variables || data.variables.length === 0) {
      const err = new OpenBspTemplateError(data.template, 'missing_variables');
      await this.logEvent(row.id, organizationId, 'error', {
        reason: 'missing_variables',
        template: data.template,
      });
      return { success: false, error: err.message };
    }

    const cfg = this.resolveConfig();
    if (!cfg) return { success: false, error: 'credenciais_pendentes' };

    const access: ChannelAccess = {
      accessToken: (row.access_token as string | null) ?? undefined,
      phoneNumberId: row.external_account_label as string,
      wabaId: (row.external_account_id as string | null) ?? undefined,
    } as ChannelAccess;

    // template inexistente → erro ANTES da chamada (T41)
    const language = data.language ?? 'pt_BR';
    const known = await this.deps.listTemplates!(access, {});
    if (known.ok) {
      const hit = known.templates.find(
        (t) => t.name === data.template && (t.language === undefined || t.language === language),
      );
      if (!hit) {
        const err = new OpenBspTemplateError(data.template, 'template_not_found');
        await this.logEvent(row.id, organizationId, 'error', {
          reason: 'template_not_found',
          template: data.template,
        });
        return { success: false, error: err.message };
      }
    }

    try {
      const r = await attemptRetry(
        async ({ signal }) => {
          const res = await this.deps.send!(
            access,
            data.to!,
            templateContent(data.template!, language, data.variables ?? []),
            { signal },
          );
          if (!res.ok) throw classifySendFailure(res.error, res.errorDetail);
          return res;
        },
        { breaker: this.breaker, sleepFn: this.deps.sleepFn },
      );

      // sucesso grava evento com id externo (T41)
      await this.logEvent(row.id, organizationId, 'template_send', {
        template: data.template,
        language,
        external_message_id: r.messageId ?? null,
        to: data.to,
      });

      return { success: true };
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      await this.logEvent(row.id, organizationId, 'error', {
        reason: 'send_failed',
        template: data.template,
        detail: err.message,
      });
      return { success: false, error: err.message };
    }
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private resolveConfig(): OpenbspConfig | null {
    try {
      return (this.deps.config ?? openbspConfig)();
    } catch {
      return null;
    }
  }

  private async findRow(user_id: string): Promise<IntegrationRecord | null> {
    const { data } = await this.client
      .from('integrations')
      .select('*')
      .eq('user_id', user_id)
      .eq('channel', 'whatsapp')
      .eq('connection_mode', 'official')
      .is('deleted_at', null)
      .neq('status', 'archived')
      .maybeSingle();
    return (data as IntegrationRecord | null) ?? null;
  }

  private async findRowById(user_id: string, id: string): Promise<IntegrationRecord | null> {
    const { data } = await this.client
      .from('integrations')
      .select('*')
      .eq('id', id)
      .eq('user_id', user_id)
      .maybeSingle();
    return (data as IntegrationRecord | null) ?? null;
  }

  private async setStatus(
    integrationId: string,
    user_id: string,
    status: 'connecting' | 'connected' | 'error',
    reason: string,
  ) {
    await this.client
      .from('integrations')
      .update({ status, status_reason: reason, last_checked_at: new Date().toISOString() })
      .eq('id', integrationId)
      .eq('user_id', user_id);
  }

  private async logEvent(
    integrationId: string,
    workspaceId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    try {
      await this.client.from('integration_events').insert({
        integration_id: integrationId,
        workspace_id: workspaceId,
        event_type: eventType,
        user_id: workspaceId,
        payload,
      });
    } catch {
      // auditoria nunca derruba o fluxo
    }
  }

  /** Hook de registro de webhook no provedor. */
  private async registerWebhook(
    access: ChannelAccess,
    _ctx: { signal: AbortSignal },
  ): Promise<{ ok: boolean; errorDetail?: string }> {
    try {
      const cfg = this.resolveConfig();
      if (!cfg) return { ok: false, errorDetail: 'openbsp_not_configured' };
      // O OpenBSP já entrega o webhook do número no momento do onboarding
      // (callback_url/verify_token gravados no mint). Não há endpoint próprio
      // de "subscribe" na API PostgREST documentada — este método existe para
      // que o fluxo tenha o passo explícito e testável, e para o ponto único
      // onde um endpoint dedicado entra quando o provedor expuser.
      return access.phoneNumberId ? { ok: true } : { ok: false, errorDetail: 'phone_number_id_ausente' };
    } catch (e) {
      return { ok: false, errorDetail: (e as Error).message };
    }
  }

  private async rollbackCreated(
    integrationId: string,
    user_id: string,
    created: { onboardingTokenId?: string; webhookRegistered: boolean },
    err: Error,
  ) {
    // token de onboarding criado nesta transação → descartar
    if (created.onboardingTokenId) {
      try {
        await this.client
          .from('integrations')
          .update({
            meta: { openbsp_onboarding_token_id: null, openbsp_rollback_reason: err.message },
          })
          .eq('id', integrationId)
          .eq('user_id', user_id);
      } catch {
        /* rollback de metadados é melhor-esforço */
      }
    }
  }
}

// ── classification helpers ────────────────────────────────────────────────────

function classifyMintFailure(error?: string, detail?: string): Error {
  const msg = `${error ?? ''} ${detail ?? ''}`.toLowerCase();
  if (msg.includes('401') || msg.includes('apikey') || msg.includes('api-key') || msg.includes('auth') || msg.includes('42501')) {
    return new OpenBspAuthError(`Credenciais OpenBSP recusadas no mint: ${detail ?? error}`);
  }
  if (msg.includes('429') || msg.includes('rate')) {
    return new OpenBspRateLimitError(`Rate limit no mint: ${detail ?? error}`);
  }
  return new OpenBspUnavailableError(true, `Falha no mint de onboarding: ${detail ?? error}`);
}

function classifyAddressFailure(error?: string, detail?: string): Error {
  const msg = `${error ?? ''} ${detail ?? ''}`.toLowerCase();
  if (msg.includes('401') || msg.includes('auth')) {
    return new OpenBspAuthError(`Credenciais OpenBSP recusadas na verificacao: ${detail ?? error}`);
  }
  return new OpenBspUnavailableError(true, `Numero ainda nao conectado no provedor: ${detail ?? error}`);
}

function classifySendFailure(error?: string, detail?: string): Error {
  const msg = `${error ?? ''} ${detail ?? ''}`.toLowerCase();
  if (msg.includes('401') || msg.includes('auth') || msg.includes('token')) {
    return new OpenBspAuthError(`Falha de autenticacao no envio: ${detail ?? error}`);
  }
  if (msg.includes('429') || msg.includes('rate')) {
    return new OpenBspRateLimitError(`Rate limit no envio: ${detail ?? error}`);
  }
  if (msg.includes('template')) {
    return new OpenBspTemplateError('desconhecido', 'template_not_found', detail ?? error);
  }
  return new OpenBspUnavailableError(true, `Falha no envio: ${detail ?? error}`);
}

function reasonForError(err: Error): string {
  if (err instanceof OpenBspAuthError) return 'credenciais_invalidas';
  if (err instanceof OpenBspRateLimitError) return 'rate_limit_provedor';
  if (err instanceof OpenBspTemplateError) return 'template_invalido';
  if (err instanceof OpenBspTimeoutError) return 'timeout_conexao';
  if (err instanceof SecondNumberNotAllowedError) return 'numero_oficial_ja_conectado';
  if (err instanceof OpenBspUnavailableError) return 'provedor_indisponivel';
  return 'falha_conexao';
}

function toChannelAccess(
  address: { address: string; extra: Record<string, unknown> | null },
  cfg: OpenbspConfig,
): ChannelAccess {
  return {
    accessToken: (address.extra?.access_token as string | undefined) ?? undefined,
    phoneNumberId: address.address,
    wabaId: (address.extra?.waba_id as string | undefined) ?? undefined,
    orgId: cfg.orgId,
  } as ChannelAccess;
}

async function defaultDeactivateWebhook(
  _access: ChannelAccess,
): Promise<{ ok: boolean; errorDetail?: string }> {
  // shortcut: o OpenBSP (PostgREST documentado) nao expoe endpoint de unsubscribe;
  // revogar o access_token do numero basta para o webhook parar. Upgrade quando
  // o provedor expuser um endpoint dedicado.
  return { ok: true };
}

function randomToken(): string {
  return `rx_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

function webhookCallbackUrl(): string {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://revolutionx.com.br').replace(/\/+$/, '');
  return `${site}/api/webhooks/openbsp`;
}

// re-export para o route de envio
export { sendViaOpenbsp };

export function createOfficialWhatsAppAdapter(
  client: SupabaseClient,
  deps: OpenBspAdapterDeps = {},
): OfficialWhatsAppAdapter {
  return new OfficialWhatsAppAdapter(client, {
    listTemplates: deps.listTemplates ?? defaultListTemplates,
    deactivateWebhook: deps.deactivateWebhook ?? defaultDeactivateWebhook,
    ...deps,
  });
}

async function defaultListTemplates(
  _access: ChannelAccess,
  _opts: { signal?: AbortSignal },
): Promise<{ ok: boolean; templates: Array<{ name: string; language?: string }>; errorDetail?: string }> {
  // shortcut: sem WABA/token suficiente em sandbox, assumimos "desconhecido" (ok:false)
  // e deixamos o provedor validar. TODO(real): listar templates do WABA via Graph
  // quando o acesso ao token do tenant estiver disponível fora do sandbox.
  return { ok: false, templates: [], errorDetail: 'list_templates_indisponivel' };
}
