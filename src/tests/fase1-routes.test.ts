// src/tests/fase1-routes.test.ts  (FASE 1 — rotas do Hub de Integrações + WhatsApp)
//
// Testa as 7 rotas novas no nível de rota, seguindo o padrão de admin-routes:
// mockamos as FRONTEIRAS (@/lib/auth, @/lib/prisma, @/lib/taskQueue, @/lib/encryption,
// @/lib/supabase/server e os leaves Meta), e deixamos `configStore` + `providers` rodarem
// DE VERDADE sobre os mocks — assim a validação de campos obrigatórios, a determinação
// "configurado" e os health probes são exercitados de verdade em cada chamada.
// @ts-nocheck  -- wiring de mocks dinâmicos; coerente com admin-routes.test.ts

import { NextRequest } from 'next/server';

// ── auth ──────────────────────────────────────────────────────────────────────
jest.mock('@/lib/auth', () => ({
  getAuthenticatedUser: jest.fn(),
  getAllOrganizationMemberships: jest.fn(),
}));

// ── prisma: client fake (agentMemory + webhookEvent + task) ──────────────────
jest.mock('@/lib/prisma', () => {
  const agentMemory = {
    upsert: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  };
  const webhookEvent = { create: jest.fn() };
  const task = { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() };
  const prisma = { agentMemory, webhookEvent, task };
  return {
    prisma,
    withTenantContextOn: jest.fn(async (client, _org, cb) => cb(client)),
    withTenantContext: jest.fn(async (_org, cb) => cb(prisma)),
  };
});

// ── taskQueue: erros reais + funções que DEVEM retornar promise ─────────────
jest.mock('@/lib/taskQueue', () => {
  class TaskQueueUnavailableError extends Error {
    constructor(msg) {
      super(msg);
      this.name = 'TaskQueueUnavailableError';
    }
  }
  return {
    TaskQueueUnavailableError,
    createTask: jest.fn(),
    startTask: jest.fn(),
    markStep: jest.fn(),
    completeTask: jest.fn(),
    failTask: jest.fn(),
    cancelTask: jest.fn(),
    saveMemory: jest.fn(),
    listMemory: jest.fn(),
  };
});

// ── encryption + supabase service_role (rotas de refresh-token) ─────────────
jest.mock('@/lib/encryption', () => ({ encryptToken: jest.fn(), decryptToken: jest.fn() }));
jest.mock('@/lib/supabase/server', () => ({ createServiceRoleClient: jest.fn() }));

// ── leaves Meta (sender / templates / resolveAccess / refresh) ───────────────
jest.mock('@/integrations/meta/resolveAccess', () => ({ resolveTenantMetaAccess: jest.fn() }));
jest.mock('@/integrations/meta/whatsappSender', () => ({
  runMassSend: jest.fn(),
  sendWhatsAppText: jest.fn(),
  sendWhatsAppTemplate: jest.fn(),
}));
jest.mock('@/integrations/meta/whatsappTemplates', () => ({
  listWhatsAppTemplates: jest.fn(),
  createWhatsAppTemplate: jest.fn(),
}));
jest.mock('@/integrations/meta/tokenRefresh', () => ({ refreshMetaAccessToken: jest.fn() }));

// ── exige as rotas sob teste (path relativo; @/connectors e @/integrations mapeados) ──
const { GET: configGET, POST: configPOST, DELETE: configDELETE } = require('../../app/api/integrations/config/route');
const { GET: healthGET } = require('../../app/api/integrations/health/route');
const { POST: refreshPOST } = require('../../app/api/integrations/meta/refresh-token/route');
const { POST: sendPOST } = require('../../app/api/whatsapp/send/route');
const { GET: tplGET, POST: tplPOST } = require('../../app/api/whatsapp/templates/route');
const { GET: botGET, POST: botPOST, DELETE: botDELETE } = require('../../app/api/whatsapp/chatbot/route');
const { POST: inboundPOST } = require('../../app/api/webhooks/inbound/route');

const { getAuthenticatedUser, getAllOrganizationMemberships } = require('@/lib/auth');
const { prisma } = require('@/lib/prisma');
const {
  TaskQueueUnavailableError,
  createTask,
  startTask,
  markStep,
  completeTask,
  saveMemory,
  listMemory,
} = require('@/lib/taskQueue');
const { encryptToken } = require('@/lib/encryption');
const { createServiceRoleClient } = require('@/lib/supabase/server');
const { resolveTenantMetaAccess } = require('@/integrations/meta/resolveAccess');
const { runMassSend } = require('@/integrations/meta/whatsappSender');
const { listWhatsAppTemplates, createWhatsAppTemplate } = require('@/integrations/meta/whatsappTemplates');
const { refreshMetaAccessToken } = require('@/integrations/meta/tokenRefresh');
const { PROVIDERS } = require('@/integrations/providers');

// ── fixtures ──────────────────────────────────────────────────────────────────
const ADMIN = { id: 'user-admin', role: 'admin', organizationId: 'org-admin', email: 'a@x.com' };

function asAdmin() {
  getAuthenticatedUser.mockResolvedValue(ADMIN);
  getAllOrganizationMemberships.mockResolvedValue([]);
}
function asNoUser() {
  getAuthenticatedUser.mockResolvedValue(null);
}

function req(url, { method = 'GET', body, headers } = {}) {
  const init = { method, headers };
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
    init.headers = { 'content-type': 'application/json', ...headers };
  }
  return new NextRequest('http://localhost' + url, init);
}

// resolveAccess "conectado" (para rotas de WhatsApp/refresh)
function connectedAccess() {
  resolveTenantMetaAccess.mockResolvedValue({
    ok: true,
    access: { accessToken: 'TOK', phoneNumberId: 'PH', wabaId: 'WABA' },
    row: { id: 'row-1', provider: 'whatsapp', phone_number_id: 'PH', whatsapp_business_account_id: 'WABA' },
  });
}
function notConnected() {
  resolveTenantMetaAccess.mockResolvedValue({ ok: false, reason: 'not_connected' });
}

function fakeServiceRole() {
  const finished = { error: null };
  const q = { eq: jest.fn(async () => finished) };
  const update = jest.fn(() => q);
  const from = jest.fn(() => ({ update }));
  createServiceRoleClient.mockReturnValue({ from });
  return { update, q, finished };
}

beforeEach(() => {
  jest.clearAllMocks();
  // taskQueue: tudo resolve por padrão (send usa createTask/startTask/markStep/completeTask)
  createTask.mockResolvedValue({ taskId: 'task-1' });
  startTask.mockResolvedValue({});
  markStep.mockResolvedValue({});
  completeTask.mockResolvedValue({});
  saveMemory.mockResolvedValue({});
  listMemory.mockResolvedValue([]);
  // prisma
  prisma.agentMemory.deleteMany.mockResolvedValue({ count: 0 });
  prisma.agentMemory.findFirst.mockResolvedValue(null);
  prisma.webhookEvent.create.mockResolvedValue({ id: 'ev-1' });
});

// ============================================================================
// /api/integrations/config
// ============================================================================
describe('GET /api/integrations/config', () => {
  it('401 sem usuário', async () => {
    asNoUser();
    expect((await configGET(req('/api/integrations/config'))).status).toBe(401);
  });

  it('200 lista o estado de TODOS os provedores (toda configurado, sem segredos)', async () => {
    asAdmin();
    listMemory.mockResolvedValue([
      { kind: 'preference', key: 'integration:tiktok', value: { clientKey: 'k', clientSecret: 's' }, updatedAt: new Date() },
    ]);
    const res = await configGET(req('/api/integrations/config'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.providers).toHaveLength(PROVIDERS.length);
    const tiktok = json.providers.find((p) => p.id === 'tiktok');
    expect(tiktok.configured).toBe(true);
    const meta = json.providers.find((p) => p.id === 'meta');
    expect(meta.configured).toBe(false);
    // nada devolve valor de segredo
    expect(JSON.stringify(json)).not.toContain('clientSecret');
  });

  it('503 quando a fila/memória está indisponível', async () => {
    asAdmin();
    listMemory.mockRejectedValue(new TaskQueueUnavailableError('down'));
    const res = await configGET(req('/api/integrations/config'));
    expect(res.status).toBe(503);
    expect((await res.json()).detail).toContain('down');
  });
});

describe('POST /api/integrations/config', () => {
  it('401 sem admin', async () => {
    asNoUser();
    expect((await configPOST(req('/api/integrations/config', { method: 'POST', body: { provider: 'tiktok', value: {} } }))).status).toBe(401);
  });

  it('400 provedor desconhecido', async () => {
    asAdmin();
    const res = await configPOST(req('/api/integrations/config', { method: 'POST', body: { provider: 'xpto', value: {} } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('desconhecido');
  });

  it('400 campos obrigatórios faltando (tiktok)', async () => {
    asAdmin();
    const res = await configPOST(
      req('/api/integrations/config', { method: 'POST', body: { provider: 'tiktok', value: { clientKey: 'k' } } }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('clientSecret');
  });

  it('200 salva (provedor sem campos obrigatórios, ex.: meta)', async () => {
    asAdmin();
    const res = await configPOST(
      req('/api/integrations/config', { method: 'POST', body: { provider: 'meta', value: {} } }),
    );
    expect(res.status).toBe(200);
    expect(saveMemory).toHaveBeenCalledWith(prisma, expect.anything(), 'preference', 'integration:meta', {});
  });
});

describe('DELETE /api/integrations/config', () => {
  it('401 sem admin', async () => {
    asNoUser();
    expect((await configDELETE(req('/api/integrations/config?provider=meta', { method: 'DELETE' }))).status).toBe(401);
  });

  it('400 provedor desconhecido', async () => {
    asAdmin();
    expect((await configDELETE(req('/api/integrations/config?provider=xpto', { method: 'DELETE' }))).status).toBe(400);
  });

  it('200 remove (agentMemory.deleteMany)', async () => {
    asAdmin();
    const res = await configDELETE(req('/api/integrations/config?provider=tiktok', { method: 'DELETE' }));
    expect(res.status).toBe(200);
    expect(prisma.agentMemory.deleteMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-admin',
        userId: 'user-admin',
        kind: 'preference',
        memoryKey: 'integration:tiktok',
      },
    });
  });
});

// ============================================================================
// /api/integrations/health
// ============================================================================
describe('GET /api/integrations/health', () => {
  it('401 sem admin', async () => {
    asNoUser();
    expect((await healthGET(req('/api/integrations/health'))).status).toBe(401);
  });

  it('200 sonda todos os provedores; provider "keys" configurado → ok; OAuth semeadado → skipped', async () => {
    asAdmin();
    listMemory.mockResolvedValue([
      { kind: 'preference', key: 'integration:tiktok', value: { clientKey: 'k', clientSecret: 's' }, updatedAt: new Date() },
      { kind: 'preference', key: 'integration:meta', value: {}, updatedAt: new Date() },
    ]);
    const res = await healthGET(req('/api/integrations/health'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.health).toHaveLength(PROVIDERS.length);
    const tiktok = json.health.find((h) => h.provider === 'tiktok');
    expect(tiktok.status).toBe('ok');
    // meta: com valor + probe 'none' + camada oficial → 'skipped' (gerido via OAuth)
    const meta = json.health.find((h) => h.provider === 'meta');
    expect(meta.status).toBe('skipped');
  });
});

// ============================================================================
// /api/integrations/meta/refresh-token
// ============================================================================
describe('POST /api/integrations/meta/refresh-token', () => {
  it('401 sem admin', async () => {
    asNoUser();
    expect((await refreshPOST(req('/api/integrations/meta/refresh-token', { method: 'POST' }))).status).toBe(401);
  });

  it('409 não conectado', async () => {
    asAdmin();
    notConnected();
    expect((await refreshPOST(req('/api/integrations/meta/refresh-token', { method: 'POST' }))).status).toBe(409);
  });

  it('200 happy: troca token, re-criptografa e persiste (via service_role)', async () => {
    asAdmin();
    connectedAccess();
    refreshMetaAccessToken.mockResolvedValue({ ok: true, accessToken: 'NEW', expiresIn: 3600 });
    encryptToken.mockReturnValue('ENC');
    const sr = fakeServiceRole();

    const res = await refreshPOST(req('/api/integrations/meta/refresh-token', { method: 'POST' }));
    expect(res.status).toBe(200);
    expect((await res.json())).toEqual({ ok: true, expiresIn: 3600 });
    expect(refreshMetaAccessToken).toHaveBeenCalledWith({ appId: '', appSecret: '' }, 'TOK');
    expect(encryptToken).toHaveBeenCalledWith('NEW');
    expect(sr.update.mock.calls[0][0].encrypted_access_token).toBe('ENC');
    expect(sr.q.eq).toHaveBeenCalledWith('id', 'row-1');
  });

  it('502 quando a troca falha', async () => {
    asAdmin();
    connectedAccess();
    refreshMetaAccessToken.mockResolvedValue({ ok: false, error: 'http_error', errorDetail: 'HTTP 400' });
    const res = await refreshPOST(req('/api/integrations/meta/refresh-token', { method: 'POST' }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('http_error');
  });
});

// ============================================================================
// /api/whatsapp/send
// ============================================================================
describe('POST /api/whatsapp/send', () => {
  it('401 sem usuário', async () => {
    asNoUser();
    expect((await sendPOST(req('/api/whatsapp/send', { method: 'POST', body: { to: ['5511'] } }))).status).toBe(401);
  });

  it('400 sem destinatários', async () => {
    asAdmin();
    const res = await sendPOST(req('/api/whatsapp/send', { method: 'POST', body: { to: [] } }));
    expect(res.status).toBe(400);
  });

  it('400 acima do limite (500)', async () => {
    asAdmin();
    const many = Array.from({ length: 501 }, (_, i) => '55119' + i);
    const res = await sendPOST(req('/api/whatsapp/send', { method: 'POST', body: { to: many, text: 'oi' } }));
    expect(res.status).toBe(400);
  });

  it('409 não conectado', async () => {
    asAdmin();
    notConnected();
    const res = await sendPOST(req('/api/whatsapp/send', { method: 'POST', body: { to: ['5511'], text: 'oi' } }));
    expect(res.status).toBe(409);
  });

  it('200 happy: envia, agrega contagens e trackeia (tracked=true)', async () => {
    asAdmin();
    connectedAccess();
    runMassSend.mockResolvedValue({ total: 2, sent: 2, failed: 0, results: [] });
    const res = await sendPOST(
      req('/api/whatsapp/send', { method: 'POST', body: { to: ['5511', '5522'], text: 'oi', delayMs: 500 } }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.tracked).toBe(true);
    // `to:[...]` + `text` anexa o texto a cada destinatário
    expect(runMassSend).toHaveBeenCalledWith(
      { accessToken: 'TOK', phoneNumberId: 'PH', wabaId: 'WABA' },
      [{ to: '5511', text: 'oi' }, { to: '5522', text: 'oi' }],
      expect.objectContaining({ delayMs: 500 }),
    );
  });

  it('deduplica números repetidos', async () => {
    asAdmin();
    connectedAccess();
    runMassSend.mockResolvedValue({ total: 2, sent: 2, failed: 0, results: [] });
    await sendPOST(req('/api/whatsapp/send', { method: 'POST', body: { to: ['5511', '5511', '5522'], text: 'oi' } }));
    const recipients = runMassSend.mock.calls[0][1];
    expect(recipients).toHaveLength(2);
  });

  it('fila indisponível → tracked=false, MAS o envio acontece (degradação honesta)', async () => {
    asAdmin();
    connectedAccess();
    createTask.mockRejectedValue(new TaskQueueUnavailableError('down'));
    runMassSend.mockResolvedValue({ total: 1, sent: 1, failed: 0, results: [] });
    const res = await sendPOST(req('/api/whatsapp/send', { method: 'POST', body: { to: ['5511'], text: 'oi' } }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tracked).toBe(false);
    expect(runMassSend).toHaveBeenCalled(); // trabalho real não foi bloqueado
  });
});

// ============================================================================
// /api/whatsapp/templates
// ============================================================================
describe('GET /api/whatsapp/templates', () => {
  it('401 sem usuário', async () => {
    asNoUser();
    expect((await tplGET(req('/api/whatsapp/templates'))).status).toBe(401);
  });

  it('409 não conectado', async () => {
    asAdmin();
    notConnected();
    expect((await tplGET(req('/api/whatsapp/templates'))).status).toBe(409);
  });

  it('200 lista templates', async () => {
    asAdmin();
    connectedAccess();
    listWhatsAppTemplates.mockResolvedValue({ ok: true, templates: [{ name: 'promo', category: 'MARKETING' }] });
    const res = await tplGET(req('/api/whatsapp/templates'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.templates).toHaveLength(1);
  });

  it('502 quando a lista falha na Meta', async () => {
    asAdmin();
    connectedAccess();
    listWhatsAppTemplates.mockResolvedValue({ ok: false, templates: [], error: 'http_error' });
    expect((await tplGET(req('/api/whatsapp/templates'))).status).toBe(502);
  });
});

describe('POST /api/whatsapp/templates', () => {
  it('400 name vazio', async () => {
    asAdmin();
    const res = await tplPOST(req('/api/whatsapp/templates', { method: 'POST', body: { name: '  ' } }));
    expect(res.status).toBe(400);
  });

  it('200 cria template (admin)', async () => {
    asAdmin();
    connectedAccess();
    createWhatsAppTemplate.mockResolvedValue({ ok: true, name: 'novo' });
    const res = await tplPOST(
      req('/api/whatsapp/templates', { method: 'POST', body: { name: 'novo', category: 'UTILITY', body: 'Oi {{1}}' } }),
    );
    expect(res.status).toBe(200);
    expect(createWhatsAppTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'TOK' }),
      expect.objectContaining({ name: 'novo', category: 'UTILITY' }),
    );
  });
});

// ============================================================================
// /api/whatsapp/chatbot
// ============================================================================
describe('GET /api/whatsapp/chatbot', () => {
  it('401 sem admin', async () => {
    asNoUser();
    expect((await botGET(req('/api/whatsapp/chatbot'))).status).toBe(401);
  });

  it('200 config ausente → null', async () => {
    asAdmin();
    listMemory.mockResolvedValue([]);
    const res = await botGET(req('/api/whatsapp/chatbot'));
    expect(res.status).toBe(200);
    expect((await res.json()).config).toBeNull();
  });

  it('200 config salva', async () => {
    asAdmin();
    listMemory.mockResolvedValue([
      { kind: 'preference', key: 'chatbot_config', value: { enabled: true, rules: [] }, updatedAt: new Date() },
    ]);
    const res = await botGET(req('/api/whatsapp/chatbot'));
    expect((await res.json()).config).toMatchObject({ enabled: true, rules: [] });
  });
});

describe('POST /api/whatsapp/chatbot', () => {
  it('400 JSON inválido', async () => {
    asAdmin();
    const res = await botPOST(req('/api/whatsapp/chatbot', { method: 'POST', body: 'nao-e-json' }));
    expect(res.status).toBe(400);
  });

  it('200 normaliza e salva (regras com matchType inválido → keyword)', async () => {
    asAdmin();
    const res = await botPOST(
      req('/api/whatsapp/chatbot', {
        method: 'POST',
        body: {
          enabled: true,
          rules: [{ matchType: 'regex', pattern: 'preco', response: 'Tabela aqui' }, { matchType: 'BOGUS', pattern: 'x' }],
        },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.status).toBe(200);
    expect(saveMemory).toHaveBeenCalledWith(
      prisma,
      { organizationId: 'org-admin', userId: 'user-admin' },
      'preference',
      'chatbot_config',
      expect.objectContaining({ enabled: true, rules: [expect.objectContaining({ matchType: 'regex' }), expect.objectContaining({ matchType: 'keyword' })] }),
    );
  });
});

describe('DELETE /api/whatsapp/chatbot', () => {
  it('401 sem admin', async () => {
    asNoUser();
    expect((await botDELETE(req('/api/whatsapp/chatbot', { method: 'DELETE' }))).status).toBe(401);
  });

  it('200 remove a config', async () => {
    asAdmin();
    const res = await botDELETE(req('/api/whatsapp/chatbot', { method: 'DELETE' }));
    expect(res.status).toBe(200);
    expect(prisma.agentMemory.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ memoryKey: 'chatbot_config', kind: 'preference' }) }),
    );
  });
});

// ============================================================================
// /api/webhooks/inbound
// ============================================================================
describe('POST /api/webhooks/inbound', () => {
  const ORG = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3d76f1';
  function inbound(body, headers = {}) {
    return inboundPOST(
      new NextRequest('http://localhost/api/webhooks/inbound', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json', ...headers },
      }),
    );
  }

  it('400 organização inválida (não-uuid)', async () => {
    const res = await inbound({ event: 'lead' }, { 'x-organization-id': 'nao-uuid', 'x-webhook-secret': 's' });
    expect(res.status).toBe(400);
  });

  it('401 sem secret', async () => {
    const res = await inbound({ event: 'lead' }, { 'x-organization-id': ORG });
    expect(res.status).toBe(401);
  });

  it('401 secret inválido (não confere com o guardado)', async () => {
    prisma.agentMemory.findFirst.mockResolvedValue({ valueJson: { secret: 'acertado' } });
    const res = await inbound({ event: 'lead' }, { 'x-organization-id': ORG, 'x-webhook-secret': 'errado' });
    expect(res.status).toBe(401);
  });

  it('200 secret confere → grava evento (recorded=true)', async () => {
    prisma.agentMemory.findFirst.mockResolvedValue({ valueJson: { secret: 'acertado' } });
    prisma.webhookEvent.create.mockResolvedValue({ id: 'ev-9' });
    const res = await inbound({ event: 'lead', name: 'x' }, { 'x-organization-id': ORG, 'x-webhook-secret': 'acertado' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.recorded).toBe(true);
    expect(json.eventType).toBe('lead');
    expect(prisma.webhookEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ organizationId: ORG, eventType: 'lead' }) }),
    );
  });

  it('200 gravação indisponível → degrade (recorded=false, mas ainda ack 200)', async () => {
    prisma.agentMemory.findFirst.mockResolvedValue({ valueJson: { secret: 'acertado' } });
    prisma.webhookEvent.create.mockRejectedValue(new Error('P2021'));
    const res = await inbound({ event: 'lead' }, { 'x-organization-id': ORG, 'x-webhook-secret': 'acertado' });
    expect(res.status).toBe(200);
    expect((await res.json()).recorded).toBe(false);
  });

  it('secret ausente no banco → 401 (fail-closed)', async () => {
    prisma.agentMemory.findFirst.mockResolvedValue(null);
    const res = await inbound({ event: 'lead' }, { 'x-organization-id': ORG, 'x-webhook-secret': 'acertado' });
    expect(res.status).toBe(401);
  });
});
