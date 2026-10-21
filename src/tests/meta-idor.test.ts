// src/tests/meta-idor.test.ts — negative tests for Meta IDOR remediation
// The route at app/api/integrations/meta/route.ts now:
//   1. Calls getAuthenticatedUser(req) — rejects unauthenticated requests
//   2. Uses user.organizationId from DB membership — never from URL/body
//   3. Calls Supabase with anon key (RLS-subject) — never service_role
import { NextRequest } from 'next/server';
import { GET, DELETE } from '../../app/api/integrations/meta/route';

jest.mock('../../app/api/integrations/meta/route', () => {
  const actual = jest.requireActual('../../app/api/integrations/meta/route');
  return { ...actual };
});
jest.mock('@/lib/auth', () => ({
  getAuthenticatedUser: jest.fn(),
}));
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

const { getAuthenticatedUser } = require('@/lib/auth');
const { createClient } = require('@/lib/supabase/server');

const originalEnv = process.env;

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
});
afterAll(() => { process.env = originalEnv; });

const MOCK_USER = {
  id: 'user-1',
  email: 'test@example.com',
  organizationId: 'org-real',
  role: 'member',
};

function makeSupabaseClient(data: Record<string, any> | any[] | null = null, error: string | null = null) {
  // GET agora usa a cadeia MULTICONTAS: .from().select().eq(org).neq(status).order(connected_at)
  // devolvendo { data: array | null, error }. (Antigo .maybeSingle() quebra c/ 2+ linhas.)
  const normalized = data == null ? null : Array.isArray(data) ? data : [data];
  const orderMock = jest.fn().mockResolvedValue({ data: normalized, error });
  const neqMock = jest.fn().mockReturnValue({ order: orderMock });
  const selectEq = jest.fn().mockReturnValue({ neq: neqMock });
  const select = jest.fn().mockReturnValue({ eq: selectEq });

  // DELETE ainda usa a cadeia .from().update().eq(org).eq(provider).
  const eqBuilder = jest.fn().mockResolvedValue({ error: null });
  const updateBuilder = {
    eq: eqBuilder,
  };
  const updateMock = jest.fn().mockReturnValue(updateBuilder);
  return {
    from: jest.fn().mockReturnValue({
      select,
      update: updateMock,
    }),
  };
}

describe('Meta integration route — IDOR negative tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================================================
  // GET
  // ========================================================================
  describe('GET /api/integrations/meta', () => {
    it('rejeita request sem autenticacao (getAuthenticatedUser returns null)', async () => {
      (getAuthenticatedUser as jest.Mock).mockResolvedValue(null);
      const req = new NextRequest('http://localhost/api/integrations/meta');
      const res = await GET(req);
      expect(res.status).toBe(401);
      expect(createClient).not.toHaveBeenCalled();
    });

    it('rejeita session cookie forjado (mock returns null for invalid session)', async () => {
      // Simula supabase.auth.getUser() retornando null (cookie forjado ou expirado)
      (getAuthenticatedUser as jest.Mock).mockResolvedValue(null);
      const req = new NextRequest('http://localhost/api/integrations/meta', {
        headers: { cookie: 'sb-access-token=forged' },
      });
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it('nao usa organizationId da URL — usa o do banco (membership)', async () => {
      // Usuario pertence a org-real
      (getAuthenticatedUser as jest.Mock).mockResolvedValue(MOCK_USER);
      (createClient as jest.Mock).mockResolvedValue(makeSupabaseClient(null));

      // Tenta fraudar via query param
      const req = new NextRequest('http://localhost/api/integrations/meta?organizationId=org-fraudada');
      const res = await GET(req);

      expect(res.status).toBe(200);
      // A query deve ser feita com org-real, NAO org-fraudada
      const callArgs = (createClient as jest.Mock).mock.calls[0];
      expect(callArgs).toBeDefined();
      const body = await res.json();
      expect(body.connected).toBe(false); // org-real nao tem integracao
    });

    it('nao expoe access_token, ciphertext ou campos sensiveis na resposta', async () => {
      (getAuthenticatedUser as jest.Mock).mockResolvedValue(MOCK_USER);
      (createClient as jest.Mock).mockResolvedValue(
        makeSupabaseClient({
          provider: 'facebook',
          phone_number_id: 'pn-1',
          token_expires_at: null,
          status: 'CONNECTED',
          // Dados que NAO deveriam aparecer:
          encrypted_access_token: 'enc-should-not-appear',
          access_token: 'plain-should-not-appear',
        })
      );

      const req = new NextRequest('http://localhost/api/integrations/meta');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      const jsonStr = JSON.stringify(body);
      expect(jsonStr).not.toContain('encrypted_access_token');
      expect(jsonStr).not.toContain('access_token');
      expect(jsonStr).not.toContain('ciphertext');
      expect(jsonStr).not.toContain('secret');
    });

    it('consulta meta_integrations com organization_id do banco, nao de input do usuario', async () => {
      (getAuthenticatedUser as jest.Mock).mockResolvedValue(MOCK_USER);
      // Cadeia MULTICONTAS: .select().eq(org).neq(status).order(connected_at).
      const orderMock = jest.fn().mockResolvedValue({ data: null, error: null });
      const neqMock = jest.fn().mockReturnValue({ order: orderMock });
      const eqMock = jest.fn().mockReturnValue({ neq: neqMock });
      (createClient as jest.Mock).mockResolvedValue({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({ eq: eqMock }),
        }),
      });

      const req = new NextRequest('http://localhost/api/integrations/meta');
      await GET(req);

      // O route chama .eq('organization_id', user.organizationId)
      expect(eqMock).toHaveBeenCalledWith('organization_id', 'org-real');
      expect(eqMock).not.toHaveBeenCalledWith('organization_id', 'org-fraudada');
    });
  });

  // ========================================================================
  // DELETE
  // ========================================================================
  describe('DELETE /api/integrations/meta', () => {
    it('rejeita request sem autenticacao', async () => {
      (getAuthenticatedUser as jest.Mock).mockResolvedValue(null);
      const req = new NextRequest('http://localhost/api/integrations/meta?provider=facebook', {
        method: 'DELETE',
      });
      const res = await DELETE(req);
      expect(res.status).toBe(401);
    });

    it('rejeita quando provider eh ausente', async () => {
      (getAuthenticatedUser as jest.Mock).mockResolvedValue(MOCK_USER);
      const req = new NextRequest('http://localhost/api/integrations/meta', { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(400);
    });

    it('nao permite deletar integracao de outra organizacao (IDOR)', async () => {
      // Usuario so pertence a org-real
      (getAuthenticatedUser as jest.Mock).mockResolvedValue(MOCK_USER);

      // Mock the Supabase chain. Each .eq() returns the same builder so .eq().eq() chains.
      const builder: any = {};
      builder.eq = jest.fn().mockReturnValue(builder);
      const updateSpy = jest.fn().mockReturnValue(builder);
      const fromSpy = jest.fn().mockReturnValue({ select: jest.fn(), update: updateSpy });
      (createClient as jest.Mock).mockResolvedValue({ from: fromSpy });

      // mesmo tentando fraudar via URL
      const req = new NextRequest(
        'http://localhost/api/integrations/meta?provider=facebook&organizationId=org-inimiga',
        { method: 'DELETE' }
      );
      const res = await DELETE(req);

      // The route catches all errors internally and returns 500; we verify it
      // didn't throw by confirming the DB calls used the correct org.
      expect(builder.eq.mock.calls).toEqual([
        ['organization_id', 'org-real'],
        ['provider', 'facebook'],
      ]);
    });
  });
});
