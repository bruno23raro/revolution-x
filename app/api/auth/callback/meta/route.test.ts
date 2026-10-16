import { GET } from './route';
import { NextRequest } from 'next/server';

// Mock crypto: preserva as funções reais (a rota usa timingSafeEqual em
// secureCompare) e fixa randomUUID para determinismo.
jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto');
  return { ...actual, randomUUID: () => 'test-uuid-1234' };
});

// Mock da fronteira Supabase que a rota importa (src/lib/supabase/server):
// createClient → sem usuário (a rota redireciona para not_authenticated, 307).
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: jest.fn(async () => ({ data: { user: null } })) },
    from: jest.fn(() => ({ upsert: jest.fn(async () => ({ error: null })) })),
  })),
  createServiceRoleClient: jest.fn(),
}));

// Mock process.env
const originalEnv = process.env;

describe('OAuth callback meta', () => {
  beforeEach(() => { jest.clearAllMocks(); process.env = { ...originalEnv }; });
  afterAll(() => { process.env = originalEnv; });

  it('rejeita state ausente', async () => {
    process.env.META_APP_ID = 'test';
    process.env.META_APP_SECRET = 'test';
    const req = new NextRequest('http://localhost/api/auth/callback/meta?code=x');
    const res = await GET(req);
    expect(res.status).toBe(307);
  });

  it('rejeita state inválido (cookie diferente)', async () => {
    process.env.META_APP_ID = 'test';
    process.env.META_APP_SECRET = 'test';
    const req = new NextRequest('http://localhost/api/auth/callback/meta?code=x&state=bad', {
      headers: { cookie: 'oauth_state=good' },
    });
    const res = await GET(req);
    expect(res.status).toBe(307);
  });

  it('rejeita code ausente', async () => {
    process.env.META_APP_ID = 'test';
    process.env.META_APP_SECRET = 'test';
    const req = new NextRequest('http://localhost/api/auth/callback/meta?state=good');
    const res = await GET(req);
    expect(res.status).toBe(307);
  });

  it('rejeita error OAuth', async () => {
    const req = new NextRequest('http://localhost/api/auth/callback/meta?error=access_denied');
    const res = await GET(req);
    expect(res.status).toBe(307);
  });

  it('rejeita sem sessão', async () => {
    process.env.META_APP_ID = 'test';
    process.env.META_APP_SECRET = 'test';
    const req = new NextRequest('http://localhost/api/auth/callback/meta?code=x&state=good', {
      headers: { cookie: 'oauth_state=good' },
    });
    const res = await GET(req);
    expect(res.status).toBe(307);
  });
});
