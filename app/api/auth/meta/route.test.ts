import { GET } from './route';
import { NextRequest } from 'next/server';
import { buildMetaAuthUrl, generateState } from '@/integrations/meta/auth/oauth';

// Mocks da fronteira:
//  - @/lib/auth → getAuthenticatedUser (sessão Supabase).
//  - @/integrations/meta/auth/oauth → determinístico (state + URL).
jest.mock('@/lib/auth', () => ({
  getAuthenticatedUser: jest.fn(),
}));
jest.mock('@/integrations/meta/auth/oauth', () => ({
  generateState: jest.fn(() => 'state-123'),
  buildMetaAuthUrl: jest.fn((config: { appId: string; redirectUri: string }, state: string, provider: string) =>
    `https://www.facebook.com/dialog/oauth?client_id=${config.appId}&state=${state}&provider=${provider}&redirect_uri=${encodeURIComponent(
      config.redirectUri,
    )}`,
  ),
}));

const originalEnv = process.env;

describe('OAuth start meta (GET /api/auth/meta)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.META_APP_ID;
    delete process.env.META_APP_SECRET;
  });
  afterAll(() => {
    process.env = originalEnv;
  });

  it('rejeita sem sessão (401)', async () => {
    (jest.requireMock('@/lib/auth').getAuthenticatedUser as jest.Mock).mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/auth/meta');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('degrada com 503 meta_not_configured quando META_* ausentes', async () => {
    (jest.requireMock('@/lib/auth').getAuthenticatedUser as jest.Mock).mockResolvedValue({ id: 'u1' });
    const req = new NextRequest('http://localhost/api/auth/meta?provider=whatsapp');
    const res = await GET(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe('meta_not_configured');
    // Degradação honesta: NÃO constrói URL de OAuth sem credenciais.
    expect(buildMetaAuthUrl).not.toHaveBeenCalled();
  });

  it('redireciona (3xx) com cookie oauth_state quando tudo ok', async () => {
    (jest.requireMock('@/lib/auth').getAuthenticatedUser as jest.Mock).mockResolvedValue({ id: 'u1' });
    process.env.META_APP_ID = 'app-id';
    process.env.META_APP_SECRET = 'secret';
    const req = new NextRequest('http://localhost/api/auth/meta');
    const res = await GET(req);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get('location')).toContain('client_id=app-id');
    expect(res.headers.get('location')).toContain('state=state-123');
    expect(res.cookies.get('oauth_state')?.value).toBe('state-123');
    // provider padrão = facebook quando ausente.
    expect(res.headers.get('location')).toContain('provider=facebook');
  });

  it('honra ?provider=whatsapp', async () => {
    (jest.requireMock('@/lib/auth').getAuthenticatedUser as jest.Mock).mockResolvedValue({ id: 'u1' });
    process.env.META_APP_ID = 'app-id';
    process.env.META_APP_SECRET = 'secret';
    const req = new NextRequest('http://localhost/api/auth/meta?provider=whatsapp');
    const res = await GET(req);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.headers.get('location')).toContain('provider=whatsapp');
  });

  it('normaliza provider inválido para facebook', async () => {
    (jest.requireMock('@/lib/auth').getAuthenticatedUser as jest.Mock).mockResolvedValue({ id: 'u1' });
    process.env.META_APP_ID = 'app-id';
    process.env.META_APP_SECRET = 'secret';
    const req = new NextRequest('http://localhost/api/auth/meta?provider=bogus');
    const res = await GET(req);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.headers.get('location')).toContain('provider=facebook');
  });
});
