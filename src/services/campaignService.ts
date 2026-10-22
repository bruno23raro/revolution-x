// FASE 17 — Motor de campanhas e disparos (puro, sem I/O — testável isolado).
//
// Seções 9/10/11 da missão de finalização:
//   * Interpolação de variáveis `{{nome}}` com ESCAPE obrigatório: o valor
//     vindo de CSV / contato NUNCA executa HTML, JavaScript, SQL nem comando
//     — é purificado antes de entrar no corpo (§9).
//   * Consentimento (LGPD / §11): contato SEM consentimento comprovado ou em
//     opt-out NÃO é elegível para disparo de marketing. Sem "default" silencioso.
//   * Lote / fila: cada destinatário é processado individualmente; resultado
//     POR DESTINATÁRIO (sent/failed/skipped) para métricas reais.
//
// O envio em si (sender) é INJETADO — assim testes usam fake sender e
// fake timers, sem tocar a Meta nem disparar mensagens reais (§16).

import type { MappedRecord } from './csvImport';

// ── Tipos de contato (subconjunto estável; independente de Prisma) ────────

export interface ContactLike {
  id: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  source?: string | null;
  tags?: unknown;
  customFields?: unknown;
  consentMarketing?: boolean;
  consentSource?: string | null;
  optOut?: boolean;
}

export interface CampaignLike {
  id: string;
  organizationId: string;
  channel: string;
  status: string;
  message: string;
  variables?: Record<string, unknown>;
  accountId?: string | null;
  resultKind?: string | null;
}

export interface AudienceSpec {
  tags?: string[];
  source?: string;
}

// ── Escape (§9) ─────────────────────────────────────────────────────────────

/**
 * Purga um valor de variável antes de inserir no corpo da mensagem: remove
 * caracteres de controle, escapa `& < > " '` (para que HTML/JS nunca se
 * realize) e limita o tamanho. Conteúdo de CSV/variável não executa nada.
 */
export function escapeForMessage(value: unknown, limit = 4000): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  s = s.replace(/[\u0000-\u001F\u007F]/g, ''); // controles
  s = s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
  if (s.length > limit) s = s.slice(0, limit);
  return s;
}

const VAR_RE = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g;

export interface InterpolationResult {
  text: string;
  /** Chaves presentes no template mas sem valor. */
  missing: string[];
  /** Chaves efetivamente substituídas. */
  used: string[];
}

/**
 * Substitui `{{chave}}` no template pelos valores `vars`, SEMPRE escapando
 * (§9). Chave ausente → `fallback` (padrão vazio) e listado em `missing`.
 */
export function interpolateVars(
  template: string,
  vars: Record<string, unknown>,
  fallback = '',
): InterpolationResult {
  const missing: string[] = [];
  const used: string[] = [];
  const text = template.replace(VAR_RE, (_m, key: string) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      used.push(key);
      return escapeForMessage(vars[key], 4000);
    }
    missing.push(key);
    return escapeForMessage(fallback, 4000);
  });
  return { text, missing, used };
}

// ── Elegibilidade de marketing (§11) ────────────────────────────────────────

export interface Eligibility {
  eligible: boolean;
  /** Motivo quando NÃO elegível (para relatório honesto, sem PII). */
  reason?: 'no_consent' | 'opt_out' | 'no_phone' | 'no_email';
}

/**
 * Contato só é elegível para marketing com consentimento comprovado
 * (`consentMarketing=true`), sem opt-out e com o canal de contato presente.
 */
export function isMarketingEligible(
  c: ContactLike,
  opts: { channel: string },
): Eligibility {
  if (c.optOut === true) return { eligible: false, reason: 'opt_out' };
  if (c.consentMarketing !== true) return { eligible: false, reason: 'no_consent' };
  if (opts.channel === 'whatsapp' && !(c.phone || '').trim()) {
    return { eligible: false, reason: 'no_phone' };
  }
  if (opts.channel === 'email' && !(c.email || '').trim()) {
    return { eligible: false, reason: 'no_email' };
  }
  return { eligible: true };
}

function parseJsonArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v);
      if (Array.isArray(p)) return p.map(String);
    } catch {
      /* mantém vazio */
    }
  }
  return [];
}

/**
 * Seleciona os contatos elegíveis para uma campanha a partir da audiência
 * (tags / origem). Contatos fora da audiência ou sem elegibilidade ficam de
 * fora do envio (contados em `skipped` + `reasons`, nunca inventados).
 */
export function selectAudience(
  contacts: ContactLike[],
  audience: AudienceSpec,
  channel: string,
): { eligible: ContactLike[]; skipped: number; reasons: Record<string, number> } {
  const reasons: Record<string, number> = {};
  const tagFilter = (audience.tags || []).map((t) => t.toLowerCase()).filter(Boolean);
  const sourceFilter = audience.source?.toLowerCase() || null;

  const eligible: ContactLike[] = [];
  let skipped = 0;

  for (const c of contacts) {
    if (sourceFilter && c.source && c.source.toLowerCase() !== sourceFilter) continue;
    if (tagFilter.length > 0) {
      const has = parseJsonArray(c.tags).some((t) => tagFilter.includes(t.toLowerCase()));
      if (!has) continue;
    }
    const el = isMarketingEligible(c, { channel });
    if (el.eligible) {
      eligible.push(c);
    } else {
      skipped++;
      const r = el.reason ?? 'ineligible';
      reasons[r] = (reasons[r] ?? 0) + 1;
    }
  }

  // Deduplica pelo identificador do canal (phone p/ whatsapp, email p/ email).
  const seen = new Set<string>();
  const dedup: ContactLike[] = [];
  for (const c of eligible) {
    const key = (channel === 'whatsapp' ? c.phone || '' : c.email || '') || c.id;
    if (seen.has(key)) continue;
    seen.add(key);
    dedup.push(c);
  }

  return { eligible: dedup, skipped, reasons };
}

// ── Variáveis por contato ────────────────────────────────────────────────────

/** Monta o mapa de variáveis `{{...}}` a partir de um contato. */
export function buildRecipientVars(c: ContactLike, rec?: MappedRecord): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  out.nome = c.name || [c.firstName, c.lastName].filter(Boolean).join(' ') || '';
  out.firstName = c.firstName ?? rec?.firstName ?? '';
  out.lastName = c.lastName ?? rec?.lastName ?? '';
  out.email = c.email ?? rec?.email ?? '';
  out.telefone = c.phone ?? rec?.phone ?? '';
  out.empresa = c.company ?? rec?.company ?? '';
  out.origem = c.source ?? rec?.source ?? '';
  if (rec) {
    for (const [k, v] of Object.entries(rec.customFields ?? {})) out[`cf_${k}`] = v;
  }
  return out;
}

/** Monta a lista de destinatários prontos para o sender a partir da audiência. */
export function buildRecipients(
  contacts: ContactLike[],
  audience: AudienceSpec,
  channel: string,
): { recipients: Array<{ id: string; to: string }>; skipped: number; reasons: Record<string, number> } {
  const { eligible, skipped, reasons } = selectAudience(contacts, audience, channel);
  const recipients = eligible.map((c) => ({
    id: c.id,
    to: channel === 'whatsapp' ? (c.phone || '') : (c.email || ''),
  }));
  return { recipients, skipped, reasons };
}

// ── Lote / fila com retry e backoff (§10) ──────────────────────────────────

export interface SendResult {
  ok: boolean;
  externalMessageId?: string;
  error?: string;
}

export interface BatchOptions {
  /** Teto de envios nesta execução (o restante permanece em fila). */
  maxPerRun?: number;
  /** Pausa base entre envios (antiflood), em ms. */
  delayMs?: number;
  /** Máximo de tentativas por destinatário (1 = sem retry). */
  maxAttempts?: number;
  /** Fator de backoff entre tentativas (multiplicativo). */
  backoffFactor?: number;
  /** Sleep injetável (testes usam fake timers). */
  sleep?: (ms: number) => Promise<void>;
  /** Auditoria: chamado após cada tentativa com o resultado real. */
  onAttempt?: (r: { id: string; attempt: number; result: SendResult; error?: string }) => void;
}

export interface BatchResult {
  total: number;
  sent: number;
  failed: number;
  /** Destinatários que NÃO terminaram nesta execução (fila persistente). */
  remaining: number;
  /** Resultado REAL por destinatário (nada fictício, §10). */
  perRecipient: Array<{ id: string; ok: boolean; externalMessageId?: string; error?: string; attempts: number }>;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Executa um LOTE de destinatários com retry/backoff, limite por execução e
 * resultado individual. `sender(id, to)` resolve com `SendResult` — NUNCA
 * lança; falhas viram `ok:false`. O chamador persiste `perRecipient`.
 */
export async function runCampaignBatch(
  recipients: Array<{ id: string; to: string }>,
  sender: (id: string, to: string) => Promise<SendResult>,
  opts: BatchOptions = {},
): Promise<BatchResult> {
  const maxPerRun = opts.maxPerRun ?? 100;
  const delayMs = opts.delayMs ?? 1000;
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 3);
  const backoffFactor = opts.backoffFactor ?? 2;
  const sleep = opts.sleep ?? defaultSleep;

  const batch = recipients.slice(0, maxPerRun);
  const perRecipient: BatchResult['perRecipient'] = [];
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < batch.length; i++) {
    const r = batch[i];
    let last: SendResult = { ok: false };
    let attempts = 0;
    for (let a = 1; a <= maxAttempts; a++) {
      attempts = a;
      try {
        last = await sender(r.id, r.to);
      } catch (e) {
        last = { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
      opts.onAttempt?.({ id: r.id, attempt: a, result: last, error: last.error });
      if (last.ok) break;
      if (a < maxAttempts) await sleep(delayMs * Math.pow(backoffFactor, a - 1));
    }
    perRecipient.push({
      id: r.id,
      ok: last.ok,
      externalMessageId: last.externalMessageId,
      error: last.ok ? undefined : last.error,
      attempts,
    });
    if (last.ok) sent++;
    else failed++;
    if (i < batch.length - 1) await sleep(delayMs);
  }

  return {
    total: recipients.length,
    sent,
    failed,
    remaining: Math.max(0, recipients.length - maxPerRun),
    perRecipient,
  };
}

// ── Máquina de estados da campanha (§10) ────────────────────────────────────

export type CampaignStatus =
  | 'draft'
  | 'awaiting_validation'
  | 'scheduled'
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'completed_partial'
  | 'failed'
  | 'canceled';

export const CAMPAIGN_STATUSES: CampaignStatus[] = [
  'draft',
  'awaiting_validation',
  'scheduled',
  'queued',
  'running',
  'paused',
  'completed',
  'completed_partial',
  'failed',
  'canceled',
];

const TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ['awaiting_validation', 'scheduled', 'queued', 'canceled'],
  // 'completed' a partir daqui = confirmação MANUAL do usuário (§12): a
  // plataforma NUNCA afirma que enviou; a campanha só "completa" porque o
  // usuário reportou a ação fora da RX.
  awaiting_validation: ['scheduled', 'queued', 'canceled', 'completed'],
  scheduled: ['queued', 'canceled'],
  queued: ['running', 'paused', 'canceled'],
  running: ['paused', 'completed', 'completed_partial', 'failed', 'canceled'],
  paused: ['running', 'canceled'],
  completed: [],
  completed_partial: [],
  failed: ['queued'],
  canceled: [],
};

/** Valida uma transição de estado (regra do fluxo, não do banco). */
export function canTransition(from: CampaignStatus, to: CampaignStatus): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

