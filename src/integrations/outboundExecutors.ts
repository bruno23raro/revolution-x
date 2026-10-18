// FASE 3 · slice 3 — Executores de SAÍDA do Hub de Integrações.
//
// A entrada já existia desde a FASE 1 (`/api/webhooks/inbound` + provider
// `webhook_inbound`). Este serviço fecha o lado SAÍDA: eventos estruturados
// do app → automação do usuário (n8n / Zapier / Make / webhook genérico).
//
// Padrão da casa: TS puro com fetch injetável (`fetchImpl`, `timeoutMs`),
// NUNCA lança — devolve `{ ok, error, errorDetail }` e degrada com
// honestidade. Assinatura opcional com HMAC-SHA256 (Make / webhook genérico).

import { createHmac } from 'crypto';
import { OUTBOUND_PROVIDER_IDS, type OutboundProviderId } from './providers';

export { OUTBOUND_PROVIDER_IDS, type OutboundProviderId };

export const MAX_EVENT_LEN = 64;
export const MAX_PAYLOAD_BYTES = 50_000;

export type OutboundErrorCode =
  | 'not_configured'
  | 'invalid_target'
  | 'invalid_event'
  | 'payload_too_large'
  | 'fetch_unavailable'
  | 'http_error'
  | 'timeout'
  | 'network_error';

export interface OutboundResult {
  ok: boolean;
  provider: string;
  httpStatus?: number;
  error?: OutboundErrorCode;
  errorDetail?: string;
}

export interface OutboundOptions {
  /** Injetável para testes (padrão: fetch global, se existir). */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Relógio determinístico para `sentAt` (padrão: Date). */
  now?: () => Date;
  /** Incluído no envelope para contexto do lado receptor. */
  organizationId?: string;
}

type Value = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/** HMAC-SHA256 em hex (exportado para a rota/testes verificarem a assinatura). */
export function hmacSha256Hex(key: string, body: string): string {
  return createHmac('sha256', key).update(body, 'utf8').digest('hex');
}

// ---------------------------------------------------------------------------
// Alvo por provedor (URL + headers específicos)
// ---------------------------------------------------------------------------

interface Target {
  url: string;
  headers: Record<string, string>;
}

/**
 * Resolve o alvo de saída de um provedor a partir da config guardada.
 * Falha de configuração → `not_configured`; URL presente mas inválida →
 * `invalid_target`. Nunca lança.
 */
export function resolveOutboundTarget(
  provider: OutboundProviderId,
  value: Value | null,
): Target | { error: OutboundErrorCode; errorDetail: string } {
  const v = value ?? {};

  switch (provider) {
    case 'n8n': {
      const base = str(v.baseUrl);
      const path = str(v.webhookPath);
      if (!base) return { error: 'not_configured', errorDetail: 'baseUrl ausente' };
      if (!isHttpUrl(base)) return { error: 'invalid_target', errorDetail: `baseUrl inválida: ${base}` };
      if (!path) return { error: 'not_configured', errorDetail: 'webhookPath ausente' };
      const headers: Record<string, string> = {};
      if (str(v.apiKey)) headers['X-Api-Key'] = str(v.apiKey);
      return { url: `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`, headers };
    }
    case 'zapier': {
      // Catch Hook: a URL em si é o segredo — nenhum header de auth.
      const url = str(v.webhookUrl);
      if (!url) return { error: 'not_configured', errorDetail: 'webhookUrl ausente' };
      if (!isHttpUrl(url)) return { error: 'invalid_target', errorDetail: `webhookUrl inválida: ${url}` };
      return { url, headers: {} };
    }
    case 'make':
    case 'webhook_outbound': {
      const url = str(v.webhookUrl);
      if (!url) return { error: 'not_configured', errorDetail: 'webhookUrl ausente' };
      if (!isHttpUrl(url)) return { error: 'invalid_target', errorDetail: `webhookUrl inválida: ${url}` };
      return { url, headers: {} };
    }
  }
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

/**
 * Envia um evento estruturado para o alvo do provedor (POST JSON).
 * NUNCA lança: qualquer falha vira `{ ok: false, error, errorDetail }`.
 */
export async function executeOutbound(
  provider: OutboundProviderId,
  value: Value | null,
  event: string,
  payload: Record<string, unknown> | undefined,
  opts: OutboundOptions = {},
): Promise<OutboundResult> {
  const fetchImpl = opts.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  const timeoutMs = opts.timeoutMs ?? 5000;

  // --- Validação do evento (antes de qualquer rede) ---
  const ev = str(event);
  if (!ev) return { ok: false, provider, error: 'invalid_event', errorDetail: 'event ausente' };
  if (ev.length > MAX_EVENT_LEN) {
    return { ok: false, provider, error: 'invalid_event', errorDetail: `event excede ${MAX_EVENT_LEN} chars` };
  }
  let cleanPayload: Record<string, unknown>;
  if (payload === undefined || payload === null) cleanPayload = {};
  else if (typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, provider, error: 'invalid_event', errorDetail: 'payload deve ser um objeto JSON' };
  } else cleanPayload = payload;
  if (JSON.stringify(cleanPayload).length > MAX_PAYLOAD_BYTES) {
    return { ok: false, provider, error: 'payload_too_large', errorDetail: `payload excede ${MAX_PAYLOAD_BYTES} bytes` };
  }

  // --- Alvo + assinatura (quando o provedor tem chave) ---
  const target = resolveOutboundTarget(provider, value);
  if ('error' in target) {
    return { ok: false, provider, error: target.error, errorDetail: target.errorDetail };
  }

  const nowFn = opts.now ?? (() => new Date());
  const sentAt = nowFn();
  const envelope = {
    source: 'revolution-x',
    event: ev,
    payload: cleanPayload,
    ...(opts.organizationId ? { organizationId: opts.organizationId } : {}),
    sentAt: sentAt.toISOString(),
  };
  const rawBody = JSON.stringify(envelope);

  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...target.headers };
  if (provider === 'make' && str(value?.hmacKey ?? undefined)) {
    // Assinatura opcional do Make: HMAC-SHA256 do corpo bruto com a HMAC Key.
    headers['X-Hook-Signature'] = `HMAC-SHA256:${hmacSha256Hex(str(value?.hmacKey ?? ''), rawBody)}`;
  }
  if (provider === 'webhook_outbound' && str(value?.secret ?? undefined)) {
    headers['X-Webhook-Signature'] = `sha256=${hmacSha256Hex(str(value?.secret ?? ''), rawBody)}`;
    if (opts.organizationId) headers['X-Webhook-Organization'] = opts.organizationId;
  }

  if (!fetchImpl) {
    return { ok: false, provider, error: 'fetch_unavailable', errorDetail: 'fetch indisponível neste ambiente' };
  }

  // --- POST com timeout honesto ---
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(target.url, {
      method: 'POST',
      headers,
      body: rawBody,
      signal: ctrl.signal,
    });
    if (res.ok) return { ok: true, provider, httpStatus: res.status };
    return { ok: false, provider, httpStatus: res.status, error: 'http_error', errorDetail: `HTTP ${res.status}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'AbortError') {
      return { ok: false, provider, error: 'timeout', errorDetail: `timeout ${timeoutMs}ms` };
    }
    return { ok: false, provider, error: 'network_error', errorDetail: msg };
  } finally {
    clearTimeout(timer);
  }
}
