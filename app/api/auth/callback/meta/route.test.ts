import { GET } from './route';
import { NextRequest } from 'next/server';

// Mock crypto.randomUUID
const mockUUID = 'test-uuid-1234';
jest.mock('crypto', () => ({ randomUUID: () => mockUUID }));

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      upsert: jest.fn(() => Promise.resolve({ error: null })),
    })),
  })),
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
    } as RequestInit);
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
    } as RequestInit);
    const res = await GET(req);
    expect(res.status).toBe(307);
  });
});
