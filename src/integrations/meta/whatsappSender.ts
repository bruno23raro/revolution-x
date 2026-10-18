// FASE 1 — WhatsApp Business: envio via Cloud API oficial da Meta.
//
// `sendWhatsAppText` / `sendWhatsAppTemplate` fazem o POST em
// `/{PHONE_NUMBER_ID}/messages` e RETORNAM um resultado (não lançam) para que
// o disparo em massa consiga agregar sucesso/falha por destinatário.
//
// Credenciais: `accessToken` é o token (já descriptografado) e `phoneNumberId`
// vem da `meta_integrations` (tabela real, snake_case — ver dual-schema drift).
// Degrada honestamente: sem credencial → `meta_not_configured`, sem fetch →
// `fetch_unavailable`.

const DEFAULT_BASE = 'https://graph.facebook.com';
const DEFAULT_VERSION = 'v26.0';

export interface MetaWABAccess {
  accessToken: string;
  phoneNumberId: string;
  apiBase?: string;
  version?: string;
}

export type SendError =
  | 'meta_not_configured'
  | 'fetch_unavailable'
  | 'http_error'
  | 'network_error';

export interface SendTextResult {
  ok: boolean;
  to: string;
  messageId?: string;
  status?: 'sent' | 'failed';
  error?: SendError;
  errorDetail?: string;
}

export interface SendOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  apiBase?: string;
  version?: string;
}

function endpointFor(access: MetaWABAccess, opts: SendOptions, path: string): string {
  const base = (opts.apiBase ?? access.apiBase ?? DEFAULT_BASE).replace(/\/+$/, '');
  const version = opts.version ?? access.version ?? DEFAULT_VERSION;
  return `${base}/${version}/${path}`;
}

function resolveFetch(opts: { fetchImpl?: typeof fetch }): typeof fetch | undefined {
  return opts.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Envia uma mensagem de texto via Cloud API. Não lança; retorna resultado. */
export async function sendWhatsAppText(
  access: MetaWABAccess,
  to: string,
  body: string,
  opts: SendOptions = {},
): Promise<SendTextResult> {
  const fetchImpl = resolveFetch(opts);
  if (!access?.accessToken || !access?.phoneNumberId) {
    return { ok: false, to, error: 'meta_not_configured' };
  }
  if (!fetchImpl) return { ok: false, to, error: 'fetch_unavailable' };

  const url = endpointFor(access, opts, `${access.phoneNumberId}/messages`);
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body },
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
    const raw = await res.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      /* mantém apenas o status HTTP */
    }
    if (res.ok) {
      const id = (parsed as { messages?: Array<{ id?: string }> } | null)?.messages?.[0]?.id;
      return { ok: true, to, messageId: id, status: 'sent' };
    }
    const err = (parsed as { error?: { message?: string; code?: number } } | null)?.error;
    const detail = err?.message ? `${err.code ?? res.status}: ${err.message}` : `HTTP ${res.status}`;
    return { ok: false, to, error: 'http_error', status: 'failed', errorDetail: detail };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, to, error: 'network_error', status: 'failed', errorDetail: msg };
  } finally {
    clearTimeout(timer);
  }
}

/** Envia um template oficial (com variáveis no corpo). */
export async function sendWhatsAppTemplate(
  access: MetaWABAccess,
  to: string,
  name: string,
  variables: string[] = [],
  opts: SendOptions & { language?: string } = {},
): Promise<SendTextResult> {
  const fetchImpl = resolveFetch(opts);
  if (!access?.accessToken || !access?.phoneNumberId) {
    return { ok: false, to, error: 'meta_not_configured' };
  }
  if (!fetchImpl) return { ok: false, to, error: 'fetch_unavailable' };

  const url = endpointFor(access, opts, `${access.phoneNumberId}/messages`);
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name,
      language: { code: opts.language ?? 'en' },
      components:
        variables.length > 0
          ? [{ type: 'body', parameters: variables.map((v) => ({ type: 'text', text: String(v) })) }]
          : [],
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
    const raw = await res.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      /* ok */
    }
    if (res.ok) {
      const id = (parsed as { messages?: Array<{ id?: string }> } | null)?.messages?.[0]?.id;
      return { ok: true, to, messageId: id, status: 'sent' };
    }
    const err = (parsed as { error?: { message?: string; code?: number } } | null)?.error;
    return {
      ok: false,
      to,
      error: 'http_error',
      status: 'failed',
      errorDetail: err?.message ? `${err.code ?? res.status}: ${err.message}` : `HTTP ${res.status}`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, to, error: 'network_error', status: 'failed', errorDetail: msg };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Disparo em massa (loop com delay configurável + overrides para teste)
// ---------------------------------------------------------------------------

export interface Recipient {
  to: string;
  /** Texto individual. Se ausente e `template` definido, usa o template. */
  text?: string;
}

export interface MassSendOptions {
  /** Pausa (ms) entre envios — antiflood. */
  delayMs?: number;
  /** Usa template oficial em vez de texto livre. */
  template?: { name: string; variables: string[]; language?: string };
  /** Overrides (injetáveis para testes). */
  sendText?: typeof sendWhatsAppText;
  sendTemplate?: typeof sendWhatsAppTemplate;
}

export interface MassSendResult {
  total: number;
  sent: number;
  failed: number;
  results: SendTextResult[];
}

/**
 * Envia para todos os destinatários, com delay entre eles. Cada envio
 * individual nunca lança (o loop continua mesmo com falhas), agregando
 * contagens no final. `total` sempre reflete o número de destinatários.
 */
export async function runMassSend(
  access: MetaWABAccess,
  recipients: Recipient[],
  opts: MassSendOptions = {},
): Promise<MassSendResult> {
  const sendText = opts.sendText ?? sendWhatsAppText;
  const sendTemplate = opts.sendTemplate ?? sendWhatsAppTemplate;
  const delayMs = opts.delayMs ?? 0;
  const results: SendTextResult[] = [];
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    let res: SendTextResult;
    if (opts.template) {
      res = await sendTemplate(
        access,
        r.to,
        opts.template.name,
        opts.template.variables,
        { language: opts.template.language },
      );
    } else {
      res = await sendText(access, r.to, r.text ?? '');
    }
    results.push(res);
    if (res.ok) sent++;
    else failed++;
    if (delayMs > 0 && i < recipients.length - 1) await sleep(delayMs);
  }

  return { total: recipients.length, sent, failed, results };
}
