// Testes para sincronização individual de template

import { POST } from '../sync/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/auth', () => ({
  getAuthenticatedUser: jest.fn(),
}));

jest.mock('@/integrations/meta/resolveAccess', () => ({
  resolveTenantMetaAccess: jest.fn(),
}));

jest.mock('@/integrations/meta/whatsappTemplates', () => ({
  getWhatsAppTemplate: jest.fn(),
}));

jest.mock('@/middleware/rate-limit', () => ({
  rateLimit: jest.fn().mockResolvedValue({ limited: false, remaining: 10, resetIn: 0 }),
}));

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

describe('POST /api/whatsapp/templates/[id]/sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sincroniza template específico com sucesso', async () => {
    const { getAuthenticatedUser } = require('@/lib/auth');
    const { resolveTenantMetaAccess } = require('@/integrations/meta/resolveAccess');
    const { getWhatsAppTemplate } = require('@/integrations/meta/whatsappTemplates');

    getAuthenticatedUser.mockResolvedValue(mockAdmin);
    resolveTenantMetaAccess.mockResolvedValue({ ok: true, access: mockResolvedAccess });
    getWhatsAppTemplate.mockResolvedValue({
      ok: true,
      template: {
        id: 't-123',
        name: 'welcome',
        category: 'UTILITY',
        status: 'APPROVED',
        language: 'en_US',
        quality_score: 4.2,
      },
    });

    const req = new NextRequest('http://localhost/api/whatsapp/templates/t-123/sync');
    const res = await POST(req, { params: { id: 't-123' } });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.template.id).toBe('t-123');
    expect(data.template.name).toBe('welcome');
  });

  it('retorna 401 para não-admin', async () => {
    const { getAuthenticatedUser } = require('@/lib/auth');
    getAuthenticatedUser.mockResolvedValue({ id: 'user-member', organizationId: 'org-456', role: 'member' });

    const req = new NextRequest('http://localhost/api/whatsapp/templates/t-123/sync');
    const res = await POST(req, { params: { id: 't-123' } });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('retorna 404 para template não encontrado', async () => {
    const { getAuthenticatedUser } = require('@/lib/auth');
    const { resolveTenantMetaAccess } = require('@/integrations/meta/resolveAccess');
    const { getWhatsAppTemplate } = require('@/integrations/meta/whatsappTemplates');

    getAuthenticatedUser.mockResolvedValue(mockAdmin);
    resolveTenantMetaAccess.mockResolvedValue({ ok: true, access: mockResolvedAccess });
    getWhatsAppTemplate.mockResolvedValue({
      ok: false,
      error: 'http_error',
      errorDetail: 'HTTP 404',
    });

    const req = new NextRequest('http://localhost/api/whatsapp/templates/nonexistent/sync');
    const res = await POST(req, { params: { id: 'nonexistent' } });

    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.ok).toBe(false);
  });
});