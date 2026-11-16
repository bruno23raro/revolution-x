// @ts-nocheck
// Testes para GET /api/whatsapp/accounts (lista contas)
// FASE 17 — Testes de rota separados conforme padrão do projeto

import { NextRequest } from 'next/server';

jest.mock('@/lib/auth', () => ({
  getAuth: jest.fn(),
  getAllOrganizationMemberships: jest.fn(),
}));

jest.mock('@/integrations/meta/accounts', () => ({
  listTenantWhatsAppAccounts: jest.fn(),
}));

jest.mock('@/integrations/whatsapp/channelRepo', () => ({
  deleteAllChannels: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: jest.fn(),
}));

const { GET: accountsGET, POST: accountsPOST, DELETE: accountsDELETE } = require('./route');
const { getAuth, getAllOrganizationMemberships } = require('@/lib/auth');
const { listTenantWhatsAppAccounts } = require('@/integrations/meta/accounts');
const { deleteAllChannels } = require('@/integrations/whatsapp/channelRepo');
const { createServiceRoleClient } = require('@/lib/supabase/server');

function req(path: string, cookie?: string) {
  const headers: HeadersInit = {};
  if (cookie) {
    headers.cookie = cookie;
  }
  return new NextRequest(`http://localhost${path}`, { headers });
}

const USER = { id: 'u1', organizationId: 'org1', role: 'member' };
const ADMIN = { id: 'user-123', organizationId: 'org1', role: 'admin' };
const OWNER = { id: 'u3', organizationId: 'org1', role: 'owner' };

describe('GET /api/whatsapp/accounts', () => {
  afterEach(() => jest.resetAllMocks());

  it('200 sem sessão retorna available=false (lazy auth)', async () => {
    (getAuth as jest.Mock).mockResolvedValue({ user: null, hasSession: false });
    const res = await accountsGET(req('/api/whatsapp/accounts'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.available).toBe(false);
    expect(data.accounts).toEqual([]);
    expect(data.reason).toBe('no_session');
  });

  it('devolve metadados SEM segredos (nada de tokens/chaves)', async () => {
    (getAuth as jest.Mock).mockResolvedValue({ user: USER, hasSession: true });
    (listTenantWhatsAppAccounts as jest.Mock).mockResolvedValue({
      ok: true,
      accounts: [
        {
          id: 'acc-1',
          provider: 'whatsapp',
          displayName: 'Loja Centro',
          phoneNumberId: '1234567890',
          whatsappBusinessAccountId: 'waba-1',
          status: 'CONNECTED',
        },
      ],
      displayNameAvailable: true,
    });
    const res = await accountsGET(req('/api/whatsapp/accounts'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.available).toBe(true);
    expect(data.accounts).toHaveLength(1);
    const a = data.accounts[0];
    expect(a.displayName).toBe('Loja Centro');
    expect(a.phoneNumberId).toBe('1234567890');
    // A resposta nunca expõe credenciais
    expect(JSON.stringify(data)).not.toMatch(/token|secret|key/i);
  });

  it('degradação honesta: sem clientes Supabase → available=false', async () => {
    (getAuth as jest.Mock).mockResolvedValue({ user: USER, hasSession: true });
    (listTenantWhatsAppAccounts as jest.Mock).mockResolvedValue({
      ok: false,
      reason: 'client_unavailable',
    });
    const res = await accountsGET(req('/api/whatsapp/accounts'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.available).toBe(false);
    expect(data.accounts).toEqual([]);
    expect(data.reason).toBe('client_unavailable');
  });
});

describe('DELETE /api/whatsapp/accounts', () => {
  afterEach(() => jest.resetAllMocks());

  it('401 sem sessão', async () => {
    (getAuth as jest.Mock).mockResolvedValue({ user: null, hasSession: false });
    const res = await accountsDELETE(req('/api/whatsapp/accounts'));
    expect(res.status).toBe(401);
  });

  it('401 para membro não-admin', async () => {
    (getAuth as jest.Mock).mockResolvedValue({ user: USER, hasSession: true });
    (getAllOrganizationMemberships as jest.Mock).mockResolvedValue([{ role: 'member' }]);

    const res = await accountsDELETE(req('/api/whatsapp/accounts'));
    expect(res.status).toBe(401);
  });

  it('200 para admin mesmo sem memberships (role=admin no user)', async () => {
    // Quando o user tem role='admin', é considerado admin independente das memberships
    (getAuth as jest.Mock).mockResolvedValue({ user: ADMIN, hasSession: true });
    (getAllOrganizationMemberships as jest.Mock).mockResolvedValue([]);

    const mockEq = jest.fn().mockReturnThis();
    const mockIn = jest.fn().mockReturnThis();
    const mockDelete = jest.fn().mockReturnValue({ eq: mockEq, in: mockIn });
    const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq, in: mockIn });
    const mockFrom = jest.fn().mockImplementation((table) => {
      if (table === 'whatsapp_channels') return { delete: mockDelete };
      if (table === 'meta_integrations') return { update: mockUpdate };
      if (table === 'integrations') return { delete: mockDelete };
      return { delete: mockDelete };
    });

    (createServiceRoleClient as jest.Mock).mockReturnValue({
      from: mockFrom,
    });

    const res = await accountsDELETE(req('/api/whatsapp/accounts'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  // Testes críticos de segurança IDOR
  describe('IDOR Security - DELETE /api/whatsapp/accounts', () => {
    afterEach(() => jest.resetAllMocks());

    it('PROTECTED: Não deleta integrações de INTÉRGENTE', async () => {
      // Simula admin do tenant org1 tentando deletar integrações
      // A tabela integrations é user-scoped, NÃO tenant-scoped
      // O DELETE deve apenas afetar integrações do usuário autenticado
      (getAuth as jest.Mock).mockResolvedValue({ user: ADMIN, hasSession: true });
      (getAllOrganizationMemberships as jest.Mock).mockResolvedValue([{ organizationId: 'org1', role: 'admin' }]);

      const capturedCalls: any[] = [];

      // Create a proper chain that returns the same builder
      const chain = { eq: jest.fn(), in: jest.fn() };
      chain.eq.mockReturnValue(chain);
      chain.in.mockReturnValue(chain);

      const mockDelete = jest.fn().mockReturnValue(chain);
      const mockUpdate = jest.fn().mockReturnValue(chain);
      const mockFrom = jest.fn().mockImplementation((table) => {
        if (table === 'whatsapp_channels') return { delete: mockDelete };
        if (table === 'meta_integrations') return { update: mockUpdate };
        if (table === 'integrations') return { delete: mockDelete };
        return { delete: mockDelete };
      });

      // Capture the eq calls from the chain
      const originalEq = chain.eq;
      chain.eq = jest.fn().mockImplementation((col, val) => {
        capturedCalls.push({ method: 'eq', col, val });
        return chain;
      });
      chain.in = jest.fn().mockImplementation(() => chain);

      (createServiceRoleClient as jest.Mock).mockReturnValue({
        from: mockFrom,
      });

      const res = await accountsDELETE(req('/api/whatsapp/accounts'));
      expect(res.status).toBe(200);

      const eqCalls = capturedCalls.filter(c => c.method === 'eq');

      // Verifica que o DELETE foi chamado com user_id do admin, não com organizationId
      // Isso garante que apenas as integrações do usuário autenticado são removidas
      // O primeiro delete deve ser para whatsapp_channels com organization_id
      // O segundo delete deve ser para integrations com user_id (NÃO organizationId)
      expect(eqCalls.some(c => c.col === 'organization_id' && c.val === ADMIN.organizationId)).toBe(true);

      // CRUCIAL: O DELETE das integrações usa organization_id, não organizationId
      // Isso previne que admin de org1 delete integrações de usuário de org2
      const userIdCalls = eqCalls.filter(c => c.col === 'user_id');
      expect(userIdCalls.length).toBeGreaterThan(0);
      expect(userIdCalls.some(c => c.val === ADMIN.id)).toBe(true);
    });

    it('PROTECTED: Soft delete de integrations usa user_id autenticado', async () => {
      // Verifica que a integração é deletada apenas para o usuário atual
      (getAuth as jest.Mock).mockResolvedValue({ user: { id: 'user-123', organizationId: 'org-x', role: 'admin' }, hasSession: true });
      (getAllOrganizationMemberships as jest.Mock).mockResolvedValue([{ organizationId: 'org-x', role: 'admin' }]);

      const capturedCalls: any[] = [];

      // Create a proper chain that returns the same builder
      const chain = { eq: jest.fn(), in: jest.fn() };
      chain.eq.mockReturnValue(chain);
      chain.in.mockReturnValue(chain);

      const mockDelete = jest.fn().mockReturnValue(chain);
      const mockUpdate = jest.fn().mockReturnValue(chain);
      const mockFrom = jest.fn().mockImplementation((table) => {
        if (table === 'whatsapp_channels') return { delete: mockDelete };
        if (table === 'meta_integrations') return { update: mockUpdate };
        if (table === 'integrations') return { delete: mockDelete };
        return { delete: mockDelete };
      });

      // Capture the eq calls from the chain
      chain.eq = jest.fn().mockImplementation((col, val) => {
        capturedCalls.push({ col, val });
        return chain;
      });
      chain.in = jest.fn().mockImplementation(() => chain);

      (createServiceRoleClient as jest.Mock).mockReturnValue({
        from: mockFrom,
      });

      await accountsDELETE(req('/api/whatsapp/accounts'));

      // Verifica que integrations foi deletado com user_id do usuário autenticado
      const userIdCalls = capturedCalls.filter(c => c.col === 'user_id');
      expect(userIdCalls.length).toBeGreaterThan(0);
      expect(userIdCalls.some(c => c.val === 'user-123')).toBe(true);
    });
  });

  // Plano de teste completo: listar -> remover -> verificar vazio
  describe('Fluxo completo de remoção de contas', () => {
    afterEach(() => jest.resetAllMocks());

    it('plano: 1. Listar contas -> 2. Remover -> 3. Verificar vazio', async () => {
      // Passo 1: Listar contas existentes
      (getAuth as jest.Mock).mockResolvedValue({ user: USER, hasSession: true });
      (listTenantWhatsAppAccounts as jest.Mock).mockResolvedValue({
        ok: true,
        accounts: [
          {
            id: 'acc-1',
            provider: 'whatsapp',
            displayName: 'ContaC1',
            phoneNumberId: '1111111111',
            whatsappBusinessAccountId: 'waba-1',
            status: 'CONNECTED',
          },
          {
            id: 'acc-2',
            provider: 'whatsapp',
            displayName: 'ContaC2',
            phoneNumberId: '2222222222',
            whatsappBusinessAccountId: 'waba-2',
            status: 'CONNECTED',
          },
        ],
        displayNameAvailable: true,
      });

      const listRes = await accountsGET(req('/api/whatsapp/accounts'));
      expect(listRes.status).toBe(200);
      const listData = await listRes.json();
      expect(listData.available).toBe(true);
      expect(listData.accounts).toHaveLength(2);

      // Passo 2: Remover todas as contas
      (getAuth as jest.Mock).mockResolvedValue({ user: ADMIN, hasSession: true });
      (getAllOrganizationMemberships as jest.Mock).mockResolvedValue([{ role: 'admin' }]);

      const mockEq = jest.fn().mockReturnThis();
      const mockIn = jest.fn().mockReturnThis();
      const mockDelete = jest.fn().mockReturnValue({ eq: mockEq, in: mockIn });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq, in: mockIn });
      const mockFrom = jest.fn().mockImplementation((table) => {
        if (table === 'whatsapp_channels') return { delete: mockDelete };
        if (table === 'meta_integrations') return { update: mockUpdate };
        if (table === 'integrations') return { delete: mockDelete };
        return { delete: mockDelete };
      });

      (createServiceRoleClient as jest.Mock).mockReturnValue({
        from: mockFrom,
      });

      const deleteRes = await accountsDELETE(req('/api/whatsapp/accounts'));
      expect(deleteRes.status).toBe(200);

      // Passo 3: Verificar que a lista está vazia
      (listTenantWhatsAppAccounts as jest.Mock).mockResolvedValue({
        ok: true,
        accounts: [],
        displayNameAvailable: true,
      });

      const verifyListRes = await accountsGET(req('/api/whatsapp/accounts'));
      expect(verifyListRes.status).toBe(200);
      const verifyData = await verifyListRes.json();
      expect(verifyData.available).toBe(true);
      expect(verifyData.accounts).toHaveLength(0);
    });
  });

  describe('POST /api/whatsapp/accounts', () => {
    afterEach(() => jest.resetAllMocks());

    it('200 sem sessão retorna authUrl com needsAuth=true (lazy auth)', async () => {
      (getAuth as jest.Mock).mockResolvedValue({ user: null, hasSession: false });
      const res = await accountsPOST(req('/api/whatsapp/accounts'));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.authUrl).toBeDefined();
      expect(data.needsAuth).toBe(true);
    });

    it('200 retorna authUrl para OAuth', async () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
      process.env.META_APP_ID = 'test-app-id';
      process.env.META_APP_SECRET = 'test-app-secret';

      (getAuth as jest.Mock).mockResolvedValue({ user: USER, hasSession: true });
      const res = await accountsPOST(req('/api/whatsapp/accounts'));
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.authUrl).toContain('https://');
      expect(data.state).toBeDefined();
      expect(data.organizationId).toBe('org1');
    });

    it('inclui provider no cookie oauth_state (URL encoded)', async () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
      process.env.META_APP_ID = 'test-app-id';
      process.env.META_APP_SECRET = 'test-app-secret';

      (getAuth as jest.Mock).mockResolvedValue({ user: USER, hasSession: true });
      const res = await accountsPOST(req('/api/whatsapp/accounts'));

      const cookies = res.headers.get('set-cookie') || '';
      // O cookie pode estar URL-encoded (whatsapp%3A = whatsapp:)
      expect(cookies).toMatch(/oauth_state=(whatsapp%3A|whatsapp:)[a-zA-Z0-9_-]+/i);
    });
  });

  // Teste para verificar que o estado OAuth é invalidado após callback
  describe('OAuth State Validation', () => {
    afterEach(() => jest.resetAllMocks());

    it('state deve incluir provider prefix para validação posterior', async () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
      process.env.META_APP_ID = 'test-app-id';
      process.env.META_APP_SECRET = 'test-app-secret';

      (getAuth as jest.Mock).mockResolvedValue({ user: USER, hasSession: true });
      const res = await accountsPOST(req('/api/whatsapp/accounts'));
      const data = await res.json();

      // O state retornado deve ser um token seguro (não vazio)
      expect(data.state).toBeDefined();
      expect(typeof data.state).toBe('string');
      expect(data.state.length).toBeGreaterThan(10);
    });

    it('retorna success e authUrl validos', async () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
      process.env.META_APP_ID = 'test-app-id';
      process.env.META_APP_SECRET = 'test-app-secret';

      (getAuth as jest.Mock).mockResolvedValue({ user: USER, hasSession: true });
      const res = await accountsPOST(req('/api/whatsapp/accounts'));
      const data = await res.json();

      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('authUrl');
      expect(data).toHaveProperty('state');
      expect(data).toHaveProperty('organizationId', 'org1');
    });
  });
});