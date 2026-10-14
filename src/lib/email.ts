// src/lib/email.ts — Pluggable email interface
//
// A real, officially-maintained provider is now available: Resend
// (ResendEmailProvider, fetch-based, no added runtime dependency). The
// provider is selected in getMailProvider() from EMAIL_PROVIDER + its
// credentials (EMAIL_API_KEY, EMAIL_FROM). Until those are set, the module
// falls back safely:
//
// DEFAULT:
//   - development/test : ConsoleEmailProvider (visible, no external call)
//   - production       : NoopEmailProvider (safe, no external call)
//
// Set EMAIL_PROVIDER=resend + EMAIL_API_KEY + EMAIL_FROM in the deploy
// environment to get real transactional delivery. Never log tokens,
// recovery links, or the API key.

import crypto from 'crypto';

export interface EmailTemplate {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailProvider {
  send(template: EmailTemplate): Promise<{ messageId: string }>;
}

export class NoopEmailProvider implements EmailProvider {
  async send(_template: EmailTemplate): Promise<{ messageId: string }> {
    // No-op: do not log full template (may contain tokens).
    console.debug('[email] would-send to=', _template.to, 'subject=', _template.subject);
    return { messageId: crypto.randomUUID() };
  }
}

export class ConsoleEmailProvider implements EmailProvider {
  async send(template: EmailTemplate): Promise<{ messageId: string }> {
    // WARNING: Only use in development/test. Never log tokens or secrets.
    console.info('[email] to=', template.to, 'subject=', template.subject);
    console.info('[email] html-preview=', template.html.slice(0, 200));
    return { messageId: crypto.randomUUID() };
  }
}

// Resend (https://resend.com) transactional email provider.
//
// Official, actively-maintained REST API. Implemented with a global fetch so
// no new runtime dependency is added. Enabled only when the operator has:
//   - EMAIL_PROVIDER=resend
//   - EMAIL_API_KEY=<re_...>          (server-side secret, never logged)
//   - EMAIL_FROM="Revolution X <name@domain>"
//
// Security:
//   - The API key is sent only in the Authorization header; it is NEVER
//     written to the log and NEVER returned to a client.
//   - On a non-2xx response we surface a safe, provider-neutral error.
//     The raw body (which may echo request fields) is only included in the
//     error detail that the caller is expected to swallow / log server-side.
export class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly from: string
  ) {}

  private get baseUrl(): string {
    // Overridable for tests / self-hosted Resend-compatible gateways.
    return process.env.EMAIL_API_BASE_URL ?? 'https://api.resend.com';
  }

  async send(template: EmailTemplate): Promise<{ messageId: string }> {
    if (!this.apiKey) throw new Error('EMAIL_API_KEY is not configured');
    if (!this.from) throw new Error('EMAIL_FROM is not configured');

    const res = await fetch(`${this.baseUrl}/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        from: this.from,
        to: template.to,
        subject: template.subject,
        html: template.html,
        ...(template.text ? { text: template.text } : {}),
      }),
    });

    if (!res.ok) {
      // Do NOT log the request body (may contain a recovery token / link).
      const errText = await res.text().catch(() => '');
      console.error(
        `[email:resend] send failed status=${res.status} safeDetail=${safeDetail(errText)}`
      );
      throw new Error(`Resend rejected the message (HTTP ${res.status})`);
    }

    const data = (await res.json().catch(() => ({}))) as { id?: string };
    // Never log messageId+subject in a way that reveals link content; the id
    // alone is a safe provider message handle.
    return { messageId: data.id ?? '' };
  }
}

// Redacts any URL-looking token from a provider error body before it can be
// logged. Defensive: Resend errors are usually short, but we never want a
// recovery link to land in a log line.
function safeDetail(raw: string): string {
  const trimmed = raw.slice(0, 200);
  return trimmed.replace(/token=[^\s&"']+/gi, 'token=[REDACTED]');
}

// Resolve the active provider.
//
// Provider selection order:
//   1. If EMAIL_PROVIDER is set to a known real provider AND its credentials
//      are present, use that real provider. This is how production gets real
//      delivery (e.g. EMAIL_PROVIDER=resend + EMAIL_API_KEY + EMAIL_FROM).
//   2. In development/test without a configured real provider, fall back to
//      ConsoleEmailProvider (visible, no-op-ish, safe).
//   3. In production without a configured real provider, fall back to
//      NoopEmailProvider (safe default — no emails actually sent, but the
//      auth flow never hard-fails on missing config).
let _provider: EmailProvider | null = null;

export function getMailProvider(): EmailProvider {
  if (_provider) return _provider;

  const env = process.env.NODE_ENV;
  const name = (process.env.EMAIL_PROVIDER ?? '').toLowerCase();

  if (name === 'resend') {
    const key = process.env.EMAIL_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (key && from) {
      _provider = new ResendEmailProvider(key, from);
    } else {
      // Misconfiguration: requested Resend but missing credentials. Fail safe
      // (no crash) but make the gap visible in the log.
      console.warn(
        '[email] EMAIL_PROVIDER=resend is set but EMAIL_API_KEY/EMAIL_FROM are missing — falling back to a no-op provider. No real email will be sent.'
      );
      _provider = env === 'development' || env === 'test'
        ? new ConsoleEmailProvider()
        : new NoopEmailProvider();
    }
    return _provider;
  }

  _provider = (env === 'development' || env === 'test')
    ? new ConsoleEmailProvider()
    : new NoopEmailProvider();
  return _provider;
}

// Test-only: clear the cached provider so a test can re-resolve after changing
// process.env. Not used outside tests.
export function _resetMailProviderForTests(): void {
  _provider = null;
}

/**
 * Generates a cryptographically secure token and returns its SHA-256 hash
 * for storage. The raw token is returned to the caller for inclusion in the
 * email/link. The hash is stored in the database; the raw token is never
 * persisted.
 */
export function generateSecureToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('hex'); // 64-char hex token
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}
