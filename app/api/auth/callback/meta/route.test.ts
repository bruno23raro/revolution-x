import { GET } from './route';
import { NextRequest } from 'next/server';

// Mock crypto: preserva as funções reais (a rota usa timingSafeEqual em
// secureCompare) e fixa randomUUID para determinismo.
jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto');
  return { ...actual, randomUUID: () => 'test-uuid-1234' };
});

// Mock da fronteira Supabase que a rota importa (src/lib/supabase/server):
// createClient → controlado por teste (usuário logado ou não).
const mockGetUser = jest.fn();
const mockDbChain = {
  select: jest.fn(() => mockDbChain),
  eq: jest.fn(() => mockDbChain),
  is: jest.fn(() => mockDbChain),
  maybeSingle: jest.fn(async () => ({ data: null, error: null })),
  update: jest.fn(async () => ({ error: null })),
  insert: jest.fn(async () => ({ error: null })),
};
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: jest.fn(() => mockDbChain),
  })),
  createServiceRoleClient: jest.fn(() => ({
    from: jest.fn(() => mockDbChain),
  })),
}));

// Mock da fronteira Prisma: withUserContext executa o callback com um tx falso.
const mockFindUnique = jest.fn();
jest.mock('@/lib/prisma', () => ({
  prisma: {},
  withUserContext: jest.fn(async (_userId: string, fn: (tx: unknown) => Promise<unknown>) =>
    fn({ user: { findUnique: mockFindUnique } }),
  ),
}));

const originalEnv = process.env;
const originalFetch = global.fetch;

const AUTHED_USER = { data: { user: { id: 'user-1' } } };
const DB_USER_WITH_ORG = { organizationMembers: [{ organizationId: 'org-1' }] };

function cbReq(query: string, cookie = 'oauth_state=facebook:good') {
  return new NextRequest(`https://revolutionx.com.br/api/auth/callback/meta${query}`, {
    headers: { cookie },
  });
}

describe('OAuth callback meta', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      META_APP_ID: 'test',
      META_APP_SECRET: 'test',
      META_TOKEN_ENCRYPTION_KEY: 'x'.repeat(32),
    };
    delete process.env.NEXT_PUBLIC_SITE_URL;
    mockGetUser.mockResolvedValue(AUTHED_USER);
    mockFindUnique.mockResolvedValue(DB_USER_WITH_ORG);
  });
  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('rejeita state ausente', async () => {
    const res = await GET(cbReq('?code=x', ''));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).searchParams.get('reason')).toBe('state_missing');
  });

  it('rejeita state inválido (cookie diferente) — state_invalid', async () => {
    const res = await GET(cbReq('?code=x&state=bad', 'oauth_state=good'));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).searchParams.get('reason')).toBe('state_invalid');
  });

  it('rejeita cookie de state ausente mesmo com state no query', async () => {
    const res = await GET(cbReq('?code=x&state=good', ''));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).searchParams.get('reason')).toBe('state_invalid');
  });

  it('rejeita code ausente', async () => {
    const res = await GET(cbReq('?state=good'));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).searchParams.get('reason')).toBe('code_missing');
  });

  it('rejeita error OAuth', async () => {
    const res = await GET(cbReq('?error=access_denied'));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).searchParams.get('reason')).toBe('oauth_error');
  });

  it('rejeita sem sessão (getUser → null)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(cbReq('?code=x&state=good'));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).searchParams.get('reason')).toBe('not_authenticated');
  });

  it('rejeita sem organização (membership vazio)', async () => {
    mockFindUnique.mockResolvedValue({ organizationMembers: [] });
    const res = await GET(cbReq('?code=x&state=good'));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).searchParams.get('reason')).toBe('not_authenticated');
  });

  it('degrada config_missing quando META_* ausentes no host', async () => {
    delete process.env.META_APP_ID;
    delete process.env.META_APP_SECRET;
    const res = await GET(cbReq('?code=x&state=good'));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).searchParams.get('reason')).toBe('config_missing');
  });

  it('token exchange falho (Meta HTTP 400) → token_exchange_failed, sem token na URL', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Invalid OAuth access token - Cannot parse access token' } }),
      text: async () => 'bad request',
    })) as unknown as typeof fetch;

    const res = await GET(cbReq('?code=x&state=good'));
    expect(res.status).toBe(307);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.pathname).toBe('/onboarding/error');
    expect(loc.searchParams.get('reason')).toBe('token_exchange_failed');
    // O code/token NUNCA reaparece na URL de erro.
    expect(res.headers.get('location')).not.toContain('code=x');
  });

  it('token exchange com erro de rede → token_exchange_failed (sem stack no redirect)', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;

    const res = await GET(cbReq('?code=x&state=good'));
    expect(res.status).toBe(307);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.searchParams.get('reason')).toBe('token_exchange_failed');
  });

  it('exchange usa redirect_uri da origem pública (NEXT_PUBLIC_SITE_URL), não o origin interno', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://revolutionx.com.br';
    const calls: string[] = [];
    global.fetch = jest.fn(async (input: unknown) => {
      const url = String(input);
      calls.push(url);
      return {
        ok: true,
        status: 200,
        json: async () =>
          url.includes('oauth/access_token')
            ? { access_token: 'tok', expires_in: 3600 }
            : { data: [] },
      };
    }) as unknown as typeof fetch;

    // Request visto pelo app em produção atrás do proxy interno (0.0.0.0).
    const req = new NextRequest('http://0.0.0.0:3000/api/auth/callback/meta?code=x&state=good', {
      headers: { cookie: 'oauth_state=facebook:good' },
    });
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/onboarding/success');
    const tokenCall = calls.find((u) => u.includes('oauth/access_token'));
    expect(tokenCall).toBeDefined();
    expect(decodeURIComponent(tokenCall!)).toContain(
      'redirect_uri=https://revolutionx.com.br/api/auth/callback/meta',
    );
    expect(decodeURIComponent(tokenCall!)).not.toContain('0.0.0.0');
  });

  it('sucesso → /onboarding/success e cookie de state limpo (uso único)', async () => {
    global.fetch = jest.fn(async (input: unknown) => {
      const url = String(input);
      return {
        ok: true,
        status: 200,
        json: async () =>
          url.includes('oauth/access_token')
            ? { access_token: 'tok', expires_in: 3600 }
            : { data: [] },
      };
    }) as unknown as typeof fetch;

    const res = await GET(cbReq('?code=x&state=good'));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/onboarding/success');
    // state é de uso único — o cookie precisa ser invalidado.
    expect(res.cookies.get('oauth_state')?.value).toBe('');
    // token NUNCA aparece no redirect.
    expect(res.headers.get('location')).not.toContain('tok');
  });
});
