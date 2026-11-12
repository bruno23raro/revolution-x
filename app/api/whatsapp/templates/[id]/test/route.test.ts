// Testes para envio de mensagem de teste de template

import { POST } from './route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/auth', () => ({
  getAuthenticatedUser: jest.fn(),
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
  sendTestMessage: jest.fn(),
}));

jest.mock('@/middleware/rate-limit', () => ({
  rateLimit: jest.fn().mockResolvedValue({ limited: false, remaining: 10, resetIn: 0 }),
}));

const mockUser = {
  id: 'user-123',
  organizationId: 'org-456',
  role: 'admin',
};

const mockTemplate = {
  id: 't-123',
  name: 'welcome_template',
  status: 'APPROVED',
  organizationId: 'org-456',
};

describe('POST /api/whatsapp/templates/[id]/test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('envia mensagem de teste com sucesso', async () => {
    const { getAuthenticatedUser } = require('@/lib/auth');
    const { prisma } = require('@/lib/prisma');
    const { resolveTenantMetaAccess } = require('@/integrations/meta/resolveAccess');
    const { sendTestMessage } = require('@/integrations/meta/whatsappTemplates');

    getAuthenticatedUser.mockResolvedValue(mockUser);
    prisma.whatsappTemplate.findFirst.mockResolvedValue(mockTemplate);
    resolveTenantMetaAccess.mockResolvedValue({
      ok: true,
      access: {
        accessToken: 'test-token-v19',
        phoneNumberId: 'PHONE-123',
        wabaId: 'WABA-456',
      },
    });
    sendTestMessage.mockResolvedValue({
      ok: true,
      messageId: 'msg-test-123',
    });

    const req = new NextRequest('http://localhost/api/whatsapp/templates/t-123/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '5511999998888',
        variables: ['John Doe'],
      }),
    });

    const res = await POST(req, { params: { id: 't-123' } });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.messageId).toBe('msg-test-123');
  });

  it('retorna 401 para usuário não autenticado', async () => {
    const { getAuthenticatedUser } = require('@/lib/auth');
    getAuthenticatedUser.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/whatsapp/templates/t-123/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: '5511999998888' }),
    });

    const res = await POST(req, { params: { id: 't-123' } });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('retorna 401 para membro tentando enviar teste', async () => {
    const { getAuthenticatedUser } = require('@/lib/auth');
    getAuthenticatedUser.mockResolvedValue({ id: 'user-member', organizationId: 'org-456', role: 'member' });

    const req = new NextRequest('http://localhost/api/whatsapp/templates/t-123/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: '5511999998888' }),
    });

    const res = await POST(req, { params: { id: 't-123' } });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('retorna 404 para template não encontrado', async () => {
    const { getAuthenticatedUser } = require('@/lib/auth');
    const { prisma } = require('@/lib/prisma');

    getAuthenticatedUser.mockResolvedValue(mockUser);
    prisma.whatsappTemplate.findFirst.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/whatsapp/templates/nonexistent/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: '5511999998888' }),
    });

    const res = await POST(req, { params: { id: 'nonexistent' } });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('Template não encontrado');
  });

  it('retorna 400 para template não aprovado', async () => {
    const { getAuthenticatedUser } = require('@/lib/auth');
    const { prisma } = require('@/lib/prisma');

    getAuthenticatedUser.mockResolvedValue(mockUser);
    prisma.whatsappTemplate.findFirst.mockResolvedValue({
      id: 't-123',
      name: 'pending_template',
      status: 'PENDING',
      organizationId: 'org-456',
    });

    const req = new NextRequest('http://localhost/api/whatsapp/templates/t-123/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: '5511999998888' }),
    });

    const res = await POST(req, { params: { id: 't-123' } });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Template não aprovado');
    expect(data.detail).toContain('PENDING');
  });

  it('retorna 400 para campo "to" vazio', async () => {
    const { getAuthenticatedUser } = require('@/lib/auth');
    const { prisma } = require('@/lib/prisma');

    getAuthenticatedUser.mockResolvedValue(mockUser);
    prisma.whatsappTemplate.findFirst.mockResolvedValue(mockTemplate);

    const req = new NextRequest('http://localhost/api/whatsapp/templates/t-123/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: '' }),
    });

    const res = await POST(req, { params: { id: 't-123' } });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Campo "to" é obrigatório');
  });

  it('retorna 400 para JSON inválido', async () => {
    const { getAuthenticatedUser } = require('@/lib/auth');
    const { prisma } = require('@/lib/prisma');

    getAuthenticatedUser.mockResolvedValue(mockUser);
    prisma.whatsappTemplate.findFirst.mockResolvedValue(mockTemplate);

    const req = new NextRequest('http://localhost/api/whatsapp/templates/t-123/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json',
    });

    const res = await POST(req, { params: { id: 't-123' } });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('JSON inválido');
  });

  it('suporta idioma customizado', async () => {
    const { getAuthenticatedUser } = require('@/lib/auth');
    const { prisma } = require('@/lib/prisma');
    const { resolveTenantMetaAccess } = require('@/integrations/meta/resolveAccess');
    const { sendTestMessage } = require('@/integrations/meta/whatsappTemplates');

    getAuthenticatedUser.mockResolvedValue(mockUser);
    prisma.whatsappTemplate.findFirst.mockResolvedValue(mockTemplate);
    resolveTenantMetaAccess.mockResolvedValue({
      ok: true,
      access: {
        accessToken: 'test-token-v19',
        phoneNumberId: 'PHONE-123',
        wabaId: 'WABA-456',
      },
    });
    sendTestMessage.mockResolvedValue({
      ok: true,
      messageId: 'msg-test-456',
    });

    const req = new NextRequest('http://localhost/api/whatsapp/templates/t-123/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '5511999998888',
        variables: ['Maria'],
        language: 'pt_BR',
      }),
    });

    const res = await POST(req, { params: { id: 't-123' } });

    expect(res.status).toBe(200);
  });

  it('retorna 400 para idioma inválido', async () => {
    const { getAuthenticatedUser } = require('@/lib/auth');
    const { prisma } = require('@/lib/prisma');

    getAuthenticatedUser.mockResolvedValue(mockUser);
    prisma.whatsappTemplate.findFirst.mockResolvedValue(mockTemplate);

    const req = new NextRequest('http://localhost/api/whatsapp/templates/t-123/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '5511999998888',
        language: 'invalid',
      }),
    });

    const res = await POST(req, { params: { id: 't-123' } });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Idioma inválido');
    expect(data.detail).toContain('xx_XX');
  });

  it('retorna 500 para erro no envio', async () => {
    const { getAuthenticatedUser } = require('@/lib/auth');
    const { prisma } = require('@/lib/prisma');
    const { resolveTenantMetaAccess } = require('@/integrations/meta/resolveAccess');
    const { sendTestMessage } = require('@/integrations/meta/whatsappTemplates');

    getAuthenticatedUser.mockResolvedValue(mockUser);
    prisma.whatsappTemplate.findFirst.mockResolvedValue(mockTemplate);
    resolveTenantMetaAccess.mockResolvedValue({
      ok: true,
      access: {
        accessToken: 'test-token-v19',
        phoneNumberId: 'PHONE-123',
        wabaId: 'WABA-456',
      },
    });
    sendTestMessage.mockResolvedValue({
      ok: false,
      error: 'http_error',
      errorDetail: 'Template not approved for testing',
    });

    const req = new NextRequest('http://localhost/api/whatsapp/templates/t-123/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: '5511999998888' }),
    });

    const res = await POST(req, { params: { id: 't-123' } });

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.ok).toBe(false);
  });

  it('não permite teste para template REJECTED', async () => {
    const { getAuthenticatedUser } = require('@/lib/auth');
    const { prisma } = require('@/lib/prisma');

    getAuthenticatedUser.mockResolvedValue(mockUser);
    prisma.whatsappTemplate.findFirst.mockResolvedValue({
      id: 't-rejected',
      name: 'rejected_template',
      status: 'REJECTED',
      organizationId: 'org-456',
    });

    const req = new NextRequest('http://localhost/api/whatsapp/templates/t-rejected/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: '5511999998888' }),
    });

    const res = await POST(req, { params: { id: 't-rejected' } });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Template não aprovado');
    expect(data.detail).toContain('REJECTED');
  });

  it('rate limiting excedido retorna 429', async () => {
    const { getAuthenticatedUser } = require('@/lib/auth');
    const { prisma } = require('@/lib/prisma');
    const { rateLimit } = require('@/middleware/rate-limit');

    rateLimit.mockResolvedValue({ limited: true, remaining: 0, resetIn: 30000 });
    getAuthenticatedUser.mockResolvedValue(mockUser);
    prisma.whatsappTemplate.findFirst.mockResolvedValue(mockTemplate);

    const req = new NextRequest('http://localhost/api/whatsapp/templates/t-123/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: '5511999998888' }),
    });

    const res = await POST(req, { params: { id: 't-123' } });

    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toBe('Rate limit excedido');
  });

  it('retorna 503 quando Meta não está conectada', async () => {
    const { getAuthenticatedUser } = require('@/lib/auth');
    const { prisma } = require('@/lib/prisma');
    const { resolveTenantMetaAccess } = require('@/integrations/meta/resolveAccess');
    const { rateLimit } = require('@/middleware/rate-limit');

    rateLimit.mockResolvedValue({ limited: false, remaining: 10, resetIn: 0 });
    getAuthenticatedUser.mockResolvedValue(mockUser);
    prisma.whatsappTemplate.findFirst.mockResolvedValue(mockTemplate);
    resolveTenantMetaAccess.mockResolvedValue({
      ok: false,
      reason: 'not_connected',
    });

    const req = new NextRequest('http://localhost/api/whatsapp/templates/t-123/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: '5511999998888' }),
    });

    const res = await POST(req, { params: { id: 't-123' } });

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toBe('not_connected');
  });

  it('envia teste com múltiplas variáveis', async () => {
    const { getAuthenticatedUser } = require('@/lib/auth');
    const { prisma } = require('@/lib/prisma');
    const { resolveTenantMetaAccess } = require('@/integrations/meta/resolveAccess');
    const { sendTestMessage } = require('@/integrations/meta/whatsappTemplates');
    const { rateLimit } = require('@/middleware/rate-limit');

    rateLimit.mockResolvedValue({ limited: false, remaining: 5, resetIn: 0 });
    getAuthenticatedUser.mockResolvedValue(mockUser);
    prisma.whatsappTemplate.findFirst.mockResolvedValue(mockTemplate);
    resolveTenantMetaAccess.mockResolvedValue({
      ok: true,
      access: { accessToken: 'token', phoneNumberId: 'PN-123' },
    });
    sendTestMessage.mockResolvedValue({ ok: true, messageId: 'msg-multi' });

    const req = new NextRequest('http://localhost/api/whatsapp/templates/t-123/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '5511999998888',
        variables: ['João', 'Maria', 'Pedro'],
      }),
    });

    const res = await POST(req, { params: { id: 't-123' } });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(sendTestMessage).toHaveBeenCalledWith(
      expect.anything(),
      'welcome_template',
      '5511999998888',
      ['João', 'Maria', 'Pedro'],
      expect.anything(),
    );
  });

  it('usa variáveis vazias quando body não fornece', async () => {
    const { getAuthenticatedUser } = require('@/lib/auth');
    const { prisma } = require('@/lib/prisma');
    const { resolveTenantMetaAccess } = require('@/integrations/meta/resolveAccess');
    const { sendTestMessage } = require('@/integrations/meta/whatsappTemplates');
    const { rateLimit } = require('@/middleware/rate-limit');

    rateLimit.mockResolvedValue({ limited: false, remaining: 5, resetIn: 0 });
    getAuthenticatedUser.mockResolvedValue(mockUser);
    prisma.whatsappTemplate.findFirst.mockResolvedValue({
      id: 't-simple',
      name: 'simple_template',
      status: 'APPROVED',
      organizationId: 'org-456',
    });
    resolveTenantMetaAccess.mockResolvedValue({
      ok: true,
      access: { accessToken: 'token', phoneNumberId: 'PN-123' },
    });
    sendTestMessage.mockResolvedValue({ ok: true, messageId: 'msg-simple' });

    const req = new NextRequest('http://localhost/api/whatsapp/templates/t-simple/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: '5511999998888' }),
    });

    const res = await POST(req, { params: { id: 't-simple' } });

    expect(res.status).toBe(200);
    expect(sendTestMessage).toHaveBeenCalledWith(
      expect.anything(),
      'simple_template',
      '5511999998888',
      [],  // variáveis vazias
      expect.anything(),
    );
  });
});