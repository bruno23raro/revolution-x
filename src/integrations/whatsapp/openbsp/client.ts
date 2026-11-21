import type { ProviderCallOpts } from '../types';
import { fetch as undiciFetch } from 'undici';
import https from 'node:https';
import { URL as NodeURL } from 'node:url';

export const OPENBSP_TIMEOUT_MS = 15_000;

export interface OpenbspConfig {
  base: string;
  publishableKey: string;
  apiKey: string;
  orgId?: string;
}

export type OpenbspError = 'openbsp_not_configured' | 'fetch_unavailable' | 'http_error' | 'network_error';

export interface OpenbspResult<T = unknown> {
  ok: boolean;
  data?: T;
  status?: number;
  error?: OpenbspError | 'provider_error';
  errorDetail?: string;
}

/** Credenciais mínimas para OpenBSP - apenas phoneNumberId é obrigatório */
export type OpenbspChannelAccess = {
  phoneNumberId: string;
  accessToken?: string;
  wabaId?: string | null;
};

export function openbspConfig(): OpenbspConfig | null {
  const base = (process.env.OPENBSP_BASE_URL || '').replace(/\/+$/, '');
  const publishableKey = process.env.OPENBSP_PUBLISHABLE_KEY || '';
  const apiKey = process.env.OPENBSP_API_KEY || '';
  if (!base || !publishableKey || !apiKey) return null;
  return { base, publishableKey, apiKey, orgId: process.env.OPENBSP_ORG_ID || undefined };
}

function resolveFetch(opts: ProviderCallOpts): typeof fetch | null {
  if (opts.fetchImpl) return opts.fetchImpl;
  // O fetch global e patchado pelo Next e falha neste runtime; undici cru funciona.
  return undiciFetch as unknown as typeof fetch;
}
function httpsPost(
  urlStr: string,
  headers: Record<string, string>,
  body: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const u = new NodeURL(urlStr);
    const req = https.request(
      {
        hostname: u.hostname,
        family: 4,
        port: u.port ? Number(u.port) : 443,
        path: u.pathname + u.search,
        method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { data += c; });
        res.on('end', () => resolve({ status: res.statusCode || 0, text: data }));
      },
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    if (signal) {
      if (signal.aborted) req.destroy(new Error('aborted'));
      else signal.addEventListener('abort', () => req.destroy(new Error('aborted')), { once: true });
    }
    req.write(body);
    req.end();
  });
}

export async function openbspPost<T = unknown>(
  cfg: OpenbspConfig,
  table: string,
  body: unknown,
  opts: ProviderCallOpts & { select?: string } = {},
): Promise<OpenbspResult<T>> {
  if (!resolveFetch(opts)) return { ok: false, error: 'fetch_unavailable' };
  const url = `${cfg.base}/${table}${opts.select ? `?select=${encodeURIComponent(opts.select)}` : ''}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? OPENBSP_TIMEOUT_MS);
  if (opts.signal) {
    if (opts.signal.aborted) ctrl.abort();
    else opts.signal.addEventListener('abort', () => ctrl.abort(), { once: true });
  }
  try {
    const res = await httpsPost(url, {
      'Content-Type': 'application/json',
      apikey: cfg.publishableKey,
      authorization: cfg.publishableKey,
      'api-key': cfg.apiKey,
      Prefer: 'return=representation',
    }, JSON.stringify(body), opts.timeoutMs ?? OPENBSP_TIMEOUT_MS, ctrl.signal);
    const text = res.text;
    if (res.status < 200 || res.status >= 300) {
      return { ok: false, status: res.status, error: 'http_error', errorDetail: 'URL ' + url + ' -> HTTP ' + res.status + ' body[' + text.slice(0, 200) + ']' };
    }
    let data: T | undefined;
    try {
      data = text ? (JSON.parse(text) as T) : undefined;
    } catch {
      data = undefined;
    }
    return { ok: true, data, status: res.status };
  } catch (e) {
    const ee = e as NodeJS.ErrnoException;
    try {
      const res2 = await httpsPost(url, {
        'Content-Type': 'application/json',
        apikey: cfg.publishableKey,
        authorization: cfg.publishableKey,
        'api-key': cfg.apiKey,
        Prefer: 'return=representation',
      }, JSON.stringify(body), opts.timeoutMs ?? OPENBSP_TIMEOUT_MS, ctrl.signal);
      const text2 = res2.text;
      if (res2.status < 200 || res2.status >= 300) {
        return { ok: false, status: res2.status, error: 'http_error', errorDetail: text2.slice(0, 300) };
      }
      let d2: T | undefined;
      try { d2 = text2 ? (JSON.parse(text2) as T) : undefined; } catch { d2 = undefined; }
      return { ok: true, data: d2, status: res2.status };
    } catch (e2) {
      const e3 = e2 as NodeJS.ErrnoException;
      return { ok: false, error: 'network_error', errorDetail: 'retry: name=' + e3?.name + ' code=' + e3?.code + ' msg=' + String(e3?.message) };
    }
  } finally {
    clearTimeout(timer);
  }
}

// ── Onboarding por tenant ────────────────────────────────────────────────────

export interface MintTokenResult {
  ok: boolean;
  tokenId?: string;
  popupUrl?: string;
  error?: OpenbspError | 'http_error' | 'provider_error';
  errorDetail?: string;
}

export async function mintOnboardingToken(
  input: {
    name: string;
    orgId: string;
    callbackUrl: string;
    verifyToken: string;
    expiresInDays?: number;
    uiBase?: string;
  },
  opts: ProviderCallOpts = {},
): Promise<MintTokenResult> {
  const cfg = openbspConfig();
  if (!cfg) return { ok: false, error: 'openbsp_not_configured' };
  const expires = new Date(Date.now() + (input.expiresInDays ?? 7) * 86_400_000).toISOString();
  const r = await openbspPost<Array<{ id: string }>>(
    cfg,
    'onboarding_tokens',
    {
      name: input.name,
      organization_id: input.orgId,
      service: 'whatsapp',
      expires_at: expires,
      callback_url: input.callbackUrl,
      verify_token: input.verifyToken,
    },
    { ...opts, select: 'id' },
  );
  if (!r.ok) return { ok: false, error: r.error, errorDetail: r.errorDetail };
  const id = Array.isArray(r.data) ? r.data[0]?.id : undefined;
  if (!id) return { ok: false, error: 'provider_error', errorDetail: 'resposta sem id' };
  const ui = input.uiBase ?? 'https://web.openbsp.dev';
  return { ok: true, tokenId: id, popupUrl: `${ui}/onboard/whatsapp/${id}` };
}

export interface OpenbspAddressRow {
  address: string;
  extra: {
    waba_id?: string;
    access_token?: string;
    phone_number?: string;
    verified_name?: string;
    callback_url?: string;
    verify_token?: string;
  } | null;
}

export async function fetchConnectedAddress(
  expectedVerifyToken: string,
  opts: ProviderCallOpts = {},
): Promise<OpenbspResult<OpenbspAddressRow>> {
  const cfg = openbspConfig();
  if (!cfg) return { ok: false, error: 'openbsp_not_configured' };
  if (!resolveFetch(opts)) return { ok: false, error: 'fetch_unavailable' };
  const url =
    `${cfg.base}/organizations_addresses?service=eq.whatsapp&status=eq.connected` +
    `&select=address,extra&order=created_at.desc&limit=50`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? OPENBSP_TIMEOUT_MS);
  if (opts.signal) {
    if (opts.signal.aborted) ctrl.abort();
    else opts.signal.addEventListener('abort', () => ctrl.abort(), { once: true });
  }
  try {
    const res = await httpsPost(url, {
      'Content-Type': 'application/json',
      apikey: cfg.publishableKey,
      authorization: cfg.publishableKey,
      'api-key': cfg.apiKey,
      Prefer: 'return=representation',
    }, JSON.stringify(body), opts.timeoutMs ?? OPENBSP_TIMEOUT_MS, ctrl.signal);
    const text = res.text;
    if (res.status < 200 || res.status >= 300) {
      return { ok: false, status: res.status, error: 'http_error', errorDetail: 'URL ' + url + ' -> HTTP ' + res.status + ' body[' + text.slice(0, 200) + ']' };
    }
    let data: OpenbspTemplateRow | undefined;
    try {
      const parsed = text ? (JSON.parse(text) as OpenbspTemplateRow[]) : [];
      data = parsed[0];
    } catch {
      data = undefined;
    }
    return { ok: true, data, status: res.status };
  } catch (e) {
    const ee = e as NodeJS.ErrnoException;
    try {
      const res2 = await httpsPost(url, {
        'Content-Type': 'application/json',
        apikey: cfg.publishableKey,
        authorization: cfg.publishableKey,
        'api-key': cfg.apiKey,
        Prefer: 'return=representation',
      }, JSON.stringify(body), opts.timeoutMs ?? OPENBSP_TIMEOUT_MS, ctrl.signal);
      const text2 = res2.text;
      if (res2.status < 200 || res2.status >= 300) {
        return { ok: false, status: res2.status, error: 'http_error', errorDetail: text2.slice(0, 300) };
      }
      let d2: T | undefined;
      try { d2 = text2 ? (JSON.parse(text2) as T) : undefined; } catch { d2 = undefined; }
      return { ok: true, data: d2, status: res2.status };
    } catch (e2) {
      const e3 = e2 as NodeJS.ErrnoException;
      return { ok: false, error: 'network_error', errorDetail: 'retry: name=' + e3?.name + ' code=' + e3?.code + ' msg=' + String(e3?.message) };
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function getTemplateStatus(
  cfg: OpenbspConfig,
  templateName: string,
  language: string,
  opts: ProviderCallOpts = {}
): Promise<OpenbspResult<OpenbspTemplateRow>> {
  if (!resolveFetch(opts)) return { ok: false, error: 'fetch_unavailable' };

  const url = `${cfg.base}/templates?name=eq.${encodeURIComponent(templateName)}&language=eq.${encodeURIComponent(language)}&select=*`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? OPENBSP_TIMEOUT_MS);
  if (opts.signal) {
    if (opts.signal.aborted) ctrl.abort();
    else opts.signal.addEventListener('abort', () => ctrl.abort(), { once: true });
  }
  try {
    const res = await httpsPost(url, {
      'Content-Type': 'application/json',
      apikey: cfg.publishableKey,
      authorization: cfg.publishableKey,
      'api-key': cfg.apiKey,
      Prefer: 'return=representation',
    }, JSON.stringify(body), opts.timeoutMs ?? OPENBSP_TIMEOUT_MS, ctrl.signal);
    const text = res.text;
    if (res.status < 200 || res.status >= 300) {
      return { ok: false, status: res.status, error: 'http_error', errorDetail: 'URL ' + url + ' -> HTTP ' + res.status + ' body[' + text.slice(0, 200) + ']' };
    }
    let data: OpenbspTemplateRow | undefined;
    try {
      const parsed = text ? (JSON.parse(text) as OpenbspTemplateRow[]) : [];
      data = parsed[0];
    } catch {
      return { ok: false, error: 'provider_error', errorDetail: 'JSON inválido' };
    }
    if (!data) {
      return { ok: false, error: 'provider_error', errorDetail: 'template não encontrado' };
    }
    return { ok: true, data, status: res.status };
  } catch (e) {
    const ee = e as NodeJS.ErrnoException;
    try {
      const res2 = await httpsPost(url, {
        'Content-Type': 'application/json',
        apikey: cfg.publishableKey,
        authorization: cfg.publishableKey,
        'api-key': cfg.apiKey,
        Prefer: 'return=representation',
      }, JSON.stringify(body), opts.timeoutMs ?? OPENBSP_TIMEOUT_MS, ctrl.signal);
      const text2 = res2.text;
      if (res2.status < 200 || res2.status >= 300) {
        return { ok: false, status: res2.status, error: 'http_error', errorDetail: text2.slice(0, 300) };
      }
      let d2: T | undefined;
      try { d2 = text2 ? (JSON.parse(text2) as T) : undefined; } catch { d2 = undefined; }
      return { ok: true, data: d2, status: res2.status };
    } catch (e2) {
      const e3 = e2 as NodeJS.ErrnoException;
      return { ok: false, error: 'network_error', errorDetail: 'retry: name=' + e3?.name + ' code=' + e3?.code + ' msg=' + String(e3?.message) };
    }
  } finally {
    clearTimeout(timer);
  }
}





