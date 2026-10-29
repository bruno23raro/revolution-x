// Conversions API (CAPI) — envio server-side de eventos de conversão para o
// Pixel (META_PIXEL_ID) usando o token de CAPI (META_CAPI_ACCESS_TOKEN).
//
// POST /{PIXEL_ID}/events — doc oficial (validado 2026-10-29, events_received:1).
// Dedup: (event_name, event_id) — mesmo par Pixel+CAPI conta 1 vez.
// user_data exige identificação hasheada (SHA-256 lowercase, email trim+lower).
//
// Como os outros serviços daqui: NÃO lança; retorna ok/error honesto.
// `fetchImpl` injetável para testes sem rede.

const DEFAULT_BASE = 'https://graph.facebook.com';
const DEFAULT_VERSION = 'v26.0';

export interface CapiEvent {
  eventName: string;
  /** UUID ou id único — dedup Pixel↔CAPI. Gerado se omitido. */
  eventId?: string;
  /** Segundos desde epoch (a Meta espera epoch s, não ms). */
  eventTime?: number;
  value?: number;
  currency?: string;
  /** E-mails/telefones em claro — hasheados aqui (SHA-256). */
  emails?: string[];
  phones?: string[];
  clientId?: string;
  customData?: Record<string, unknown>;
}

export interface CapiConfig {
  pixelId?: string;
  accessToken?: string;
  apiBase?: string;
  version?: string;
  /** Opcional — direciona p/ Events Manager "Test Events". */
  testEventCode?: string;
}

export interface CapiResult {
  ok: boolean;
  eventsReceived?: number;
  /** eventId efetivamente enviado (gerado quando omitido) — p/ dedup posterior. */
  eventId?: string;
  error?: 'capi_not_configured' | 'fetch_unavailable' | 'http_error' | 'network_error';
  errorDetail?: string;
}

export interface CapiOptions extends CapiConfig {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function sha256hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  return crypto.subtle.digest('SHA-256', bytes).then((buf) =>
    Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join(''),
  );
}

const normalizeEmail = (e: string) => e.trim().toLowerCase();
// shortcut: só remove não-dígitos; se um dia houver números internacionais,
// upgrade p/ libphonenumber (E.164 antes do hash, conforme doc da Meta).
const normalizePhone = (p: string) => p.replace(/\D/g, '');

export async function sendCapiEvent(event: CapiEvent, opts: CapiOptions = {}): Promise<CapiResult> {
  const withId = { ...event, eventId: event.eventId ?? crypto.randomUUID() };
  const r = await sendCapiEvents([withId], opts);
  return { ...r, eventId: withId.eventId };
}

export async function sendCapiEvents(events: CapiEvent[], opts: CapiOptions = {}): Promise<CapiResult> {
  const pixelId = opts.pixelId ?? process.env.META_PIXEL_ID;
  const token = opts.accessToken ?? process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !token) return { ok: false, error: 'capi_not_configured' };
  const fetchImpl = opts.fetchImpl ?? fetch;
  if (!fetchImpl) return { ok: false, error: 'fetch_unavailable' };

  const base = opts.apiBase ?? DEFAULT_BASE;
  const version = opts.version ?? DEFAULT_VERSION;
  const payload = {
    data: await Promise.all(
      events.map(async (e) => {
        const user_data: Record<string, unknown> = {};
        if (e.emails?.length) user_data.em = await Promise.all(e.emails.map((x) => sha256hex(normalizeEmail(x))));
        if (e.phones?.length) user_data.ph = await Promise.all(e.phones.map((x) => sha256hex(normalizePhone(x))));
        if (e.clientId) user_data.client_ip_address = e.clientId;
        const d: Record<string, unknown> = {
          event_name: e.eventName,
          event_id: e.eventId ?? crypto.randomUUID(),
          event_time: e.eventTime ?? Math.floor(Date.now() / 1000),
          action_source: 'website',
        };
        if (Object.keys(user_data).length) d.user_data = user_data;
        if (e.value !== undefined || e.currency)
          d.custom_data = { value: e.value, currency: e.currency, ...e.customData };
        else if (e.customData) d.custom_data = e.customData;
        return d;
      }),
    ),
    ...(opts.testEventCode ? { test_event_code: opts.testEventCode } : {}),
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 10_000);
  try {
    const res = await fetchImpl(`${base}/${version}/${pixelId}/events?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const body = (await res.json().catch(() => ({}))) as {
      events_received?: number;
      error?: { message?: string };
    };
    if (!res.ok) {
      return { ok: false, error: 'http_error', errorDetail: body.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, eventsReceived: body.events_received ?? 0 };
  } catch (err) {
    return { ok: false, error: 'network_error', errorDetail: String(err) };
  } finally {
    clearTimeout(timer);
  }
}
