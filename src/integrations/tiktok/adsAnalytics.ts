// FASE 3 · slice 1 — Tracking de ANÚNCIOS do TikTok em tempo real via
// TikTok Business API (open_api) — report de campanhas (o "Gerenciador de
// Anúncios" do TikTok).
//
// Diferente do Content Posting API (open.tiktokapis.com), a API de ANÚNCIOS
// usa um access token de Business (BAP). Endpoint oficial:
//   GET /v1.3/report/object/get/
//     ?advertiser_id={id}&entity=AD_GROUP&date={YYYY-MM-DD}&time_grain=DAILY
//     &metrics=show,click,cost_num,...
//     → { error: { code: 'NoError' }, data: [ { …metrics }, … ] }
//
// Assim como os demais serviços, NÃO lança: retorna `ok`/`error` honesto.
// `fetchImpl` é injetável para testes sem rede.

const DEFAULT_BASE = 'https://business-api.tiktok.com/open_api';
const DEFAULT_VERSION = 'v1.3';

export interface TikTokAdsAccess {
  /** Access Token de Business (BAP), não o token de usuário do Content Posting. */
  accessToken: string;
  /** Advertiser ID (público, não é segredo). */
  advertiserId: string;
  apiBase?: string;
  version?: string;
}

export type TtAdsError =
  | 'tiktok_ads_not_configured'
  | 'no_advertiser'
  | 'fetch_unavailable'
  | 'http_error'
  | 'network_error';

/** Entidades reportáveis (AD_GROUP é a mais comum para visão de campanha). */
export type TikTokAdsEntity = 'AD_ACCOUNT' | 'CAMPAIGN' | 'AD_GROUP' | 'AD' | 'CREATIVE' | 'BASIC_CREATIVE';

export const TIKTOK_ADS_ENTITIES: readonly TikTokAdsEntity[] = [
  'AD_ACCOUNT',
  'CAMPAIGN',
  'AD_GROUP',
  'AD',
  'CREATIVE',
  'BASIC_CREATIVE',
];

/** Métricas (subset útil) aceitas em `metrics`. */
export type TikTokAdsMetric =
  | 'show'
  | 'click'
  | 'cost_num'
  | 'ctr'
  | 'cpc'
  | 'vrv_play'
  | 'likes'
  | 'comments'
  | 'shares'
  | 'downloads'
  | 'installs';

export const TIKTOK_ADS_METRICS: readonly TikTokAdsMetric[] = [
  'show',
  'click',
  'cost_num',
  'ctr',
  'cpc',
  'vrv_play',
  'likes',
  'comments',
  'shares',
  'downloads',
  'installs',
];

export interface TikTokAdsInsightsResult {
  ok: boolean;
  advertiserId?: string;
  entity?: string;
  date?: string;
  /** Linhas do relatório (cada uma já traz as métricas + dimensões). */
  rows: Record<string, unknown>[];
  error?: TtAdsError;
  errorDetail?: string;
}

export interface TtAdsOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  apiBase?: string;
  version?: string;
  /** Entidade (default `AD_GROUP`). */
  entity?: TikTokAdsEntity;
  /** Data (default `yesterday`). */
  date?: string;
  /** Múltiplas métricas. */
  metrics?: readonly string[];
}

function baseFor(opts: TtAdsOptions, access: TikTokAdsAccess): string {
  const base = (opts.apiBase ?? access.apiBase ?? DEFAULT_BASE).replace(/\/+$/, '');
  const version = opts.version ?? access.version ?? DEFAULT_VERSION;
  return `${base}/${version}`;
}

function resolveFetch(opts: TtAdsOptions): typeof fetch | undefined {
  return opts.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
}

/** Valida `date` (YYYY-MM-DD) — devolve `false` se inválida. */
export function isValidTikTokAdsDate(date: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!m) return false;
  const d = new Date(`${date.trim()}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false; // ex.: 2026-02-30 / 2026-13-01
  return d.toISOString().slice(0, 10) === date.trim();
}

/**
 * Busca o relatório de anúncios do TikTok (1 dia, agrupa por entidade).
 * Não lança; devolve `tiktok_ads_not_configured`/`no_advertiser`/
 * `fetch_unavailable` nos casos previsíveis e `http_error`/`network_error`
 * em falhas de API/rede.
 */
export async function getTikTokAdsInsights(
  access: TikTokAdsAccess,
  opts: TtAdsOptions = {},
): Promise<TikTokAdsInsightsResult> {
  if (!access?.accessToken) {
    return { ok: false, rows: [], error: 'tiktok_ads_not_configured' };
  }
  const advertiserId = (access.advertiserId ?? '').trim();
  if (!advertiserId) {
    return { ok: false, rows: [], error: 'no_advertiser', advertiserId: undefined };
  }
  const fetchImpl = resolveFetch(opts);
  if (!fetchImpl) return { ok: false, rows: [], error: 'fetch_unavailable' };

  const entity = opts.entity ?? 'AD_GROUP';
  const date = opts.date ?? 'yesterday';
  const metrics =
    opts.metrics && opts.metrics.length > 0
      ? [...opts.metrics]
      : ['show', 'click', 'cost_num', 'ctr', 'likes'];

  const q = new URLSearchParams();
  q.set('advertiser_id', advertiserId);
  q.set('entity', entity);
  q.set('date', date);
  q.set('time_grain', 'DAILY');
  q.set('metrics', metrics.join(','));
  q.set('order_by', 'show');
  q.set('order', 'DESC');
  const url = `${baseFor(opts, access)}/report/object/get/?${q.toString()}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20000);
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${access.accessToken}` },
      signal: ctrl.signal,
    });
    const parsed = (await res.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
      data?: Record<string, unknown>[];
    } | null;
    if (res.ok && parsed?.error?.code === 'NoError') {
      const rows = Array.isArray(parsed.data) ? parsed.data : [];
      return { ok: true, advertiserId, entity, date, rows };
    }
    const detail = parsed?.error?.message
      ? `${parsed.error.code ?? res.status}: ${parsed.error.message}`
      : `HTTP ${res.status}`;
    return {
      ok: false,
      advertiserId,
      entity,
      date,
      rows: [],
      error: 'http_error',
      errorDetail: detail,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      advertiserId,
      entity,
      date,
      rows: [],
      error: 'network_error',
      errorDetail: msg === 'AbortError' ? `timeout ${opts.timeoutMs ?? 20000}ms` : msg,
    };
  } finally {
    clearTimeout(timer);
  }
}
