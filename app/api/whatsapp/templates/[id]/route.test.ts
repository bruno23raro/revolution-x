// Testes para GET/DELETE individual de template

import { GET, DELETE } from './route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/auth', () => ({
  getAuthenticatedUser: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    whatsappTemplate: {
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock('@/integrations/meta/resolveAccess', () => ({
  resolveTenantMetaAccess: jest.fn(),
}));

jest.mock('@/integrations/meta/whatsappTemplates', () => ({
  getWhatsAppTemplate: jest.fn(),
}));

jest.mock('@/middleware/rate-limit', () => ({
  rateLimit: jest.fn(),
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

describe('GET /api/whatsapp/templates/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { rateLimit } = require('@/middleware/rate-limit');
    rateLimit.mockResolvedValue({ limited: false, remaining: 60, resetIn: 0 });
  });

  it('401 sem sessão', async () => {
    const { getAuthenticatedUser } = require('@/lib/auth');
    getAuthenticatedUser.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/whatsapp/templates/t-123');
    const res = await GET(req, { params: { id: 't-123' } });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('404 para template não encontrado', async () => {
    const { getAuthenticatedUser } = require('@/lib/auth');
    const { prisma } = require('@/lib/prisma');

    getAuthenticatedUser.mockResolvedValue(mockUser);
    prisma.whatsappTemplate.findFirst.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/whatsapp/templates/nonexistent');
    const res = await GET(req, { params: { id: 'nonexistent' } });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('Template não encontrado');
  });

  it('retorna template com sucesso', async () => {
    const { getAuthenticatedUser } = require('@/lib/auth');
    const { prisma } = require('@/lib/prisma');

    const mockTemplate = {
      id: 't-123',
      name: 'welcome_template',
      language: 'pt_BR',
      category: 'UTILITY',
      status: 'APPROVED',
      componentsJson: [
        { type: 'BODY', text: 'Olá {{1}}, bem-vindo!' },
      ],
      rejectionReason: null,
      metaTemplateId: 'meta-456',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
      lastCheckedAt: new Date('2024-01-02'),
    };

    getAuthenticatedUser.mockResolvedValue(mockUser);
    prisma.whatsappTemplate.findFirst.mockResolvedValue(mockTemplate);

    const req = new NextRequest('http://localhost/api/whatsapp/templates/t-123');
    const res = await GET(req, { params: { id: 't-123' } });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.template.id).toBe('t-123');
    expect(data.template.name).toBe('welcome_template');
    expect(data.template.status).toBe('APPROVED');
  });

  it('atualiza status da Meta para templates pendentes', async () => {
    const { getAuthenticatedUser } = require('@/lib/auth');
    const { prisma } = require('@/lib/prisma');
    const { resolveTenantMetaAccess } = require('@/integrations/meta/resolveAccess');
    const { getWhatsAppTemplate } = require('@/integrations/meta/whatsappTemplates');

    const mockLocalTemplate = {
      id: 't-123',
      name: 'welcome_template',
      language: 'pt_BR',
      category: 'UTILITY',
      status: 'PENDING',
      componentsJson: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    getAuthenticatedUser.mockResolvedValue(mockUser);
    prisma.whatsappTemplate.findFirst.mockResolvedValue(mockLocalTemplate);
    resolveTenantMetaAccess.mockResolvedValue({
      ok: true,
      access: { accessToken: 'token', phoneNumberId: 'PN-123', wabaId: 'WABA-456' },
    });
    getWhatsAppTemplate.mockResolvedValue({
      ok: true,
      template: {
        id: 'meta-456',
        status: 'APPROVED',
        components: [{ type: 'BODY', text: 'Olá {{1}}' }],
      },
    });

    const req = new NextRequest('http://localhost/api/whatsapp/templates/t-123');
    const res = await GET(req, { params: { id: 't-123' } });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.template.status).toBe('APPROVED');
  });

  it('status REJECTED mostra rejectionReason', async () => {
    const { getAuthenticatedUser } = require('@/lib/auth');
    const { prisma } = require('@/lib/prisma');

    const rejectedTemplate = {
      id: 't-rejected',
      name: 'bad_template',
      status: 'REJECTED',
      rejectionReason: 'Conteúdo pendente de revisão',
      language: 'pt_BR',
      category: 'MARKETING',
      componentsJson: [],
      metaTemplateId: 'meta-123',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    getAuthenticatedUser.mockResolvedValue(mockUser);
    prisma.whatsappTemplate.findFirst.mockResolvedValue(rejectedTemplate);

    const req = new NextRequest('http://localhost/api/whatsapp/templates/t-rejected');
    const res = await GET(req, { params: { id: 't-rejected' } });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.template.status).toBe('REJECTED');
    expect(data.template.rejectionReason).toBe('Conteúdo pendente de revisão');
  });
});

describe('DELETE /api/whatsapp/templates/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { rateLimit } = require('@/middleware/rate-limit');
    rateLimit.mockResolvedValue({ limited: false, remaining: 60, resetIn: 0 });
  });

  it('401 sem sessão', async () => {
    const { getAuthenticatedUser } = require('@/lib/auth');
    getAuthenticatedUser.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/whatsapp/templates/t-123');
    const res = await DELETE(req, { params: { id: 't-123' } });

    expect(res.status).toBe(401);
  });

  it('404 para template não encontrado', async () => {
    const { getAuthenticatedUser } = require('@/lib/auth');
    const { prisma } = require('@/lib/prisma');

    getAuthenticatedUser.mockResolvedValue(mockAdmin);
    prisma.whatsappTemplate.findFirst.mockResolvedValue(null);
    prisma.whatsappTemplate.delete.mockResolvedValue({});

    const req = new NextRequest('http://localhost/api/whatsapp/templates/nonexistent');
    const res = await DELETE(req, { params: { id: 'nonexistent' } });

    expect(res.status).toBe(404);
  });

  it('exclui template com sucesso (admin)', async () => {
    const { getAuthenticatedUser } = require('@/lib/auth');
    const { prisma } = require('@/lib/prisma');

    getAuthenticatedUser.mockResolvedValue(mockAdmin);
    prisma.whatsappTemplate.findFirst.mockResolvedValue({
      id: 't-123',
      name: 'test_template',
      organizationId: 'org-456',
    });
    prisma.whatsappTemplate.delete.mockResolvedValue({});

    const req = new NextRequest('http://localhost/api/whatsapp/templates/t-123');
    const res = await DELETE(req, { params: { id: 't-123' } });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.message).toBe('Template excluído com sucesso');
  });

  it('401 para membro não-admin', async () => {
    const { getAuthenticatedUser } = require('@/lib/auth');
    getAuthenticatedUser.mockResolvedValue(mockUser);

    const req = new NextRequest('http://localhost/api/whatsapp/templates/t-123');
    const res = await DELETE(req, { params: { id: 't-123' } });

    expect(res.status).toBe(401);
  });

  it('404 para template de outra organização (isolamento multi-tenant)', async () => {
    const { getAuthenticatedUser } = require('@/lib/auth');
    const { prisma } = require('@/lib/prisma');

    getAuthenticatedUser.mockResolvedValue(mockAdmin);
    prisma.whatsappTemplate.findFirst.mockResolvedValue(null);
    prisma.whatsappTemplate.delete.mockResolvedValue({});

    const req = new NextRequest('http://localhost/api/whatsapp/templates/t-other-org');
    const res = await DELETE(req, { params: { id: 't-other-org' } });

    expect(res.status).toBe(404);
    expect(prisma.whatsappTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 't-other-org',
          organizationId: 'org-456',
        }),
      }),
    );
  });

  it('rate limiting excedido retorna 429', async () => {
    const { getAuthenticatedUser } = require('@/lib/auth');
    const { rateLimit } = require('@/middleware/rate-limit');

    rateLimit.mockResolvedValue({ limited: true, remaining: 0, resetIn: 60000 });
    getAuthenticatedUser.mockResolvedValue(mockAdmin);

    const req = new NextRequest('http://localhost/api/whatsapp/templates/t-123');
    const res = await DELETE(req, { params: { id: 't-123' } });

    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toBe('Rate limit excedido');
    expect(data.rateLimit.remaining).toBe(0);
  });

  it('retorna header X-RateLimit-Remaining na resposta', async () => {
    const { getAuthenticatedUser } = require('@/lib/auth');
    const { prisma } = require('@/lib/prisma');

    getAuthenticatedUser.mockResolvedValue(mockAdmin);
    prisma.whatsappTemplate.findFirst.mockResolvedValue({
      id: 't-123',
      name: 'test',
      status: 'APPROVED',
      organizationId: 'org-456'
    });
    prisma.whatsappTemplate.delete.mockResolvedValue({});

    const req = new NextRequest('http://localhost/api/whatsapp/templates/t-123');
    const res = await DELETE(req, { params: { id: 't-123' } });

    expect(res.headers.get('X-RateLimit-Remaining')).toBe('60');
  });

  });