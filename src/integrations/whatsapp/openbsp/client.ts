import type { ProviderCallOpts } from '../types';

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
  return opts.fetchImpl ?? (typeof fetch === 'function' ? fetch : null);
}

export async function openbspPost<T = unknown>(
  cfg: OpenbspConfig,
  table: string,
  body: unknown,
  opts: ProviderCallOpts & { select?: string } = {},
): Promise<OpenbspResult<T>> {
  const fetchImpl = resolveFetch(opts);
  if (!fetchImpl) return { ok: false, error: 'fetch_unavailable' };
  const url = `${cfg.base}/${table}${opts.select ? `?select=${encodeURIComponent(opts.select)}` : ''}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? OPENBSP_TIMEOUT_MS);
  if (opts.signal) {
    if (opts.signal.aborted) ctrl.abort();
    else opts.signal.addEventListener('abort', () => ctrl.abort(), { once: true });
  }
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.publishableKey,
        'api-key': cfg.apiKey,
        Prefer: 'return=representation',
      },
      body: JSON.stringify(body),
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      return { ok: false, status: res.status, error: 'http_error', errorDetail: text.slice(0, 500) };
    }
    let data: T | undefined;
    try {
      data = text ? (JSON.parse(text) as T) : undefined;
    } catch {
      data = undefined;
    }
    return { ok: true, data, status: res.status };
  } catch (e) {
    return { ok: false, error: 'network_error', errorDetail: String((e as Error)?.message ?? e) };
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
  const fetchImpl = resolveFetch(opts);
  if (!fetchImpl) return { ok: false, error: 'fetch_unavailable' };
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
    const res = await fetchImpl(url, {
      signal: ctrl.signal,
      headers: { apikey: cfg.publishableKey, 'api-key': cfg.apiKey },
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) return { ok: false, status: res.status, error: 'http_error', errorDetail: text.slice(0, 500) };
    let rows: OpenbspAddressRow[] = [];
    try {
      rows = JSON.parse(text) as OpenbspAddressRow[];
    } catch {
      return { ok: false, error: 'provider_error', errorDetail: 'JSON inválido' };
    }
    const hit = rows.find((r) => (r.extra as Record<string, unknown> | null)?.verify_token === expectedVerifyToken);
    return hit ? { ok: true, data: hit } : { ok: false, error: 'provider_error', errorDetail: 'sem linha conectada p/ este verify_token' };
  } catch (e) {
    return { ok: false, error: 'network_error', errorDetail: String((e as Error)?.message ?? e) };
  } finally {
    clearTimeout(timer);
  }
}

// ── Envio via OpenBSP ────────────────────────────────────────────────────────

export async function sendViaOpenbsp(
  access: OpenbspChannelAccess,
  to: string,
  content: Record<string, unknown>,
  opts: ProviderCallOpts & { select?: string; orgId?: string } = {},
): Promise<OpenbspResult<{ id?: string }>> {
  const cfg = openbspConfig();
  if (!cfg) return { ok: false, error: 'openbsp_not_configured' };
  if (!cfg.orgId) return { ok: false, error: 'openbsp_not_configured', errorDetail: 'OPENBSP_ORG_ID ausente' };

  const orgId = opts.orgId ?? cfg.orgId;
  const r = await openbspPost<Array<{ id: string }>>(
    cfg,
    'messages',
    {
      organization_id: orgId,
      organization_address: access.phoneNumberId,
      conversation_address: to.replace(/^\+/, ''),
      service: 'whatsapp',
      content,
    },
    { ...opts, select: 'id' },
  );
  if (!r.ok) return { ok: false, status: r.status, error: r.error, errorDetail: r.errorDetail };
  const id = Array.isArray(r.data) ? r.data[0]?.id : undefined;
  return { ok: true, data: { id }, status: r.status };
}

export function textContent(text: string): Record<string, unknown> {
  return { version: '1', type: 'text', kind: 'text', text };
}

export function templateContent(name: string, language: string, variables: string[]): Record<string, unknown> {
  return {
    version: '1',
    type: 'data',
    kind: 'template',
    data: {
      name,
      language: { code: language },
      parameters: variables.map((t) => ({ type: 'text', text: t })),
    },
  };
}