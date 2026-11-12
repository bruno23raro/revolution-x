// FASE 1 — Templates oficiais de WhatsApp (sincronização com a Meta).
//
// Lista e cria templates no escopo de um WhatsApp Business (WABA) ou número
// de telefone. Assim como o sender, NÃO lança: retorna resultado honesto.
// O snapshot local (para o hub) fica em configStore.saveTemplateSnapshot.
//
// FASE 2.2.4 — restaurados getWhatsAppTemplate e sendTestMessage (contrato v19.0).

import type { MetaWABAccess } from './whatsappSender';

export interface TemplateInfo {
  name: string;
  category?: string;
  status?: string;
  language?: string;
}

export interface TemplateComponentSpec {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  text?: string;
  format?: string;
  buttons?: TemplateButtonSpec[];
}

export interface TemplateButtonSpec {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  sub_type?: string;
  url?: string;
}

export interface TemplateCreateSpec {
  name: string;
  category?: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language?: string;
  /** Componentes: corpo com placeholders `{{1}}`, `{{2}}`, ... */
  body?: string;
  header?: { type: 'TEXT'; text: string };
  footer?: { text: string };
  buttons?: TemplateButtonSpec[];
}

export interface TemplatesAccess extends MetaWABAccess {
  /** Escopo para templates. Padrão: `phoneNumberId`. */
  wabaId?: string;
}

type TplError =
  | 'meta_not_configured'
  | 'fetch_unavailable'
  | 'http_error'
  | 'network_error'
  | 'validation_error';

export interface ListTemplatesResult {
  ok: boolean;
  templates: TemplateInfo[];
  error?: TplError;
  errorDetail?: string;
}

export interface CreateTemplateResult {
  ok: boolean;
  name?: string;
  templateId?: string;
  error?: TplError;
  errorDetail?: string;
}

export interface GetTemplateResult {
  ok: boolean;
  template?: {
    id: string;
    name: string;
    category: string;
    language: string;
    status: string;
    quality_score?: number;
    components?: Array<{
      type: string;
      text?: string;
      format?: string;
      buttons?: Array<{ type: string; text: string; sub_type?: string; url?: string }>;
      parameters?: Array<{ type: string; text: string }>;
    }>;
    rejection_reason?: string;
  };
  error?: TplError;
  errorDetail?: string;
}

export interface SendTestMessageResult {
  ok: boolean;
  messageId?: string;
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
  /** Escopo alternativo (número de telefone) por chamada. */
  phoneNumberId?: string;
}

const DEFAULT_VERSION = 'v19.0';
const VALID_CATEGORIES = new Set(['MARKETING', 'UTILITY', 'AUTHENTICATION']);

function baseFor(opts: TplOptions, access: TemplatesAccess): string {
  const base = (opts.apiBase ?? access.apiBase ?? 'https://graph.facebook.com').replace(/\/+$/, '');
  const version = opts.version ?? access.version ?? DEFAULT_VERSION;
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
  if (!spec.name || spec.name.trim().length === 0) {
    return { ok: false, error: 'validation_error', errorDetail: 'Nome é obrigatório' };
  }
  if (spec.category && !VALID_CATEGORIES.has(spec.category)) {
    return { ok: false, error: 'validation_error', errorDetail: 'Categoria inválida' };
  }

  const fetchImpl = resolveFetch(opts);
  if (!access?.accessToken || !scopeId(access, opts)) {
    return { ok: false, error: 'meta_not_configured' };
  }
  if (!fetchImpl) return { ok: false, error: 'fetch_unavailable' };

  const scope = scopeId(access, opts);
  const url = `${baseFor(opts, access)}/${scope}/message/templates`;

  // Montar components na ordem canônica da Meta: header, body, footer, buttons.
  const components: TemplateComponentSpec[] = [];
  if (spec.header) {
    components.push({ type: 'HEADER', text: spec.header.text, format: 'TEXT' });
  }
  if (spec.body) {
    components.push({ type: 'BODY', text: spec.body });
  }
  if (spec.footer) {
    components.push({ type: 'FOOTER', text: spec.footer.text });
  }
  if (spec.buttons && spec.buttons.length > 0) {
    components.push({
      type: 'BUTTONS',
      buttons: spec.buttons.map((b) => ({
        type: b.type,
        text: b.text,
        ...(b.sub_type ? { sub_type: b.sub_type } : {}),
        ...(b.url ? { url: b.url } : {}),
      })),
    });
  }

  const payload = {
    name: spec.name,
    category: spec.category ?? 'MARKETING',
    language: { code: spec.language ?? 'en_US' },
    components,
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
    const parsed = (await res.json()) as {
      name?: string;
      id?: string;
      error?: { message?: string; code?: number };
    };
    if (res.ok) return { ok: true, name: parsed.name ?? spec.name, templateId: parsed.id };
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

export async function getWhatsAppTemplate(
  access: TemplatesAccess,
  templateId: string,
  opts: TplOptions = {},
): Promise<GetTemplateResult> {
  const fetchImpl = resolveFetch(opts);
  if (!access?.accessToken || !scopeId(access, opts)) {
    return { ok: false, error: 'meta_not_configured' };
  }
  if (!fetchImpl) return { ok: false, error: 'fetch_unavailable' };

  const scope = scopeId(access, opts);
  const url = `${baseFor(opts, access)}/${scope}/message/templates/${templateId}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15000);
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${access.accessToken}` },
      signal: ctrl.signal,
    });
    const parsed = (await res.json()) as {
      id?: string;
      name?: string;
      category?: string;
      language?: string;
      status?: string;
      quality_score?: number;
      components?: Array<{
        type: string;
        text?: string;
        format?: string;
        buttons?: Array<{ type: string; text: string; sub_type?: string; url?: string }>;
        parameters?: Array<{ type: string; text: string }>;
      }>;
      rejection_reason?: string;
      error?: { message?: string; code?: number };
    };
    if (!res.ok) return { ok: false, error: 'http_error', errorDetail: `HTTP ${res.status}` };
    return {
      ok: true,
      template: {
        id: parsed.id ?? '',
        name: parsed.name ?? '',
        category: parsed.category ?? '',
        language: parsed.language ?? '',
        status: parsed.status ?? '',
        quality_score: parsed.quality_score,
        components: parsed.components,
        rejection_reason: parsed.rejection_reason,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: 'network_error', errorDetail: msg };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Status resumido de um template (status + quality_score).
 * FASE 2.2.4 — reexporta o resultado de getWhatsAppTemplate para o hub.
 */
export async function getTemplateStatus(
  access: TemplatesAccess,
  templateId: string,
  opts: TplOptions = {},
): Promise<{ ok: boolean; status?: string; qualityScore?: number; error?: TplError; errorDetail?: string }> {
  const result = await getWhatsAppTemplate(access, templateId, opts);
  if (!result.ok || !result.template) {
    return { ok: false, error: result.error, errorDetail: result.errorDetail };
  }
  return { ok: true, status: result.template.status, qualityScore: result.template.quality_score };
}

export async function sendTestMessage(
  access: TemplatesAccess,
  templateName: string,
  to: string,
  variables: string[] = [],
  opts: TplOptions & { language?: string } = {},
): Promise<SendTestMessageResult> {
  const fetchImpl = resolveFetch(opts);
  if (!access?.accessToken || !access.phoneNumberId) {
    return { ok: false, error: 'meta_not_configured' };
  }
  if (!fetchImpl) return { ok: false, error: 'fetch_unavailable' };

  const url = `${baseFor(opts, access)}/${access.phoneNumberId}/messages`;
  const language = opts.language ?? 'en_US';
  const components = [
    {
      type: 'body',
      parameters: variables.map((v) => ({ type: 'text', text: v })),
    },
  ];

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language,
      components,
    },
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
    const parsed = (await res.json()) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string };
    };
    if (!res.ok) {
      const detail = parsed.error?.message ?? `HTTP ${res.status}`;
      return { ok: false, error: 'http_error', errorDetail: detail };
    }
    return { ok: true, messageId: parsed.messages?.[0]?.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: 'network_error', errorDetail: msg };
  } finally {
    clearTimeout(timer);
  }
}