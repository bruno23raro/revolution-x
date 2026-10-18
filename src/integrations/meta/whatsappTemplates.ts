// FASE 1 — Templates oficiais de WhatsApp (sincronização com a Meta).
//
// Lista e cria templates no escopo de um WhatsApp Business (WABA) ou número
// de telefone. Assim como o sender, NÃO lança: retorna resultado honesto.
// O snapshot local (para o hub) fica em configStore.saveTemplateSnapshot.

import type { MetaWABAccess } from './whatsappSender';

export interface TemplateInfo {
  name: string;
  category?: string;
  status?: string;
  language?: string;
}

export interface TemplateCreateSpec {
  name: string;
  category?: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language?: string;
  /** Componentes: corpo com placeholders `{{1}}`, `{{2}}`, ... */
  body?: string;
}

export interface TemplatesAccess extends MetaWABAccess {
  /** Escopo para templates. Padrão: `phoneNumberId`. */
  wabaId?: string;
}

type TplError = 'meta_not_configured' | 'fetch_unavailable' | 'http_error' | 'network_error';

export interface ListTemplatesResult {
  ok: boolean;
  templates: TemplateInfo[];
  error?: TplError;
  errorDetail?: string;
}

export interface CreateTemplateResult {
  ok: boolean;
  name?: string;
  error?: TplError;
  errorDetail?: string;
}

interface TplOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  apiBase?: string;
  version?: string;
  locale?: string;
  wabaId?: string;
}

function baseFor(opts: TplOptions, access: TemplatesAccess): string {
  const base = (opts.apiBase ?? access.apiBase ?? 'https://graph.facebook.com').replace(/\/+$/, '');
  const version = opts.version ?? access.version ?? 'v26.0';
  return `${base}/${version}`;
}

function scopeId(access: TemplatesAccess, opts: TplOptions): string {
  return opts.wabaId ?? access.wabaId ?? access.phoneNumberId ?? '';
}

function resolveFetch(opts: TplOptions): typeof fetch | undefined {
  return opts.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
}

export async function listWhatsAppTemplates(
  access: TemplatesAccess,
  opts: TplOptions = {},
): Promise<ListTemplatesResult> {
  const fetchImpl = resolveFetch(opts);
  if (!access?.accessToken || !scopeId(access, opts)) {
    return { ok: false, templates: [], error: 'meta_not_configured' };
  }
  if (!fetchImpl) return { ok: false, templates: [], error: 'fetch_unavailable' };

  const scope = scopeId(access, opts);
  const locale = opts.locale ?? 'en_US';
  const url = `${baseFor(opts, access)}/${scope}/message/templates?locale=${encodeURIComponent(locale)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15000);
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${access.accessToken}` },
      signal: ctrl.signal,
    });
    const parsed = (await res.json()) as { data?: Array<{ name?: string; category?: string; status?: string; language?: { code?: string } }> };
    if (!res.ok) return { ok: false, templates: [], error: 'http_error', errorDetail: `HTTP ${res.status}` };
    const templates: TemplateInfo[] = (parsed.data ?? []).map((t) => ({
      name: t.name ?? '',
      category: t.category,
      status: t.status,
      language: t.language?.code,
    }));
    return { ok: true, templates };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, templates: [], error: 'network_error', errorDetail: msg };
  } finally {
    clearTimeout(timer);
  }
}

export async function createWhatsAppTemplate(
  access: TemplatesAccess,
  spec: TemplateCreateSpec,
  opts: TplOptions = {},
): Promise<CreateTemplateResult> {
  const fetchImpl = resolveFetch(opts);
  if (!access?.accessToken || !scopeId(access, opts)) {
    return { ok: false, error: 'meta_not_configured' };
  }
  if (!fetchImpl) return { ok: false, error: 'fetch_unavailable' };

  const scope = scopeId(access, opts);
  const url = `${baseFor(opts, access)}/${scope}/message/templates`;
  const payload = {
    name: spec.name,
    category: spec.category ?? 'MARKETING',
    language: { code: spec.language ?? 'en' },
    components: spec.body
      ? [{ type: 'body', text: spec.body }]
      : [],
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15000);
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const parsed = (await res.json()) as { name?: string; error?: { message?: string; code?: number } };
    if (res.ok) return { ok: true, name: parsed.name ?? spec.name };
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
