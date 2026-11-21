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

/** Credenciais m├¡nimas para OpenBSP - apenas phoneNumberId ├® obrigat├│rio */
export type OpenbspChannelAccess = {
  phoneNumberId: string;
  accessToken?: string;
  wabaId?: string | null;
};

export function openbspConfig(): OpenbspConfig | null {
  let base = (String(process.env.OPENBSP_BASE_URL ?? '').trim() || '').replace(/\/+$/, '');
  if (!base.endsWith('/rest/v1')) base += '/rest/v1';
  const publishableKey = String(process.env.OPENBSP_PUBLISHABLE_KEY ?? '').trim() || '';
  const apiKey = String(process.env.OPENBSP_API_KEY ?? '').trim() || '';
  if (!base || !publishableKey || !apiKey) return null;
  return { base, publishableKey, apiKey, orgId: String(process.env.OPENBSP_ORG_ID ?? '').trim() || undefined };
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

// ÔöÇÔöÇ Onboarding por tenant ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

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
  expectedCallbackUrl?: string,
): Promise<OpenbspResult<OpenbspAddressRow>> {
  const cfg = openbspConfig();
  if (!cfg) return { ok: false, error: 'openbsp_not_configured' };
  const fetchImpl = resolveFetch(opts);
  if (!fetchImpl) return { ok: false, error: 'fetch_unavailable' };

  let base = cfg.base;
  while (base.endsWith('/')) base = base.slice(0, -1);
  const orgEnv = (String(process.env.OPENBSP_ORG_ID ?? '').trim() ?? '').trim();
  const org = orgEnv ? '&organization_id=eq.' + orgEnv : '';

  // organizations_addresses nao tem created_at nem verify_token como coluna:
  // sem order, e o verify_token e casado em memoria dentro de extra.
  const tentativas = [
    `${base}/organizations_addresses?service=eq.whatsapp&status=eq.connected${org}&select=address,extra`,
    `${base}/organizations_addresses?service=eq.whatsapp&status=eq.connected${org}`,
    `${base}/organizations_addresses?select=address,extra,status${org}&limit=200`,
  ];

  let ultimoErro: OpenbspError | 'provider_error' = 'provider_error';
  let ultimoDetalhe = '';

  for (const url of tentativas) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? OPENBSP_TIMEOUT_MS);
    if (opts.signal) {
      if (opts.signal.aborted) ctrl.abort();
      else opts.signal.addEventListener('abort', () => ctrl.abort(), { once: true });
    }

    try {
      const res = await fetchImpl(url, {
        signal: ctrl.signal,
        cache: 'no-store',
        headers: { apikey: cfg.publishableKey, 'api-key': cfg.apiKey },
      });
      const text = await res.text().catch(() => '');

      if (!res.ok) {
        ultimoErro = 'http_error';
        ultimoDetalhe = text.slice(0, 500);
        continue;
      }

      let rows: OpenbspAddressRow[] = [];
      try {
        rows = JSON.parse(text) as OpenbspAddressRow[];
      } catch {
        ultimoErro = 'provider_error';
        ultimoDetalhe = 'JSON invalido';
        continue;
      }

      const conectados = rows.filter((r) => {
        const st = (r as { status?: string }).status;
        return st === undefined || st === 'connected';
      });

      const porToken = conectados.find(
        (r) => (r.extra as Record<string, unknown> | null)?.verify_token === expectedVerifyToken,
      );
      // O verify_token muda a cada connect; o callback_url da org nao.
      const porCallback = expectedCallbackUrl
        ? conectados.find(
            (r) => (r.extra as Record<string, unknown> | null)?.callback_url === expectedCallbackUrl,
          )
        : undefined;
      const hit = porToken ?? porCallback;

      if (hit) return { ok: true, data: hit };

      ultimoErro = 'provider_error';
      ultimoDetalhe = 'sem linha conectada p/ este verify_token';
    } catch (e) {
      ultimoErro = 'network_error';
      ultimoDetalhe = String((e as Error)?.message ?? e);
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: false, error: ultimoErro, errorDetail: ultimoDetalhe };
}

// ÔöÇÔöÇ Envio via OpenBSP ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

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

// ÔöÇÔöÇ Templates via OpenBSP ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

export interface OpenbspTemplateRow {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: Array<{
    type: string;
    text?: string;
    format?: string;
    buttons?: Array<{ type: string; text: string; sub_type?: string; url?: string }>;
    parameters?: Array<{ type: string; text: string }>;
  }>;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateInput {
  name: string;
  language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  components: Array<{
    type: string;
    text?: string;
    format?: string;
    buttons?: Array<{ type: string; text: string; sub_type?: string; url?: string }>;
    parameters?: Array<{ type: string; text: string }>;
  }>;
}

export async function createTemplate(
  cfg: OpenbspConfig,
  input: CreateTemplateInput,
  opts: ProviderCallOpts = {}
): Promise<OpenbspResult<OpenbspTemplateRow>> {
  const fetchImpl = resolveFetch(opts);
  if (!fetchImpl) return { ok: false, error: 'fetch_unavailable' };

  const url = `${cfg.base}/templates`;
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
      body: JSON.stringify(input),
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      return { ok: false, status: res.status, error: 'http_error', errorDetail: text.slice(0, 500) };
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
    return { ok: false, error: 'network_error', errorDetail: String((e as Error)?.message ?? e) };
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
  const fetchImpl = resolveFetch(opts);
  if (!fetchImpl) return { ok: false, error: 'fetch_unavailable' };

  const url = `${cfg.base}/templates?name=eq.${encodeURIComponent(templateName)}&language=eq.${encodeURIComponent(language)}&select=*`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? OPENBSP_TIMEOUT_MS);
  if (opts.signal) {
    if (opts.signal.aborted) ctrl.abort();
    else opts.signal.addEventListener('abort', () => ctrl.abort(), { once: true });
  }
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      signal: ctrl.signal,
      headers: {
        apikey: cfg.publishableKey,
        'api-key': cfg.apiKey,
      },
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      return { ok: false, status: res.status, error: 'http_error', errorDetail: text.slice(0, 500) };
    }
    let data: OpenbspTemplateRow | undefined;
    try {
      const parsed = text ? (JSON.parse(text) as OpenbspTemplateRow[]) : [];
      data = parsed[0];
    } catch {
      return { ok: false, error: 'provider_error', errorDetail: 'JSON inv├ílido' };
    }
    if (!data) {
      return { ok: false, error: 'provider_error', errorDetail: 'template n├úo encontrado' };
    }
    return { ok: true, data, status: res.status };
  } catch (e) {
    return { ok: false, error: 'network_error', errorDetail: String((e as Error)?.message ?? e) };
  } finally {
    clearTimeout(timer);
  }
}
