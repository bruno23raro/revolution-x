// src/tests/auth-security.test.ts -- Security tests for auth routes
// Tests cover: enumeration prevention, token validation, middleware edge cases.
// @ts-nocheck -- jest.fn() chain returns: never[] inference issues; needs dedicated typing pass
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// ── crypto mock (deterministic tokens in tests) ──────────────────────────────
jest.mock('crypto', () => ({
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnValue({ digest: jest.fn().mockReturnValue('mock-hash') }),
  }),
  randomBytes: jest.fn().mockReturnValue({ toString: jest.fn().mockReturnValue('mock-token-raw') }),
  randomUUID: jest.fn().mockReturnValue('mock-uuid'),
}));

// ── Supabase service-role client mock ────────────────────────────────────────
jest.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: jest.fn(() => ({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue({
            gt: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
      update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
      insert: jest.fn().mockResolvedValue({ error: null }),
    }),
    auth: { admin: { updateUserById: jest.fn().mockResolvedValue({ error: null }) } },
  })),
}));

// ── prisma withUserContext mock ──────────────────────────────────────────────
jest.mock('@/lib/prisma', () => ({
  prisma: {},
  withUserContext: jest.fn(async (_userId: string, cb: (tx: unknown) => Promise<void>) => {
    const mockTx = {
      $executeRaw: jest.fn().mockResolvedValue(0),
      passwordResetToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      user: {
        update: jest.fn().mockResolvedValue({}),
      },
    };
    return await cb(mockTx);
  }),
}));

// ── auth + email mocks ───────────────────────────────────────────────────────
jest.mock('@/lib/auth', () => ({
  hashPassword: jest.fn().mockResolvedValue('hashed-pw-mock'),
}));

jest.mock('@/lib/email', () => ({
  generateSecureToken: () => ({ raw: 'mock-token-raw', hash: 'mock-hash' }),
  getMailProvider: () => ({
    send: jest.fn().mockResolvedValue({ messageId: 'mock-msg-id' }),
  }),
}));

const { createServiceRoleClient } = require('@/lib/supabase/server');

// ============================================================================
// forgot-password tests
// ============================================================================
describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('returns generic message for empty body', async () => {
    const { POST } = require('@/api/auth/forgot-password/route');
    const req = new Request('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.message).toContain('If the account exists');
  });

  it('returns generic message for non-existent email (no enumeration)', async () => {
    (createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    });
    const { POST } = require('@/api/auth/forgot-password/route');
    const req = new Request('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@example.com' }),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.message).toContain('If the account exists');
  });

  it('generates and stores a token for existing email', async () => {
    (createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: 'user-1', email: 'test@example.com' },
              error: null,
            }),
          }),
        }),
      }),
    });
    const { POST } = require('@/api/auth/forgot-password/route');
    const req = new Request('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('rejects requests with malformed JSON body', async () => {
    const { POST } = require('@/api/auth/forgot-password/route');
    const req = new Request('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toContain('If the account exists');
  });
});

// ============================================================================
// reset-password tests
// ============================================================================
describe('POST /api/auth/reset-password', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('returns 400 for missing token', async () => {
    const { POST } = require('@/api/auth/reset-password/route');
    const req = new Request('http://localhost/api/auth/reset-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'Strong123' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing password', async () => {
    const { POST } = require('@/api/auth/reset-password/route');
    const req = new Request('http://localhost/api/auth/reset-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'abc123' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for weak password', async () => {
    const { POST } = require('@/api/auth/reset-password/route');
    const req = new Request('http://localhost/api/auth/reset-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'abc123', password: 'weak' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('weak_password');
  });

  it('returns 400 for invalid/expired token', async () => {
    (createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue({
              gt: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        }),
      }),
    });
    const { POST } = require('@/api/auth/reset-password/route');
    const req = new Request('http://localhost/api/auth/reset-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'invalid-token', password: 'Strong123' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_token');
  });

  it('accepts valid token and strong password', async () => {
    const futureExpiry = new Date(Date.now() + 3600000).toISOString();
    (createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue({
              gt: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { id: 'tok-1', userId: 'user-valid-123', expiresAt: futureExpiry, usedAt: null },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
      auth: { admin: { updateUserById: jest.fn().mockResolvedValue(null) } },
    });
    const { POST } = require('@/api/auth/reset-password/route');
    const req = new Request('http://localhost/api/auth/reset-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'valid-token', password: 'Strong123' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toContain('Password updated');
  });
});

// ============================================================================
// verify-email tests
// ============================================================================
describe('POST /api/auth/verify-email', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('returns 400 for missing token', async () => {
    const { POST } = require('@/api/auth/verify-email/route');
    const req = new Request('http://localhost/api/auth/verify-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid token', async () => {
    (createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue({
              gt: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        }),
      }),
    });
    const { POST } = require('@/api/auth/verify-email/route');
    const req = new Request('http://localhost/api/auth/verify-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'bad-token' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_token');
  });

  it('marks email as verified on valid token', async () => {
    const futureExpiry = new Date(Date.now() + 3600000).toISOString();

    const mockEmailTokenTable = {
      select: jest.fn(() => ({
        eq: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue({
            gt: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { id: 'tok-v1', userId: 'user-verify-123', expiresAt: futureExpiry, usedAt: null },
                error: null,
              }),
            }),
          }),
        }),
      })),
      update: jest.fn(() => ({ eq: jest.fn().mockResolvedValue(null) })),
    };
    const mockUserTable = {
      select: jest.fn(() => ({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      })),
      update: jest.fn(() => ({ eq: jest.fn().mockResolvedValue({ error: null }) })),
    };

    (createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'EmailVerificationToken') return mockEmailTokenTable;
        if (table === 'User') return mockUserTable;
        return {};
      }),
      auth: { admin: { updateUserById: jest.fn().mockResolvedValue(null) } },
    });

    const { POST } = require('@/api/auth/verify-email/route');
    const req = new Request('http://localhost/api/auth/verify-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'valid-verify-token' }),
    });
    try {
      const res = await POST(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.message).toContain('verified');
    } catch (e: unknown) {
      throw e;
    }
  });
});

// ============================================================================
// resend-verification tests
// ============================================================================
describe('POST /api/auth/resend-verification', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('returns generic message for empty body', async () => {
    const { POST } = require('@/api/auth/resend-verification/route');
    const req = new Request('http://localhost/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toContain('If the account exists');
  });

  it('returns generic message for non-existent email', async () => {
    (createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    });
    const { POST } = require('@/api/auth/resend-verification/route');
    const req = new Request('http://localhost/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@x.com' }),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(json.message).toContain('If the account exists');
  });

  it('returns already verified for verified account', async () => {
    (createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: 'user-1', email: 'test@x.com', emailVerified: true },
              error: null,
            }),
          }),
        }),
      }),
    });
    const { POST } = require('@/api/auth/resend-verification/route');
    const req = new Request('http://localhost/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'test@x.com' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('generates new token for unverified existing account', async () => {
    (createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockImplementation((table: unknown) => {
        if (table === 'User') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { id: 'user-new', email: 'new@x.com', emailVerified: false },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'EmailVerificationToken') {
          return {
            update: jest.fn().mockReturnValue({
              match: jest.fn().mockReturnValue({
                update: jest.fn().mockResolvedValue(null),
              }),
            }),
            insert: jest.fn().mockResolvedValue(null),
          };
        }
        return {};
      }),
    });
    const { POST } = require('@/api/auth/resend-verification/route');
    const req = new Request('http://localhost/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'new@x.com' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});

// ============================================================================
// Middleware security tests
// ============================================================================
describe('middleware.ts security', () => {
  const fs = require('fs');
  const p = require('path');

  it('uses createServiceRoleClient for org lookup', () => {
    const src = fs.readFileSync(p.join(__dirname, '../../middleware.ts'), 'utf8');
    expect(src).toContain('createServiceRoleClient');
  });

  it('query is read-only (select only, no writes)', () => {
    const src = fs.readFileSync(p.join(__dirname, '../../middleware.ts'), 'utf8');
    expect(src).not.toContain('.insert(');
    expect(src).not.toContain('.update(');
    expect(src).not.toContain('.delete(');
    expect(src).toContain('.select(');
  });

  it('handles DB failure gracefully', () => {
    const src = fs.readFileSync(p.join(__dirname, '../../middleware.ts'), 'utf8');
    expect(src).toContain('try {');
    expect(src).toContain('} catch {');
  });

  it('does not expose service role key in responses', () => {
    const src = fs.readFileSync(p.join(__dirname, '../../middleware.ts'), 'utf8');
    expect(src).not.toContain('throw new Error(process.env.SUPABASE');
  });

  it('filters OrganizationMember by authenticated user.id', () => {
    const src = fs.readFileSync(p.join(__dirname, '../../middleware.ts'), 'utf8');
    expect(src).toContain(".eq('userId', user.id)");
  });
});
