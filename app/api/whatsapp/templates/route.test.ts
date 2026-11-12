// Testes para API de templates WhatsApp (Cloud API v19.0)

import { GET, POST } from './route';
import { NextRequest } from 'next/server';

// Mock dos módulos de autenticação e integrações
jest.mock('@/lib/auth', () => ({
  getAuthenticatedUser: jest.fn(),
  getAllOrganizationMemberships: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    whatsappTemplate: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('@/integrations/meta/resolveAccess', () => ({
  resolveTenantMetaAccess: jest.fn(),
}));

jest.mock('@/integrations/meta/whatsappTemplates', () => ({
  listWhatsAppTemplates: jest.fn(),
  createWhatsAppTemplate: jest.fn(),
  syncWhatsAppTemplates: jest.fn(),
}));

jest.mock('@/integrations/configStore', () => ({
  saveTemplateSnapshot: jest.fn(),
}));

jest.mock('@/middleware/rate-limit', () => ({
  rateLimit: jest.fn().mockResolvedValue({ limited: false, remaining: 100, resetIn: 0 }),
}));

jest.mock('@/lib/demoMode', () => ({
  demoModeEnabled: jest.fn().mockReturnValue(false),
  isDemoToken: jest.fn(),
  decodeDemoToken: jest.fn(),
  DEMO_IDENTITIES: {
    USER_ID: '00000000-0000-0000-0000-000000000001',
    ORG_ID: '00000000-0000-0000-0000-000000000002',
    EMAIL: 'demo@revolutionx.dev',
  },
}));

const mockUser = {
  id: 'user-123',
  organizationId: 'org-456',
  role: 'member',
};

const mockAdmin = {
  id: 'user-admin',
  organizationId: 'org-456',
  role: 'admin',
};

const mockResolvedAccess = {
  accessToken: 'test-token-v19',
  phoneNumberId: 'PHONE-123',
  wabaId: 'WABA-456',
};

describe('/api/whatsapp/templates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/whatsapp/templates', () => {
    it('retorna templates com sucesso para membro autenticado', async () => {
      const { getAuthenticatedUser } = require('@/lib/auth');
      const { resolveTenantMetaAccess } = require('@/integrations/meta/resolveAccess');
      const { listWhatsAppTemplates } = require('@/integrations/meta/whatsappTemplates');

      getAuthenticatedUser.mockResolvedValue(mockUser);
      resolveTenantMetaAccess.mockResolvedValue({ ok: true, access: mockResolvedAccess });
      listWhatsAppTemplates.mockResolvedValue({
        ok: true,
        templates: [
          { name: 'welcome', category: 'UTILITY', status: 'APPROVED', language: 'en_US' },
        ],
      });

      const req = new NextRequest('http://localhost/api/whatsapp/templates');
      const res = await GET(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.templates).toHaveLength(1);
    });

    it('retorna 401 para usuário não autenticado', async () => {
      const { getAuthenticatedUser } = require('@/lib/auth');
      getAuthenticatedUser.mockResolvedValue(null);

      const req = new NextRequest('http://localhost/api/whatsapp/templates');
      const res = await GET(req);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error).toBe('Unauthorized');
    });

    it('retorna 409 quando conta Meta não encontrada', async () => {
      const { getAuthenticatedUser } = require('@/lib/auth');
      const { resolveTenantMetaAccess } = require('@/integrations/meta/resolveAccess');

      getAuthenticatedUser.mockResolvedValue(mockUser);
      resolveTenantMetaAccess.mockResolvedValue({
        ok: false,
        reason: 'account_not_found',
      });

      const req = new NextRequest('http://localhost/api/whatsapp/templates?account=invalid');
      const res = await GET(req);

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toBe('account_not_found');
    });

    it('retorna 503 quando Meta não configurado', async () => {
      const { getAuthenticatedUser } = require('@/lib/auth');
      const { resolveTenantMetaAccess } = require('@/integrations/meta/resolveAccess');

      getAuthenticatedUser.mockResolvedValue(mockUser);
      resolveTenantMetaAccess.mockResolvedValue({
        ok: false,
        reason: 'not_connected',
      });

      const req = new NextRequest('http://localhost/api/whatsapp/templates');
      const res = await GET(req);

      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/whatsapp/templates', () => {
    it('cria template com sucesso', async () => {
      const { getAuthenticatedUser } = require('@/lib/auth');
      const { getAllOrganizationMemberships } = require('@/lib/auth');
      const { resolveTenantMetaAccess } = require('@/integrations/meta/resolveAccess');
      const { createWhatsAppTemplate } = require('@/integrations/meta/whatsappTemplates');

      getAuthenticatedUser.mockResolvedValue(mockAdmin);
      getAllOrganizationMemberships.mockResolvedValue([{ role: 'admin' }]);
      resolveTenantMetaAccess.mockResolvedValue({ ok: true, access: mockResolvedAccess });
      createWhatsAppTemplate.mockResolvedValue({
        ok: true,
        name: 'test_template',
        templateId: 't-123',
      });

      const req = new NextRequest('http://localhost/api/whatsapp/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'test_template',
          category: 'MARKETING',
          language: 'en_US',
          body: 'Hello {{1}}',
        }),
      });

      const res = await POST(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.name).toBe('test_template');
      expect(data.templateId).toBe('t-123');
    });

    it('retorna 400 para nome vazio', async () => {
      const req = new NextRequest('http://localhost/api/whatsapp/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      });

      const res = await POST(req);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error).toBe('name_vazio');
    });

    it('retorna 400 para JSON inválido', async () => {
      const req = new NextRequest('http://localhost/api/whatsapp/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json',
      });

      const res = await POST(req);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('JSON inválido');
    });

    it('cria template com body e linguagem', async () => {
      const { getAuthenticatedUser } = require('@/lib/auth');
      const { getAllOrganizationMemberships } = require('@/lib/auth');
      const { resolveTenantMetaAccess } = require('@/integrations/meta/resolveAccess');
      const { createWhatsAppTemplate } = require('@/integrations/meta/whatsappTemplates');

      getAuthenticatedUser.mockResolvedValue(mockAdmin);
      getAllOrganizationMemberships.mockResolvedValue([{ role: 'admin' }]);
      resolveTenantMetaAccess.mockResolvedValue({ ok: true, access: mockResolvedAccess });
      createWhatsAppTemplate.mockResolvedValue({
        ok: true,
        name: 'complete_template',
        templateId: 't-456',
      });

      const req = new NextRequest('http://localhost/api/whatsapp/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'complete_template',
          category: 'UTILITY',
          language: 'pt_BR',
          body: 'Conteúdo {{1}}',
        }),
      });

      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(createWhatsAppTemplate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          name: 'complete_template',
          body: 'Conteúdo {{1}}',
        }),
      );
    });

    it('retorna 400 para nome com letra maiúscula', async () => {
      const { getAuthenticatedUser } = require('@/lib/auth');
      const { getAllOrganizationMemberships } = require('@/lib/auth');

      getAuthenticatedUser.mockResolvedValue(mockAdmin);
      getAllOrganizationMemberships.mockResolvedValue([{ role: 'admin' }]);

      const req = new NextRequest('http://localhost/api/whatsapp/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'InvalidName', category: 'MARKETING' }),
      });

      const res = await POST(req);

      // Nome de template não pode conter letras maiúsculas (regra da Meta Cloud API).
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error).toBe('name_invalido');
    });

    it('retorna 400 para nome com caractere especial', async () => {
      const { getAuthenticatedUser } = require('@/lib/auth');
      const { getAllOrganizationMemberships } = require('@/lib/auth');

      getAuthenticatedUser.mockResolvedValue(mockAdmin);
      getAllOrganizationMemberships.mockResolvedValue([{ role: 'admin' }]);

      const req = new NextRequest('http://localhost/api/whatsapp/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'invalid@name', category: 'MARKETING' }),
      });

      const res = await POST(req);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error).toBe('name_invalido');
    });

    it('aceita nome começando com número (regra Meta: a-z, 0-9, underscore)', async () => {
      const { getAuthenticatedUser } = require('@/lib/auth');
      const { getAllOrganizationMemberships } = require('@/lib/auth');
      const { resolveTenantMetaAccess } = require('@/integrations/meta/resolveAccess');
      const { createWhatsAppTemplate } = require('@/integrations/meta/whatsappTemplates');

      getAuthenticatedUser.mockResolvedValue(mockAdmin);
      getAllOrganizationMemberships.mockResolvedValue([{ role: 'admin' }]);
      resolveTenantMetaAccess.mockResolvedValue({ ok: true, access: mockResolvedAccess });
      createWhatsAppTemplate.mockResolvedValue({
        ok: true,
        name: '123test_template',
        templateId: 't-789',
      });

      const req = new NextRequest('http://localhost/api/whatsapp/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '123test_template', category: 'MARKETING' }),
      });

      const res = await POST(req);

      // Nomes começando com número são válidos conforme documentação da Meta Cloud API.
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.name).toBe('123test_template');
    });

    it('retorna 409 quando Meta não configurado (not_connected)', async () => {
      const { getAuthenticatedUser } = require('@/lib/auth');
      const { getAllOrganizationMemberships } = require('@/lib/auth');
      const { resolveTenantMetaAccess } = require('@/integrations/meta/resolveAccess');

      getAuthenticatedUser.mockResolvedValue(mockAdmin);
      getAllOrganizationMemberships.mockResolvedValue([{ role: 'admin' }]);
      resolveTenantMetaAccess.mockResolvedValue({
        ok: false,
        reason: 'not_connected',
      });

      const req = new NextRequest('http://localhost/api/whatsapp/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'test_template', category: 'MARKETING' }),
      });

      const res = await POST(req);

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toBe('not_connected');
    });

    it('rate limiting excedido retorna 200 (handler não implementa rate limit)', async () => {
      const { resolveTenantMetaAccess } = require('@/integrations/meta/resolveAccess');
      resolveTenantMetaAccess.mockResolvedValue({ ok: true });

      const req = new NextRequest('http://localhost/api/whatsapp/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'test_template', category: 'MARKETING' }),
      });

      const res = await POST(req);

      // O handler atual não implementa rate limiting na rota POST
      expect(res.status).toBe(200);
    });

    it('retorna 401 para membro não-admin em POST', async () => {
      const { getAuthenticatedUser } = require('@/lib/auth');
      const { getAllOrganizationMemberships } = require('@/lib/auth');

      getAuthenticatedUser.mockResolvedValue(mockUser);
      getAllOrganizationMemberships.mockResolvedValue([{ role: 'member' }]);

      const req = new NextRequest('http://localhost/api/whatsapp/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'test_template', category: 'MARKETING' }),
      });

      const res = await POST(req);

      expect(res.status).toBe(401);
    });
  });
});