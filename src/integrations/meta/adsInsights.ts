// FASE 3 · slice 1 — Tracking de ANÚNCIOS em tempo real: Marketing API da
// Meta (Gerenciador de Anúncios) por conta de anúncios (Ad Account / ACT).
//
// Endpoint oficial (GET /{act-id}/insights):
//   • métricas agregadas dos anúncios da conta: spend, impressions, clicks,
//     reach, ctr, cpc + `actions` (interações);
//   • `time_range` (hoje, últimos 7/28 dias, mês, trimestre, ano...);
//   • exige a permissão `ads_read` (ou `read_insights`) no app da Meta —
//     sem ela a API devolve erro de permissão (mapeado para `http_error`
//     com o detalhe, honesto).
//
// Assim como os demais serviços, NÃO lança: retorna `ok`/`error` e degrada
// (sem token / sem ID da conta / sem fetch). `fetchImpl` é injetável para
// testes sem rede.

const DEFAULT_BASE = 'https://graph.facebook.com';
const DEFAULT_VERSION = 'v26.0';

/** `time_range` aceitos pela Marketing API (conjunto estável e amplo). */
export const META_ADS_TIME_RANGES = [
  'today',
  'yesterday',
  'last_7d',
  'last_28d',
  'this_month',
  'last_month',
  'last_quarter',
  'last_year',
] as const;

export type MetaAdsTimeRange = (typeof META_ADS_TIME_RANGES)[number];

export interface MetaAdsAccess {
  accessToken: string;
  /** ID da conta de anúncios (ex.: `ACT-123456789` ou `123456789`). */
  adAccountId: string;
  apiBase?: string;
  version?: string;
}

export type MetaAdsError =
  | 'meta_not_configured'
  | 'no_ad_account'
  | 'fetch_unavailable'
  | 'http_error'
  | 'network_error';

export interface MetaAdInsight {
  /** Data (YYYY-MM-DD) quando o relatório é por dia. */
  date?: string;
  spend?: number;
  impressions?: number;
  clicks?: number;
  reach?: number;
  ctr?: number;
  cpc?: number;
  /** Soma das métricas de `actions` (interações). */
  actionsCount?: number;
}

export interface MetaAdsInsightsResult {
  ok: boolean;
  adAccountId?: string;
  timeRange?: string;
  insights: MetaAdInsight[];
  error?: MetaAdsError;
  errorDetail?: string;
}

export interface MetaAdsOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  apiBase?: string;
  version?: string;
  timeRange?: string;
}

function baseFor(opts: MetaAdsOptions, access: MetaAdsAccess): string {
  const base = (opts.apiBase ?? access.apiBase ?? DEFAULT_BASE).replace(/\/+$/, '');
  const version = opts.version ?? access.version ?? DEFAULT_VERSION;
  return `${base}/${version}`;
}

function resolveFetch(opts: MetaAdsOptions): typeof fetch | undefined {
  return opts.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
}

/** Number defensivo: aceita número ou string numérica; só devolve finito. */
function num(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

interface RawInsightRow {
  date?: string;
  spend?: unknown;
  impressions?: unknown;
  clicks?: unknown;
  reach?: unknown;
  ctr?: unknown;
  cpc?: unknown;
  actions?: { values?: Array<{ metric?: string; value?: unknown }> };
}

/**
 * Busca os insights (agregados) da conta de anúncios. Não lança; devolve
 * `meta_not_configured`/`no_ad_account`/`fetch_unavailable` nos casos
 * previsíveis e `http_error`/`network_error` em falhas de API/rede.
 */
export async function getMetaAdInsights(
  access: MetaAdsAccess,
  opts: MetaAdsOptions = {},
): Promise<MetaAdsInsightsResult> {
  if (!access?.accessToken) {
    return { ok: false, insights: [], error: 'meta_not_configured' };
  }
  const act = (access.adAccountId ?? '').trim();
  if (!act) {
    return { ok: false, insights: [], error: 'no_ad_account', adAccountId: undefined };
  }
  const fetchImpl = resolveFetch(opts);
  if (!fetchImpl) return { ok: false, insights: [], error: 'fetch_unavailable' };

  const timeRange = opts.timeRange ?? 'last_7d';
  const url =
    `${baseFor(opts, access)}/${encodeURIComponent(act)}/insights` +
    `?time_range=${encodeURIComponent(timeRange)}` +
    `&fields=spend,impressions,clicks,reach,ctr,cpc,actions&limit=100&use_account_time=true`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20000);
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${access.accessToken}` },
      signal: ctrl.signal,
    });
    const parsed = (await res.json().catch(() => null)) as {
      data?: unknown[];
      error?: { message?: string; code?: number; error_user_msg?: string };
    } | null;
    if (res.ok && parsed && !parsed.error) {
      const rows = (Array.isArray(parsed.data) ? parsed.data : []) as RawInsightRow[];
      const insights: MetaAdInsight[] = rows.map((row) => {
        const item: MetaAdInsight = {
          date: row.date,
          spend: num(row.spend),
          impressions: num(row.impressions),
          clicks: num(row.clicks),
          reach: num(row.reach),
          ctr: num(row.ctr),
          cpc: num(row.cpc),
        };
        const actions = (row.actions?.values ?? [])
          .map((a) => num(a.value))
          .filter((v): v is number => v !== undefined);
        if (actions.length > 0) {
          item.actionsCount = actions.reduce((sum, v) => sum + v, 0);
        }
        return item;
      });
      return { ok: true, adAccountId: act, timeRange, insights };
    }
    const detail = parsed?.error?.message
      ? `${parsed.error.code ?? res.status}: ${parsed.error.message}`
      : `HTTP ${res.status}`;
    return { ok: false, adAccountId: act, timeRange, insights: [], error: 'http_error', errorDetail: detail };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      adAccountId: act,
      timeRange,
      insights: [],
      error: 'network_error',
      errorDetail: msg === 'AbortError' ? `timeout ${opts.timeoutMs ?? 20000}ms` : msg,
    };
  } finally {
    clearTimeout(timer);
  }
}
