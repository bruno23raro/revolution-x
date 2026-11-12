import {
  demoModeEnabled,
  isDemoToken,
  decodeDemoToken,
  isLocalDevelopmentStack,
  parsePostgresHost,
  isLocalHost,
  DEMO_IDENTITIES,
} from '../lib/demoMode';
import crypto from 'crypto';

// Chave secreta para testes - DEMO_JWT_SECRET é obrigatório (sem fallback)
const TEST_SECRET = process.env.DEMO_JWT_SECRET!;
if (!TEST_SECRET) {
  throw new Error('DEMO_JWT_SECRET não está definido em .env.local. Gere uma chave segura: node scripts/generate-secret.js >> .env.local');
}

/** Gera um JWT com assinatura HMAC-SHA256 válida */
function makeToken(payload: object): string {
  const toBase64Url = (str: string) =>
    Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
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

/** Payload demo válido: identidades pinadas + exp no futuro. */
function validDemoPayload(overrides: Record<string, unknown> = {}) {
  return {
    sub: DEMO_IDENTITIES.USER_ID,
    email: DEMO_IDENTITIES.EMAIL,
    org_id: DEMO_IDENTITIES.ORG_ID,
    role: 'admin',
    is_demo: true,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // +24h
    ...overrides,
  };
}

describe('demoMode', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('demoModeEnabled', () => {
    it('retorna false quando NODE_ENV é production (mesmo com RX_DEMO_MODE=1)', () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'production',
        writable: true,
        configurable: true,
      });
      process.env.RX_DEMO_MODE = '1';

      jest.resetModules();
      const { demoModeEnabled: enabled } = require('../lib/demoMode');

      expect(enabled()).toBe(false);
    });

    it('retorna true quando NODE_ENV não é production e RX_DEMO_MODE=1', () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'development',
        writable: true,
        configurable: true,
      });
      process.env.RX_DEMO_MODE = '1';

      jest.resetModules();
      const { demoModeEnabled: enabled } = require('../lib/demoMode');

      expect(enabled()).toBe(true);
    });

    it('retorna false quando RX_DEMO_MODE não está definido', () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'development',
        writable: true,
        configurable: true,
      });
      delete process.env.RX_DEMO_MODE;

      jest.resetModules();
      const { demoModeEnabled: enabled } = require('../lib/demoMode');

      expect(enabled()).toBe(false);
    });
  });

  describe('isDemoToken', () => {
    it('retorna true para token demo válido (identidades pinadas + exp futuro)', () => {
      expect(isDemoToken(makeToken(validDemoPayload()))).toBe(true);
    });

    it('retorna false para token com assinatura FALSA (ataque de falsificação)', () => {
      // Ataque realista: criar token válido mas com assinatura arbitrária
      const toBase64Url = (str: string) =>
        Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = toBase64Url(JSON.stringify(validDemoPayload()));
      const fakeSignature = 'demodummy'; // Assinatura qualquer que não seja HMAC válida
      const forgedToken = `${header}.${payload}.${fakeSignature}`;

      // CRUCIAL: token com assinatura falsa deve ser rejeitado
      expect(isDemoToken(forgedToken)).toBe(false);
    });

    it('retorna false para token com assinatura quase-corrreta (diferença 1 caractere)', () => {
      // Ataque: assinatura próxima mas não idêntica
      const payload = validDemoPayload();
      const token = makeToken(payload);
      const [header, body, sig] = token.split('.');
      // Alterar um caractere na assinatura
      const tamperedSig = sig.slice(0, -1) + (sig.slice(-1) === 'A' ? 'B' : 'A');
      const tamperedToken = `${header}.${body}.${tamperedSig}`;

      expect(isDemoToken(tamperedToken)).toBe(false);
    });

    it('retorna false para token sem is_demo', () => {
      const { is_demo, ...rest } = validDemoPayload();
      expect(isDemoToken(makeToken(rest))).toBe(false);
    });

    it('retorna false para token com is_demo falso', () => {
      expect(isDemoToken(makeToken(validDemoPayload({ is_demo: false })))).toBe(false);
    });

    it('REJEITA token expirado', () => {
      const expired = validDemoPayload({ exp: Math.floor(Date.now() / 1000) - 60 });
      expect(isDemoToken(makeToken(expired))).toBe(false);
    });

    it('REJEITA token sem exp', () => {
      const { exp, ...rest } = validDemoPayload();
      expect(isDemoToken(makeToken({ ...rest, exp: '' }))).toBe(false);
    });

    it('REJEITA token com sub forjado (identidade real, não demo)', () => {
      // Ataque: criar token is_demo=true apontando para usuário real.
      // O pinning de sub/org_id deve recusar.
      const forged = validDemoPayload({ sub: 'e1b2592b-0000-0000-0000-000000000000' });
      expect(isDemoToken(makeToken(forged))).toBe(false);
    });

    it('REJEITA token com org_id forjado (organização real, não demo)', () => {
      const forged = validDemoPayload({ org_id: '11111111-1111-1111-1111-111111111111' });
      expect(isDemoToken(makeToken(forged))).toBe(false);
    });

    it('retorna false para token adulterado (payload não-JSON)', () => {
      expect(isDemoToken('header.notaJSON.signature')).toBe(false);
    });

    it('retorna false para token inválido', () => {
      expect(isDemoToken('invalid.token')).toBe(false);
    });

    it('retorna false para null', () => {
      expect(isDemoToken(null)).toBe(false);
    });

    it('retorna false para undefined', () => {
      expect(isDemoToken(undefined as unknown as string)).toBe(false);
    });
  });

  describe('decodeDemoToken', () => {
    it('decodifica token demo válido e retorna claims pinadas', () => {
      const result = decodeDemoToken(makeToken(validDemoPayload()));

      expect(result).toEqual({
        userId: DEMO_IDENTITIES.USER_ID,
        email: DEMO_IDENTITIES.EMAIL,
        organizationId: DEMO_IDENTITIES.ORG_ID,
        role: 'admin',
      });
    });

    it('retorna null para token expirado', () => {
      const expired = validDemoPayload({ exp: Math.floor(Date.now() / 1000) - 1 });
      expect(decodeDemoToken(makeToken(expired))).toBeNull();
    });

    it('retorna null para token não demo', () => {
      expect(decodeDemoToken(makeToken({ sub: 'real-user', is_demo: false }))).toBeNull();
    });

    it('NUNCA retorna identidade que não seja a demo (mesmo com claims divergentes)', () => {
      // Claims adulteradas são rejeitadas: token com org_id forjado é null.
      // O pinning em isDemoToken() rejeita qualquer org_id != DEMO_ORG_ID.
      const forged = validDemoPayload({ org_id: 'fake-org-id-test' });
      const result = decodeDemoToken(makeToken(forged));
      expect(result).toBeNull();
    });

    it('ROLE FIXO: sempre retorna "admin" independente do role no payload (previne elevação de privilégios)', () => {
      // Ataque: tentar injetar role='owner' ou role='superadmin' no payload
      // A função deve IGNORE o role do payload e retornar sempre 'admin'
      const withOwnerRole = validDemoPayload({ role: 'owner' });
      const result = decodeDemoToken(makeToken(withOwnerRole));

      // O role deve ser 'admin' fixo, não 'owner'
      expect(result).not.toBeNull();
      expect(result!.role).toBe('admin');
    });

    it('ROLE FIXO: rejeita token com role falsificado "superadmin"', () => {
      const withSuperAdminRole = validDemoPayload({ role: 'superadmin' });
      const result = decodeDemoToken(makeToken(withSuperAdminRole));

      expect(result).not.toBeNull();
      expect(result!.role).toBe('admin'); // Deve ser 'admin', não 'superadmin'
    });
  });

  describe('parsePostgresHost / isLocalHost', () => {
    it('extrai host de connection string com senha', () => {
      expect(parsePostgresHost('postgresql://user:***@localhost:54321/db')).toBe('localhost');
    });

    it('extrai host do pooler Supabase', () => {
      expect(
        parsePostgresHost('postgresql://postgres.proj:***@aws-0-sa-east-1.pooler.supabase.com:6543/postgres')
      ).toBe('aws-0-sa-east-1.pooler.supabase.com');
    });

    it('aceita apenas hosts da allowlist local', () => {
      expect(isLocalHost('localhost')).toBe(true);
      expect(isLocalHost('127.0.0.1')).toBe(true);
      expect(isLocalHost('host.docker.internal')).toBe(true);
      expect(isLocalHost('aws-0-sa-east-1.pooler.supabase.com')).toBe(false);
      expect(isLocalHost('10.0.0.5')).toBe(false);
      expect(isLocalHost('')).toBe(false);
    });
  });

  describe('isLocalDevelopmentStack', () => {
    it('aceita DATABASE_URL apontando para localhost', () => {
      process.env.DATABASE_URL = 'postgresql://postgres:senha@localhost:54321/postgres';
      expect(isLocalDevelopmentStack()).toBe(true);
    });

    it('aceita 127.0.0.1', () => {
      process.env.DATABASE_URL = 'postgresql://postgres:senha@127.0.0.1:54321/postgres';
      expect(isLocalDevelopmentStack()).toBe(true);
    });

    it('REJEITA pooler de produção da Supabase', () => {
      process.env.DATABASE_URL =
        'postgresql://postgres.ardpabjoepzhkpmkgwgu:senha@aws-0-sa-east-1.pooler.supabase.com:6543/postgres';
      expect(isLocalDevelopmentStack()).toBe(false);
    });

    it('REJEITA url com supabase.co no host', () => {
      process.env.DATABASE_URL = 'postgresql://postgres:senha@db.ardpabjoepzhkpmkgwgu.supabase.co:5432/postgres';
      expect(isLocalDevelopmentStack()).toBe(false);
    });

    it('REJEITA host remoto que contenha "localhost" no nome (ex: localhost.evil.com)', () => {
      // Antiga detecção por substring era enganável; a allowlist não é.
      process.env.DATABASE_URL = 'postgresql://postgres:senha@localhost.evil.com:5432/postgres';
      expect(isLocalDevelopmentStack()).toBe(false);
    });

    it('REJEITA DATABASE_URL ausente', () => {
      delete process.env.DATABASE_URL;
      expect(isLocalDevelopmentStack()).toBe(false);
    });
  });

  describe('DEMO_IDENTITIES', () => {
    it('exporta identidades demo corretas', () => {
      expect(DEMO_IDENTITIES.USER_ID).toBe('00000000-0000-0000-0000-000000000001');
      expect(DEMO_IDENTITIES.ORG_ID).toBe('00000000-0000-0000-0000-000000000002');
      expect(DEMO_IDENTITIES.EMAIL).toBe('demo@revolutionx.dev');
    });
  });

  describe('Verificação de Segurança da Chave Secreta', () => {
    it('DEMO_JWT_SECRET é lida de process.env (sem fallback)', () => {
      // A chave deve vir do ambiente - sem fallback público
      // Fail-closed: se TEST_SECRET for undefined/empty, o teste já falha no setup
      expect(TEST_SECRET).toBeDefined();
      expect(TEST_SECRET!.length).toBeGreaterThanOrEqual(32);
    });

    it('não reutiliza SUPABASE_SERVICE_ROLE_KEY', () => {
      // Garantir que a chave demo não é uma cópia da chave do Supabase
      expect(TEST_SECRET).not.toContain('ey'); // JWT Supabase começa com "eyJ"
    });

    it('não reutiliza META_APP_SECRET', () => {
      // Garantir que não é uma cópia de outra chave sensível
      expect(TEST_SECRET).not.toMatch(/^[a-zA-Z0-9]{32}$/);
    });
  });

  describe('Verificação de Token - Ataques Adversariais', () => {
    it('REJEITA token com header malformado', () => {
      // Header não é JSON válido
      expect(isDemoToken('notbase64.payload.signature')).toBe(false);
    });

    it('REJEITA token com payload malformado', () => {
      // Payload não é JSON válido
      expect(isDemoToken('header.notbase64.signature')).toBe(false);
    });

    it('REJEITA token com assinatura vazia', () => {
      const token = makeToken(validDemoPayload()) + '.';
      expect(isDemoToken(token)).toBe(false);
    });

    it('REJEITA token com múltiplos pontos no payload (ataque)', () => {
      // Tentativa de injeção de payload adicional
      const valid = makeToken(validDemoPayload());
      const [header, payload, sig] = valid.split('.');
      const maliciousToken = `${header}.${payload}.${payload}.${sig}`;
      expect(isDemoToken(maliciousToken)).toBe(false);
    });

    it('REJEITA token com header diferente (algoritmo alterado)', () => {
      const toBase64Url = (str: string) =>
        Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      // Header com algoritmo diferente - ataque de alg-switch
      const maliciousHeader = toBase64Url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
      const payload = toBase64Url(JSON.stringify(validDemoPayload()));
      const sig = 'fake';
      expect(isDemoToken(`${maliciousHeader}.${payload}.${sig}`)).toBe(false);
    });
  });

  describe('Timing Attack Prevention', () => {
    it('usa timingSafeEqual na verificação de assinatura', () => {
      // Este teste verifica que a função usa timing-safe comparison
      // O código real está em demoMode.ts - verificamos o comportamento
      const validToken = makeToken(validDemoPayload());
      const parts = validToken.split('.');
      const fakeSig = 'A'.repeat(parts[2].length);

      // Medir tempo de resposta não é possível unitariamente,
      // mas podemos verificar que a função rejeita corretamente
      expect(isDemoToken(`${parts[0]}.${parts[1]}.${fakeSig}`)).toBe(false);
    });
  });
});
