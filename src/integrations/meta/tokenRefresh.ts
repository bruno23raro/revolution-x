// FASE 1 — Refresh / troca de token de acesso da Meta (Cloud API).
//
// Troca um token curto (ou longo) por um novo via `fb_exchange_token`.
// Não lança: retorna resultado honesto (`meta_creds_missing`,
// `exchange_token_missing`, `fetch_unavailable`, `http_error`, `network_error`).
//
// O `appSecret` NUNCA é logado. O app_id/client_id + app_secret vêm das
// credenciais da Meta do tenant (em produção, variáveis META_* no host).

export interface MetaAppCreds {
  appId: string;
  appSecret: string;
}

export interface RefreshResult {
  ok: boolean;
  accessToken?: string;
  expiresIn?: number;
  error?: string;
  errorDetail?: string;
}

export interface RefreshOptions {
  fetchImpl?: typeof fetch;
  apiBase?: string;
  version?: string;
  timeoutMs?: number;
}

export async function refreshMetaAccessToken(
  creds: MetaAppCreds | null | undefined,
  exchangeToken: string,
  opts: RefreshOptions = {},
): Promise<RefreshResult> {
  const fetchImpl = opts.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  if (!creds?.appId || !creds?.appSecret) return { ok: false, error: 'meta_creds_missing' };
  if (!exchangeToken) return { ok: false, error: 'exchange_token_missing' };
  if (!fetchImpl) return { ok: false, error: 'fetch_unavailable' };

  const base = (opts.apiBase ?? 'https://graph.facebook.com').replace(/\/+$/, '');
  const version = opts.version ?? 'v26.0';
  const qs = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: creds.appId,
    client_secret: creds.appSecret,
    fb_exchange_token: exchangeToken,
  }).toString();
  const url = `${base}/${version}/oauth/access_token?${qs}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15000);
  try {
    const res = await fetchImpl(url, { method: 'GET', signal: ctrl.signal });
    const parsed = (await res.json()) as { access_token?: string; expires_in?: number; error?: { message?: string } };
    if (res.ok && parsed.access_token) {
      return { ok: true, accessToken: parsed.access_token, expiresIn: parsed.expires_in };
    }
    return { ok: false, error: 'http_error', errorDetail: parsed.error?.message ?? `HTTP ${res.status}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: 'network_error', errorDetail: msg };
  } finally {
    clearTimeout(timer);
  }
}
