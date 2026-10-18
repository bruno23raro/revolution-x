// FASE 2 — Publicação e agendamento de posts de Página do Facebook via
// Graph API oficial da Meta.
//
// Fluxo real (1 chamada), conforme a documentação oficial (POST /{page-id}/feed):
//   • `message` ou `link` (ao menos um) → post no feed da Página;
//   • para agendar: `published=false` + `scheduled_publish_time` (UNIX s,
//     10 min a 75 dias) + `unpublished_content_type=SCHEDULED` — a Meta
//     publica no horário.
//
// Assim como os outros serviços, NÃO lança: retorna `ok`/`error` honesto.
// `fetchImpl` é injetável para testes sem rede.

const DEFAULT_BASE = 'https://graph.facebook.com';
const DEFAULT_VERSION = 'v26.0';

/** 75 dias em segundos — teto oficial de agendamento de posts de Página. */
export const MAX_SCHEDULE_AHEAD_SECONDS = 75 * 24 * 60 * 60;

export interface FacebookPageAccess {
  accessToken: string;
  /** ID da Página (a `meta_page_id` de meta_integrations). */
  facebookPageId: string;
  apiBase?: string;
  version?: string;
}

export type FbPubError =
  | 'meta_not_configured'
  | 'fetch_unavailable'
  | 'no_content_source'
  | 'http_error'
  | 'network_error';

export interface CreatePagePostSpec {
  /** Texto do post (ou `link`). */
  message?: string;
  /** URL de link a anexar (ou `message`). */
  link?: string;
  /** ISO 8601 → vira `scheduled_publish_time` (UNIX s). Opcional. */
  scheduledAt?: string;
}

export interface PagePostResult {
  ok: boolean;
  postId?: string;
  error?: FbPubError;
  errorDetail?: string;
  /** `true` quando foi definido um horário de agendamento. */
  scheduled?: boolean;
}

export interface FbPubOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  apiBase?: string;
  version?: string;
  /** Torna `now` injetável para validar a janela de agendamento em testes. */
  nowMs?: number;
}

function baseFor(opts: FbPubOptions, access: FacebookPageAccess): string {
  const base = (opts.apiBase ?? access.apiBase ?? DEFAULT_BASE).replace(/\/+$/, '');
  const version = opts.version ?? access.version ?? DEFAULT_VERSION;
  return `${base}/${version}`;
}

function resolveFetch(opts: FbPubOptions): typeof fetch | undefined {
  return opts.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
}

function hasContent(spec: CreatePagePostSpec): boolean {
  return Boolean((spec.message ?? '').trim() || (spec.link ?? '').trim());
}

/** Converte `scheduledAt` (ISO) em UNIX segundos; `null` se ausente/inválido. */
export function toScheduledStartSeconds(scheduledAt?: string): number | null {
  if (!scheduledAt) return null;
  const ms = new Date(scheduledAt).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 1000);
}

/**
 * Publica (ou agenda) um post de Página. Se `spec.scheduledAt` estiver
 * presente, adiciona `published=false` + `scheduled_publish_time` +
 * `unpublished_content_type=SCHEDULED` e o resultado marca `scheduled:true`.
 * Não lança; devolve `no_content_source` quando falta `message`/`link`.
 */
export async function publishFacebookPagePost(
  access: FacebookPageAccess,
  spec: CreatePagePostSpec,
  opts: FbPubOptions = {},
): Promise<PagePostResult> {
  const fetchImpl = resolveFetch(opts);
  if (!access?.accessToken || !access?.facebookPageId) {
    return { ok: false, error: 'meta_not_configured' };
  }
  if (!fetchImpl) return { ok: false, error: 'fetch_unavailable' };
  if (!hasContent(spec)) return { ok: false, error: 'no_content_source' };

  const scheduledStart = toScheduledStartSeconds(spec.scheduledAt);
  const payload: Record<string, unknown> = {};
  if ((spec.message ?? '').trim()) payload.message = (spec.message ?? '').trim();
  if ((spec.link ?? '').trim()) payload.link = (spec.link ?? '').trim();
  if (scheduledStart != null) {
    payload.published = false;
    payload.scheduled_publish_time = scheduledStart;
    payload.unpublished_content_type = 'SCHEDULED';
  }

  const url = `${baseFor(opts, access)}/${access.facebookPageId}/feed`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20000);
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const parsed = (await res.json()) as { id?: string; error?: { message?: string; code?: number } };
    if (res.ok) {
      return { ok: true, postId: parsed.id, scheduled: scheduledStart != null };
    }
    const detail = parsed.error?.message
      ? `${parsed.error.code ?? res.status}: ${parsed.error.message}`
      : `HTTP ${res.status}`;
    return { ok: false, error: 'http_error', errorDetail: detail };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: 'network_error', errorDetail: msg };
  } finally {
    clearTimeout(timer);
  }
}
