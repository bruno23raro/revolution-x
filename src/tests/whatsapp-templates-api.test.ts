// @ts-nocheck
// FASE 5.1 — Testes da API de templates WhatsApp
// Testes para GET/POST /api/whatsapp/templates e /api/whatsapp/templates/[id]/test
// SYNC foi consolidado em /api/whatsapp/templates/[id]/sync (contrato separado)

import { NextRequest } from 'next/server';

// Mock do rate-limit primeiro
jest.mock('@/middleware/rate-limit', () => ({
  rateLimit: jest.fn().mockResolvedValue({ limited: false, remaining: 100, resetIn: 0 }),
}));

// Mock dos módulos de autenticação
jest.mock('@/lib/auth', () => ({
  getAuthenticatedUser: jest.fn(),
  getAllOrganizationMemberships: jest.fn(),
}));

// Mock do prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    whatsappTemplate: {
      findFirst: jest.fn(),
    },
  },
}));

// Mock das integrações Meta
jest.mock('@/integrations/meta/resolveAccess', () => ({
  resolveTenantMetaAccess: jest.fn(),
}));

jest.mock('@/integrations/meta/whatsappTemplates', () => ({
  listWhatsAppTemplates: jest.fn(),
  createWhatsAppTemplate: jest.fn(),
  sendTestMessage: jest.fn(),
}));

const { GET: templatesGET, POST: templatesPOST } = require('../../app/api/whatsapp/templates/route');
const { POST: testPOST } = require('../../app/api/whatsapp/templates/[id]/test/route');

const { getAuthenticatedUser, getAllOrganizationMemberships } = require('@/lib/auth');
const { resolveTenantMetaAccess } = require('@/integrations/meta/resolveAccess');
const { listWhatsAppTemplates, createWhatsAppTemplate, sendTestMessage } = require('@/integrations/meta/whatsappTemplates');
const { prisma } = require('@/lib/prisma');

function req(path: string, body?: string, method: 'GET' | 'POST' = 'GET') {
  const headers: Record<string, string> = {};
  if (body) {
    headers['Content-Type'] = 'application/json';
  }
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers,
    body,
  });
}

function reqWithId(path: string, id: string, body?: string) {
  const headers: Record<string, string> = {};
  if (body) {
    headers['Content-Type'] = 'application/json';
  }
  return new NextRequest(`http://localhost${path}`, {
    method: body ? 'POST' : 'GET',
    headers,
    body,
  });
}

const USER = { id: 'u1', organizationId: 'org1', role: 'member', email: 'test@example.com' };
const ADMIN = { id: 'u2', organizationId: 'org1', role: 'admin', email: 'admin@example.com' };
const OWNER = { id: 'u3', organizationId: 'org1', role: 'owner', email: 'owner@example.com' };

describe('GET /api/whatsapp/templates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('401 sem sessão', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(null);
    const res = await templatesGET(req('/api/whatsapp/templates'));
    expect(res.status).toBe(401);
  });

  it('devolve templates do tenant (sem dados sensíveis)', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(USER);
    (resolveTenantMetaAccess as jest.Mock).mockResolvedValue({
      ok: true,
      access: { accessToken: 'tok', phoneNumberId: '123', wabaId: 'w1' },
    });
    (listWhatsAppTemplates as jest.Mock).mockResolvedValue({
      ok: true,
      templates: [
        { name: 'boas_vindas', category: 'UTILITY', status: 'APPROVED', language: 'pt_BR' },
        { name: 'promocao', category: 'MARKETING', status: 'PENDING', language: 'pt_BR' },
      ],
    });

    const res = await templatesGET(req('/api/whatsapp/templates'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.templates).toHaveLength(2);
    expect(data.templates[0].name).toBe('boas_vindas');
    // Não expõe tokens
    expect(JSON.stringify(data)).not.toMatch(/token|secret|accessToken/i);
  });

  it('409 quando Meta não configurado (not_connected)', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(USER);
    (resolveTenantMetaAccess as jest.Mock).mockResolvedValue({ ok: false, reason: 'not_connected' });

    const res = await templatesGET(req('/api/whatsapp/templates'));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe('not_connected');
  });

  it('suporta filtro por conta (multicontas)', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(USER);
    (resolveTenantMetaAccess as jest.Mock).mockResolvedValue({
      ok: true,
      access: { accessToken: 'tok', phoneNumberId: '456', wabaId: 'w1' },
    });
    (listWhatsAppTemplates as jest.Mock).mockResolvedValue({
      ok: true,
      templates: [{ name: 'test_template', category: 'MARKETING', status: 'APPROVED', language: 'pt_BR' }],
    });

    const res = await templatesGET(req('/api/whatsapp/templates?account=PNID-456'));
    expect(res.status).toBe(200);
    expect(resolveTenantMetaAccess).toHaveBeenCalledWith(
      'org1',
      {},
      'PNID-456'
    );
  });
});

describe('POST /api/whatsapp/templates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('401 sem sessão', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(null);
    const res = await templatesPOST(req('/api/whatsapp/templates', JSON.stringify({ name: 'test' }), 'POST'));
    expect(res.status).toBe(401);
  });

  it('401 para membro não-admin', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(USER);
    const res = await templatesPOST(req('/api/whatsapp/templates', JSON.stringify({ name: 'test' }), 'POST'));
    expect(res.status).toBe(401);
  });

  it('cria template com sucesso (admin)', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(ADMIN);
    (getAllOrganizationMemberships as jest.Mock).mockResolvedValue([{ role: 'admin' }]);
    (resolveTenantMetaAccess as jest.Mock).mockResolvedValue({
      ok: true,
      access: { accessToken: 'tok', phoneNumberId: '123', wabaId: 'w1' },
    });
    (createWhatsAppTemplate as jest.Mock).mockResolvedValue({
      ok: true,
      name: 'promocao_boleto',
      templateId: 'tpl-123',
    });

    const body = JSON.stringify({
      name: 'promocao_boleto',
      category: 'MARKETING',
      language: 'pt_BR',
      body: 'Olá {{1}}, seu boleto está pronto!',
    });

    const res = await templatesPOST(req('/api/whatsapp/templates', body, 'POST'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.name).toBe('promocao_boleto');
  });

  it('400 com nome vazio', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(ADMIN);
    (getAllOrganizationMemberships as jest.Mock).mockResolvedValue([{ role: 'admin' }]);

    const res = await templatesPOST(req('/api/whatsapp/templates', JSON.stringify({ name: '' }), 'POST'));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe('name_vazio');
  });

  it('400 com nome com letra maiúscula (inválido)', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(ADMIN);
    (getAllOrganizationMemberships as jest.Mock).mockResolvedValue([{ role: 'admin' }]);
    (resolveTenantMetaAccess as jest.Mock).mockResolvedValue({
      ok: true,
      access: { accessToken: 'tok', phoneNumberId: '123', wabaId: 'w1' },
    });

    const res = await templatesPOST(
      req('/api/whatsapp/templates', JSON.stringify({ name: 'InvalidName', category: 'MARKETING' }), 'POST')
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe('name_invalido');
  });

  it('aceita nome começando com número (regra Meta: a-z, 0-9, underscore)', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(ADMIN);
    (getAllOrganizationMemberships as jest.Mock).mockResolvedValue([{ role: 'admin' }]);
    (resolveTenantMetaAccess as jest.Mock).mockResolvedValue({
      ok: true,
      access: { accessToken: 'tok', phoneNumberId: '123', wabaId: 'w1' },
    });
    (createWhatsAppTemplate as jest.Mock).mockResolvedValue({
      ok: true,
      name: '123promo',
      templateId: 'tpl-789',
    });

    const res = await templatesPOST(
      req('/api/whatsapp/templates', JSON.stringify({ name: '123promo', category: 'MARKETING' }), 'POST')
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.name).toBe('123promo');
  });

  it('cria template com header de texto', async () => {
    jest.clearAllMocks();
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(ADMIN);
    (getAllOrganizationMemberships as jest.Mock).mockResolvedValue([{ role: 'admin' }]);
    (resolveTenantMetaAccess as jest.Mock).mockResolvedValue({
      ok: true,
      access: { accessToken: 'tok', phoneNumberId: '123', wabaId: 'w1' },
    });
    (createWhatsAppTemplate as jest.Mock).mockResolvedValue({
      ok: true,
      name: 'header_promo',
      templateId: 'tpl-456',
    });

    const body = JSON.stringify({
      name: 'header_promo',
      category: 'MARKETING',
      language: 'pt_BR',
      header: { type: 'TEXT', text: 'Promoção Especial' },
      body: 'Olá {{1}}, oferta exclusiva!',
      footer: 'Revolution X',
      buttons: [{ type: 'QUICK_REPLY', text: 'Ver mais' }],
    });

    const res = await templatesPOST(req('/api/whatsapp/templates', body, 'POST'));
    expect(res.status).toBe(200);
    expect(createWhatsAppTemplate).toHaveBeenCalledTimes(1);
    const [actualAccess, actualSpec] = createWhatsAppTemplate.mock.calls[0];
    expect(actualSpec.name).toBe('header_promo');
    expect(actualSpec.category).toBe('MARKETING');
    expect(actualSpec.language).toBe('pt_BR');
    expect(actualSpec.header).toEqual({ type: 'TEXT', text: 'Promoção Especial' });
  });
});

describe('POST /api/whatsapp/templates/[id]/test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('401 sem sessão', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(null);
    const res = await testPOST(req('/api/whatsapp/templates/tpl-1/test', JSON.stringify({ to: '5511999998888' }), 'POST'), { params: { id: 'tpl-1' } });
    expect(res.status).toBe(401);
  });

  it('401 para membro tentando enviar teste', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(USER);
    const res = await testPOST(req('/api/whatsapp/templates/tpl-1/test', JSON.stringify({ to: '5511999998888' }), 'POST'), { params: { id: 'tpl-1' } });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('404 para template não encontrado', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(ADMIN);
    (prisma.whatsappTemplate.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await testPOST(req('/api/whatsapp/templates/nonexistent/test', JSON.stringify({ to: '5511999998888' }), 'POST'), { params: { id: 'nonexistent' } });
    expect(res.status).toBe(404);
  });

  it('400 para template não aprovado', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(ADMIN);
    (prisma.whatsappTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: 'tpl-123',
      name: 'pending_template',
      status: 'PENDING',
      organizationId: 'org1',
    });

    const res = await testPOST(req('/api/whatsapp/templates/tpl-123/test', JSON.stringify({ to: '5511999998888' }), 'POST'), { params: { id: 'tpl-123' } });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe('Template não aprovado');
  });

  it('400 sem campo to', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(ADMIN);
    (prisma.whatsappTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: 'tpl-123',
      name: 'approved_template',
      status: 'APPROVED',
      organizationId: 'org1',
    });

    const res = await testPOST(req('/api/whatsapp/templates/tpl-123/test', JSON.stringify({}), 'POST'), { params: { id: 'tpl-123' } });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe('Campo "to" é obrigatório');
  });

  it('503 quando Meta não configurado (not_connected)', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(ADMIN);
    (prisma.whatsappTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: 'tpl-123',
      name: 'approved_template',
      status: 'APPROVED',
      organizationId: 'org1',
    });
    (resolveTenantMetaAccess as jest.Mock).mockResolvedValue({ ok: false, reason: 'not_connected' });

    const res = await testPOST(req('/api/whatsapp/templates/tpl-123/test', JSON.stringify({ to: '5511999998888' }), 'POST'), { params: { id: 'tpl-123' } });
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe('not_connected');
  });

  it('envia mensagem de teste com sucesso', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(ADMIN);
    (prisma.whatsappTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: 'tpl-123',
      name: 'boas_vindas',
      status: 'APPROVED',
      organizationId: 'org1',
    });
    (resolveTenantMetaAccess as jest.Mock).mockResolvedValue({
      ok: true,
      access: { accessToken: 'tok', phoneNumberId: '123', wabaId: 'w1' },
    });
    (sendTestMessage as jest.Mock).mockResolvedValue({
      ok: true,
      messageId: 'msg-test-456',
    });

    const res = await testPOST(
      req('/api/whatsapp/templates/tpl-123/test', JSON.stringify({
        to: '5511999998888',
        variables: ['João'],
      }), 'POST'),
      { params: { id: 'tpl-123' } }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.messageId).toBe('msg-test-456');
    expect(sendTestMessage).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'tok' }),
      'boas_vindas',
      '5511999998888',
      ['João'],
      { language: 'en_US' }
    );
  });

  it('envia teste sem variáveis', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(ADMIN);
    (prisma.whatsappTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: 'tpl-456',
      name: 'simple_template',
      status: 'APPROVED',
      organizationId: 'org1',
    });
    (resolveTenantMetaAccess as jest.Mock).mockResolvedValue({
      ok: true,
      access: { accessToken: 'tok', phoneNumberId: '123', wabaId: 'w1' },
    });
    (sendTestMessage as jest.Mock).mockResolvedValue({
      ok: true,
      messageId: 'msg-test-789',
    });

    const res = await testPOST(req('/api/whatsapp/templates/tpl-456/test', JSON.stringify({ to: '5511999998888' }), 'POST'), { params: { id: 'tpl-456' } });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(sendTestMessage).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'tok' }),
      'simple_template',
      '5511999998888',
      [],
      { language: 'en_US' }
    );
  });
});