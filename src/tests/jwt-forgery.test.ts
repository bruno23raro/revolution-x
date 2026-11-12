/**
 * Teste de auditoria de segurança JWT - Ataques de forja
 * FASE 4.8: Auditoria independente da criptografia
 * FASE 4.10: Fail-closed - DEMO_JWT_SECRET obrigatório
 */

import crypto from 'crypto';

// Constantes do demoMode.ts
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000002';

// DEMO_JWT_SECRET deve estar definido em .env.local (sem fallback)
const TEST_SECRET = process.env.DEMO_JWT_SECRET!;
if (!TEST_SECRET) {
  throw new Error('DEMO_JWT_SECRET não está definido em .env.local');
}

// Funções replicadas da implementação real
function toBase64Url(str: string): string {
  return Buffer.from(str).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function verifyDemoSignature(header: string, payload: string, signature: string): boolean {
  try {
    const signData = `${header}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', TEST_SECRET)
      .update(signData)
      .digest('base64')
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

function decodeJwtPayload(token: string): { header: Record<string, unknown>; payload: Record<string, unknown> } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signature] = parts;

    if (!verifyDemoSignature(headerB64, payloadB64, signature)) {
      return null;
    }

    const headerB64Padded = headerB64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (headerB64.length % 4)) % 4);
    const header = JSON.parse(Buffer.from(headerB64Padded, 'base64').toString('utf8'));

    const payloadB64Padded = payloadB64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (payloadB64.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(payloadB64Padded, 'base64').toString('utf8'));

    return { header, payload };
  } catch {
    return null;
  }
}

function isDemoToken(token: string | null): boolean {
  if (!token) return false;
  const result = decodeJwtPayload(token);
  if (!result) return false;
  const payload = result.payload;
  if (payload.is_demo !== true) return false;
  if (payload.sub !== DEMO_USER_ID) return false;
  if (payload.org_id !== DEMO_ORG_ID) return false;
  const exp = Number(payload.exp ?? '');
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) return false;
  return true;
}

function decodeDemoToken(token: string | null): { userId: string; email: string; organizationId: string; role: string } | null {
  const result = decodeJwtPayload(token!);
  if (!result) return null;
  const payload = result.payload;
  if (payload.is_demo !== true) return null;
  if (payload.sub !== DEMO_USER_ID) return null;
  if (payload.org_id !== DEMO_ORG_ID) return null;
  const exp = Number(payload.exp ?? '');
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) return null;

  return {
    userId: DEMO_USER_ID,
    email: typeof payload.email === 'string' ? payload.email : 'demo@revolutionx.dev',
    organizationId: DEMO_ORG_ID,
    role: typeof payload.role === 'string' ? payload.role : '',
  };
}

function makeToken(payload: object): string {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signData = `${header}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', TEST_SECRET)
    .update(signData)
    .digest('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${header}.${encodedPayload}.${signature}`;
}

function validDemoPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sub: DEMO_USER_ID,
    email: 'demo@revolutionx.dev',
    org_id: DEMO_ORG_ID,
    role: 'admin',
    is_demo: true,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    ...overrides,
  };
}

describe('JWT Forgery Attacks - FASE 4.8', () => {
  describe('1. Fixed signature "demodummy"', () => {
    it('should block token with fixed signature "demodummy"', () => {
      const toB64 = (s: string) =>
        Buffer.from(s).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

      const header = toB64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = toB64(JSON.stringify(validDemoPayload()));
      const fakeSignature = 'demodummy';
      const forgedToken = `${header}.${payload}.${fakeSignature}`;

      expect(isDemoToken(forgedToken)).toBe(false);
      expect(decodeDemoToken(forgedToken)).toBeNull();
    });
  });

  describe('2. Wrong secret key', () => {
    it('should block token signed with wrong secret', () => {
      const wrongSecret = 'wrong-secret-key-12345';
      const toB64 = (s: string) =>
        Buffer.from(s).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

      const header = toB64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = toB64(JSON.stringify(validDemoPayload()));

      const signData = `${header}.${payload}`;
      const fakeSig = crypto
        .createHmac('sha256', wrongSecret)
        .update(signData)
        .digest('base64')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

      const forgedToken = `${header}.${payload}.${fakeSig}`;

      expect(isDemoToken(forgedToken)).toBe(false);
      expect(decodeDemoToken(forgedToken)).toBeNull();
    });
  });

  describe('3. Wrong sub in payload', () => {
    it('should block token with different sub (attacker user ID)', () => {
      const maliciousPayload = validDemoPayload({
        sub: 'real-user-id-12345',
        email: 'attacker@evil.com',
      });
      const forgedToken = makeToken(maliciousPayload);

      expect(isDemoToken(forgedToken)).toBe(false);
      expect(decodeDemoToken(forgedToken)).toBeNull();
    });

    it('should block token with wrong org_id', () => {
      const forgedPayload = validDemoPayload({ org_id: 'fake-org-id-test' });
      const forgedToken = makeToken(forgedPayload);

      expect(isDemoToken(forgedToken)).toBe(false);
      expect(decodeDemoToken(forgedToken)).toBeNull();
    });
  });

  describe('4. Expired token', () => {
    it('should block expired token (exp in the past)', () => {
      const pastExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const expiredPayload = validDemoPayload({ exp: pastExp });
      const forgedToken = makeToken(expiredPayload);

      expect(isDemoToken(forgedToken)).toBe(false);
      expect(decodeDemoToken(forgedToken)).toBeNull();
    });
  });

  describe('5. Missing is_demo field', () => {
    it('should block token without is_demo field', () => {
      const { is_demo, ...payloadWithoutIsDemo } = validDemoPayload();
      const forgedToken = makeToken(payloadWithoutIsDemo);

      expect(isDemoToken(forgedToken)).toBe(false);
      expect(decodeDemoToken(forgedToken)).toBeNull();
    });

    it('should block token with is_demo=false', () => {
      const forgedToken = makeToken(validDemoPayload({ is_demo: false }));

      expect(isDemoToken(forgedToken)).toBe(false);
      expect(decodeDemoToken(forgedToken)).toBeNull();
    });
  });

  describe('6. Invalid base64 encoding', () => {
    it('should block token with invalid base64 characters', () => {
      const malformedToken = 'header!!.!!invalid!!.base64!!payload.signature';

      expect(isDemoToken(malformedToken)).toBe(false);
      expect(decodeDemoToken(malformedToken)).toBeNull();
    });

    it('should block token with only 2 parts instead of 3', () => {
      const validParts = makeToken(validDemoPayload()).split('.');
      const incompleteToken = `${validParts[0]}.${validParts[1]}`;

      expect(isDemoToken(incompleteToken)).toBe(false);
      expect(decodeDemoToken(incompleteToken)).toBeNull();
    });
  });

  describe('Valid token should pass', () => {
    it('should accept valid demo token', () => {
      const validToken = makeToken(validDemoPayload());

      expect(isDemoToken(validToken)).toBe(true);
      expect(decodeDemoToken(validToken)).toEqual({
        userId: DEMO_USER_ID,
        email: 'demo@revolutionx.dev',
        organizationId: DEMO_ORG_ID,
        role: 'admin',
      });
    });
  });
});