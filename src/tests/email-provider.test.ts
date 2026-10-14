import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import {
  ResendEmailProvider,
  NoopEmailProvider,
  ConsoleEmailProvider,
  getMailProvider,
  _resetMailProviderForTests,
} from '@/lib/email';

function envSet(vars: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe('getMailProvider selection', () => {
  afterAll(() => {
    envSet({ EMAIL_PROVIDER: undefined, EMAIL_API_KEY: undefined, EMAIL_FROM: undefined });
    _resetMailProviderForTests();
  });

  it('uses Resend when EMAIL_PROVIDER=resend with credentials', () => {
    envSet({ NODE_ENV: 'production', EMAIL_PROVIDER: 'resend', EMAIL_API_KEY: 're_test', EMAIL_FROM: 'X <a@b.c>' });
    _resetMailProviderForTests();
    expect(getMailProvider()).toBeInstanceOf(ResendEmailProvider);
  });

  it('falls back to Noop in production when Resend creds are missing', () => {
    envSet({ NODE_ENV: 'production', EMAIL_PROVIDER: 'resend', EMAIL_API_KEY: undefined, EMAIL_FROM: undefined });
    _resetMailProviderForTests();
    expect(getMailProvider()).toBeInstanceOf(NoopEmailProvider);
  });

  it('uses Console in dev/test when no real provider is configured', () => {
    envSet({ NODE_ENV: 'test', EMAIL_PROVIDER: undefined, EMAIL_API_KEY: undefined, EMAIL_FROM: undefined });
    _resetMailProviderForTests();
    expect(getMailProvider()).toBeInstanceOf(ConsoleEmailProvider);
  });
});

describe('ResendEmailProvider.send', () => {
  let originalFetch: typeof fetch;
  let lastBody: unknown;
  let lastAuth: string | null;

  beforeEach(() => {
    originalFetch = global.fetch;
    lastBody = undefined;
    lastAuth = null;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  function mockFetch(status: number, json?: unknown) {
    global.fetch = jest.fn().mockImplementation(async (_url: unknown, init?: { headers?: Record<string, string>; body?: string }) => {
      lastAuth = init?.headers?.['Authorization'] ?? null;
      lastBody = init?.body ? JSON.parse(init.body) : undefined;
      return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => JSON.stringify(json ?? { id: 'msg_123' }),
        json: async () => json ?? { id: 'msg_123' },
      } as Response;
    }) as unknown as typeof fetch;
  }

  it('posts to the Resend endpoint with Bearer auth and returns the message id', async () => {
    mockFetch(200, { id: 'msg_abc' });
    const p = new ResendEmailProvider('re_key', 'Revolution X <noreply@x.com>');
    const res = await p.send({ to: 'a@b.c', subject: 's', html: '<p>hi</p>' });
    expect(res.messageId).toBe('msg_abc');
    expect(lastAuth).toBe('Bearer re_key');
    expect(lastBody).toMatchObject({ to: 'a@b.c', subject: 's', html: '<p>hi</p>', from: 'Revolution X <noreply@x.com>' });
  });

  it('includes a text part only when provided', async () => {
    mockFetch(200, { id: 'm' });
    const p = new ResendEmailProvider('k', 'F <f@x.com>');
    await p.send({ to: 'a@b.c', subject: 's', html: 'h' });
    expect(lastBody).not.toHaveProperty('text');
  });

  it('throws on a non-2xx response (send failure surfaces to the caller)', async () => {
    mockFetch(500, { message: 'internal' });
    const p = new ResendEmailProvider('k', 'F <f@x.com>');
    await expect(p.send({ to: 'a@b.c', subject: 's', html: 'h' })).rejects.toThrow(/500/);
  });

  it('throws when the API key or sender is not configured', async () => {
    const p = new ResendEmailProvider('', 'F <f@x.com>');
    await expect(p.send({ to: 'a', subject: 's', html: 'h' })).rejects.toThrow(/EMAIL_API_KEY/);
  });
});
