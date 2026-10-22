// @ts-nocheck
// FASE 17 — Testes de rota: campanhas + importação CSV (§16).
//
// Mocks: auth, repositórios (fila/repositório de contatos) e as folhas
// Meta (resolveAccess/whatsappSender). ROdamo DE VERDADE: o executor
// (fila + retry + backoff), o motor (escape, elegibilidade, dedupe) e o
// pipeline CSV (parse, mapeamento sanitizado, duplicados). Sem Meta, sem
// banco, sem envios reais — o "sender" é um mock que devolve o resultado
// que a Meta devolveria (§16).
import { NextRequest } from 'next/server';

jest.mock('@/lib/auth', () => ({
  getAuthenticatedUser: jest.fn(),
}));
jest.mock('@/repositories/campaignRepoReal', () => ({
  campaignRepoReal: {
    create: jest.fn(),
    get: jest.fn(),
    list: jest.fn(),
    recipientCounts: jest.fn(),
    replacePendingRecipients: jest.fn(),
    pendingRecipients: jest.fn(),
    markRecipients: jest.fn(),
    markPendingSkipped: jest.fn(),
    setStatus: jest.fn(),
    pendingCount: jest.fn(),
  },
  mapCounts: jest.fn(),
}));
jest.mock('@/repositories/contactImportRepo', () => ({
  listIdentifiers: jest.fn(),
  listMarketingContacts: jest.fn(),
  bulkCreateContacts: jest.fn(),
}));
jest.mock('@/integrations/meta/resolveAccess', () => ({
  resolveTenantMetaAccess: jest.fn(),
}));
jest.mock('@/integrations/meta/whatsappSender', () => ({
  sendWhatsAppText: jest.fn(),
  sendWhatsAppTemplate: jest.fn(),
  sendWhatsAppButton: jest.fn(),
  runMassSend: jest.fn(),
}));

const { GET: campGET, POST: campPOST } = require('../../app/api/campaigns/route');
const { GET: campIdGET, POST: campIdPOST } = require('../../app/api/campaigns/[id]/route');
const { POST: importPOST } = require('../../app/api/crm/contacts/import/route');

const { getAuthenticatedUser } = require('@/lib/auth');
const { campaignRepoReal } = require('@/repositories/campaignRepoReal');
const {
  listIdentifiers,
  listMarketingContacts,
  bulkCreateContacts,
} = require('@/repositories/contactImportRepo');
const { resolveTenantMetaAccess } = require('@/integrations/meta/resolveAccess');
const { sendWhatsAppText } = require('@/integrations/meta/whatsappSender');

// ── Fixtures / helpers ──────────────────────────────────────────────────────

const USER = { id: 'user-1', email: 'u@x.com', organizationId: 'org-1', role: 'owner' };

function req(url, { method = 'GET', body, headers } = {}) {
  const init = { method, headers };
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
    init.headers = { 'content-type': 'application/json', ...headers };
  }
  return new NextRequest('http://localhost' + url, init);
}

function asUser() {
  getAuthenticatedUser.mockResolvedValue(USER);
}

function asNoUser() {
  getAuthenticatedUser.mockResolvedValue(null);
}

function campaignFixture(over = {}) {
  return {
    id: 'camp-1',
    organizationId: 'org-1',
    userId: 'user-1',
    title: 'Lançamento',
    channel: 'whatsapp',
    status: 'draft',
    message: 'Olá {{nome}}, sua oferta: {{oferta}}',
    resultKind: 'auto',
    accountId: null,
    variables: { oferta: 'X<Y>' },
    audienceJson: { tags: ['vip'], source: null },
    batchJson: { maxPerRun: 5, delayMs: 50, maxAttempts: 1 },
    scheduledFor: null,
    startedAt: null,
    completedAt: null,
    errorText: null,
    manualNotes: null,
    totalCount: 0,
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
    progress: 0,
    ...over,
  };
}

// Contatos da org: ambos consentem marketing e têm a tag 'vip' (JSON string,
// como vem do banco). ct-2 veio de outra origem (testa o filtro de tags).
const CONTACTS = [
  {
    id: 'ct-1', name: 'Maria', firstName: null, lastName: null,
    email: 'm@x.com', phone: '+5511911112222', company: 'ACME', source: 'csv',
    tags: '["vip"]', customFields: {}, consentMarketing: true, consentSource: 'form', optOut: false,
  },
  {
    id: 'ct-2', name: 'João', firstName: null, lastName: null,
    email: 'j@x.com', phone: '+5521933334444', company: 'ACME', source: 'loja',
    tags: '["vip"]', customFields: {}, consentMarketing: true, consentSource: 'form', optOut: false,
  },
];

function pendingRows() {
  return [
    { contactId: 'ct-1', contact: { ...CONTACTS[0] } },
    { contactId: 'ct-2', contact: { ...CONTACTS[1] } },
  ];
}

function connectedAccess() {
  resolveTenantMetaAccess.mockResolvedValue({
    ok: true,
    access: { accessToken: 'TOK', phoneNumberId: 'PNH-1', wabaId: 'W' },
    row: { id: 'ACC-1', provider: 'whatsapp', phone_number_id: 'PNH-1' },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  listIdentifiers.mockResolvedValue({ emails: new Set(), phones: new Set() });
  listMarketingContacts.mockResolvedValue([]);
  campaignRepoReal.recipientCounts.mockResolvedValue({ total: 0, sent: 0, failed: 0, skipped: 0 });
  campaignRepoReal.pendingCount.mockResolvedValue(0);
  campaignRepoReal.markRecipients.mockResolvedValue({ updated: 0 });
  campaignRepoReal.markPendingSkipped.mockResolvedValue(0);
  campaignRepoReal.setStatus.mockResolvedValue({});
  campaignRepoReal.replacePendingRecipients.mockResolvedValue({ planned: 0 });
});

// ── GET /api/campaigns ───────────────────────────────────────────────────────

describe('GET /api/campaigns', () => {
  it('401 sem sessão', async () => {
    asNoUser();
    expect((await campGET(req('/api/campaigns'))).status).toBe(401);
  });

  it('lista campanhas com contagens REAIS por campanha', async () => {
    asUser();
    const fixture = campaignFixture();
    campaignRepoReal.list.mockResolvedValue([fixture]);
    campaignRepoReal.recipientCounts.mockResolvedValue({ total: 3, sent: 2, failed: 1, skipped: 0 });
    const res = await campGET(req('/api/campaigns'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.organizationId).toBe('org-1');
    expect(json.items).toHaveLength(1);
    expect(json.items[0].id).toBe('camp-1');
    expect(json.items[0].counts).toEqual({ total: 3, sent: 2, failed: 1, skipped: 0 });
    expect(campaignRepoReal.list).toHaveBeenCalledWith('org-1');
    expect(campaignRepoReal.recipientCounts).toHaveBeenCalledWith('org-1', 'camp-1');
  });
});

// ── POST /api/campaigns ──────────────────────────────────────────────────────

describe('POST /api/campaigns', () => {
  const base = { channel: 'whatsapp', message: 'oi' };

  it('401 sem sessão', async () => {
    asNoUser();
    expect((await campPOST(req('/api/campaigns', { method: 'POST', body: base }))).status).toBe(401);
  });

  it('JSON inválido → 400 invalid_json', async () => {
    asUser();
    const res = await campPOST(req('/api/campaigns', { method: 'POST', body: 'oops' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_json');
  });

  it('validação: títulos/canal/mensagem', async () => {
    asUser();
    let res = await campPOST(req('/api/campaigns', { method: 'POST', body: base }));
    expect((await res.json()).error).toBe('invalid_title');
    res = await campPOST(req('/api/campaigns', { method: 'POST', body: { ...base, title: 'T', channel: 'sms' } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_channel');
    res = await campPOST(req('/api/campaigns', { method: 'POST', body: { title: 'T', channel: 'whatsapp' } }));
    expect((await res.json()).error).toBe('invalid_message');
  });

  it('validação: resultKind / scheduledFor', async () => {
    asUser();
    let res = await campPOST(req('/api/campaigns', { method: 'POST', body: { ...base, title: 'T', resultKind: 'x' } }));
    expect((await res.json()).error).toBe('invalid_result_kind');
    res = await campPOST(req('/api/campaigns', { method: 'POST', body: { ...base, title: 'T', scheduledFor: 'abc' } }));
    expect((await res.json()).error).toBe('invalid_scheduled_for');
  });

  it('validação: variáveis (tipo, tam. chave/valor, limite de chaves)', async () => {
    asUser();
    const post = (variables) =>
      campPOST(req('/api/campaigns', { method: 'POST', body: { ...base, title: 'T', variables } }));
    let res = await post(['a']);
    expect((await res.json()).error).toBe('invalid_variables');
    res = await post({ a: { nested: true } });
    expect((await res.json()).error).toBe('invalid_variable_value');
    res = await post({ oferta: 'x'.repeat(4001) });
    expect((await res.json()).error).toBe('variable_too_long');
    res = await post({ ['k'.repeat(65)]: 'v' });
    expect((await res.json()).error).toBe('variable_key_too_long');
    const many = {};
    for (let i = 0; i < 65; i++) many['k' + i] = 'v';
    res = await post(many);
    expect((await res.json()).error).toBe('too_many_variables');
  });

  it('validação: audiência (tags/source)', async () => {
    asUser();
    const post = (audience) =>
      campPOST(req('/api/campaigns', { method: 'POST', body: { ...base, title: 'T', audience } }));
    let res = await post('x');
    expect((await res.json()).error).toBe('invalid_audience');
    res = await post({ tags: ['x'.repeat(61)] });
    expect((await res.json()).error).toBe('invalid_audience_tags');
    res = await post({ tags: ['a', 'b'], source: 's'.repeat(121) });
    expect((await res.json()).error).toBe('invalid_audience_source');
  });

  it('validação: batch (tipos, faixas, allow-list) e accountId', async () => {
    asUser();
    const post = (batch) =>
      campPOST(req('/api/campaigns', { method: 'POST', body: { ...base, title: 'T', batch } }));
    let res = await post('x');
    expect((await res.json()).error).toBe('invalid_batch');
    res = await post({ maxPerRun: 0 });
    expect((await res.json()).error).toBe('invalid_batch_maxPerRun');
    res = await post({ delayMs: 100 });
    expect((await res.json()).error).toBe('invalid_batch_delayMs');
    res = await post({ maxAttempts: 0 });
    expect((await res.json()).error).toBe('invalid_batch_maxAttempts');
    res = await post({ backoffFactor: 0 });
    expect((await res.json()).error).toBe('invalid_batch_backoffFactor');
    res = await campPOST(req('/api/campaigns', { method: 'POST', body: { ...base, title: 'T', accountId: 'x'.repeat(65) } }));
    expect((await res.json()).error).toBe('invalid_account_id');
  });

  it('cria em 201; descarta organizationId/userId do body (mass-assignment, multi-tenant)', async () => {
    asUser();
    const fixture = campaignFixture();
    campaignRepoReal.create.mockResolvedValue(fixture);
    const res = await campPOST(req('/api/campaigns', {
      method: 'POST',
      body: {
        organizationId: 'evil-org',
        userId: 'evil-user',
        title: 'T',
        channel: 'whatsapp',
        message: 'oi {{nome}}',
        batch: { maxPerRun: 5, delayMs: 500, maxAttempts: 2, backoffFactor: 2, unknown: 1 },
      },
    }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.campaign).toEqual(fixture);
    expect(campaignRepoReal.create).toHaveBeenCalledTimes(1);
    const [org, input] = campaignRepoReal.create.mock.calls[0];
    expect(org).toBe('org-1'); // org SEMPRE server-derived
    expect(input.userId).toBe('user-1'); // nunca o userId do body
    expect(input.title).toBe('T');
    expect(input.message).toBe('oi {{nome}}');
    expect(input).not.toHaveProperty('organizationId');
    expect(input.batch).not.toHaveProperty('unknown'); // allow-list
  });

  it('canal manual força resultKind=manual', async () => {
    asUser();
    campaignRepoReal.create.mockResolvedValue(campaignFixture({ channel: 'manual' }));
    const res = await campPOST(req('/api/campaigns', {
      method: 'POST',
      body: { title: 'T', channel: 'manual', message: 'oi' },
    }));
    expect(res.status).toBe(201);
    expect(campaignRepoReal.create.mock.calls[0][1].resultKind).toBe('manual');
  });
});

// ── GET /api/campaigns/[id] ──────────────────────────────────────────────────

describe('GET /api/campaigns/[id]', () => {
  it('401 sem sessão', async () => {
    asNoUser();
    expect((await campIdGET(req('/api/campaigns/camp-1'), { params: { id: 'camp-1' } })).status).toBe(401);
  });

  it('404 para campanha que não é da org do usuário (isolamento)', async () => {
    asUser();
    campaignRepoReal.get.mockResolvedValue(null);
    const res = await campIdGET(req('/api/campaigns/camp-1'), { params: { id: 'camp-1' } });
    expect(res.status).toBe(404);
    // O repositório lê SEMPRE com a org do usuário (nada vém do path/body).
    expect(campaignRepoReal.get).toHaveBeenCalledWith('org-1', 'camp-1');
  });

  it('200 com detalhe + contagens reais', async () => {
    asUser();
    const fixture = campaignFixture();
    campaignRepoReal.get.mockResolvedValue(fixture);
    campaignRepoReal.recipientCounts.mockResolvedValue({ total: 2, sent: 1, failed: 1, skipped: 0 });
    const res = await campIdGET(req('/api/campaigns/camp-1'), { params: { id: 'camp-1' } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.campaign).toEqual(fixture);
    expect(json.counts).toEqual({ total: 2, sent: 1, failed: 1, skipped: 0 });
  });
});

// ── POST /api/campaigns/[id] — ações ────────────────────────────────────────

describe('POST /api/campaigns/[id] (ações)', () => {
  const ctx = { params: { id: 'camp-1' } };
  const post = (body) => campIdPOST(req('/api/campaigns/camp-1', { method: 'POST', body }), ctx);

  it('401 sem sessão', async () => {
    asNoUser();
    expect((await post({ action: 'pause' })).status).toBe(401);
  });

  it('ação desconhecida → 400', async () => {
    asUser();
    campaignRepoReal.get.mockResolvedValue(campaignFixture());
    const res = await post({ action: 'fly' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('unknown_action');
  });

  it('404 se a campanha não é da org', async () => {
    asUser();
    campaignRepoReal.get.mockResolvedValue(null);
    expect((await post({ action: 'pause' })).status).toBe(404);
  });

  it('pause de draft é estado inválido → 409', async () => {
    asUser();
    campaignRepoReal.get.mockResolvedValue(campaignFixture());
    const res = await post({ action: 'pause' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'invalid_state', from: 'draft', to: 'paused' });
  });

  it('pause de running → 200 e persiste "paused"', async () => {
    asUser();
    campaignRepoReal.get.mockResolvedValue(campaignFixture({ status: 'running' }));
    const res = await post({ action: 'pause' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, status: 'paused' });
    expect(campaignRepoReal.setStatus).toHaveBeenCalledWith('org-1', 'camp-1', 'paused', {});
  });

  it('cancel de queued → marca pendentes como pulados e soma skippedCount', async () => {
    asUser();
    campaignRepoReal.get.mockResolvedValue(campaignFixture({ status: 'queued', skippedCount: 1 }));
    campaignRepoReal.markPendingSkipped.mockResolvedValue(4);
    const res = await post({ action: 'cancel' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, status: 'canceled', skipped: 4 });
    expect(campaignRepoReal.markPendingSkipped).toHaveBeenCalledWith('org-1', 'camp-1');
    expect(campaignRepoReal.setStatus).toHaveBeenCalledWith(
      'org-1',
      'camp-1',
      'canceled',
      expect.objectContaining({ skippedCount: 5, completedAt: expect.any(Date) }),
    );
  });

  it('cancel de completed (terminal) → 409', async () => {
    asUser();
    campaignRepoReal.get.mockResolvedValue(campaignFixture({ status: 'completed' }));
    const res = await post({ action: 'cancel' });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('invalid_state');
  });

  it('mark_manual_complete exige campanha manual → 400 em auto', async () => {
    asUser();
    campaignRepoReal.get.mockResolvedValue(campaignFixture({ resultKind: 'auto' }));
    const res = await post({ action: 'mark_manual_complete' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('not_manual_campaign');
  });

  it('mark_manual_complete (manual, awaiting_validation) → completed com nota §12', async () => {
    asUser();
    campaignRepoReal.get.mockResolvedValue(
      campaignFixture({ channel: 'manual', resultKind: 'manual', status: 'awaiting_validation' }),
    );
    const res = await post({ action: 'mark_manual_complete' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('completed');
    expect(json.note).toContain('plataforma NÃO enviou');
    expect(campaignRepoReal.setStatus).toHaveBeenCalledWith(
      'org-1',
      'camp-1',
      'completed',
      expect.objectContaining({ completedAt: expect.any(Date), manualNotes: json.note }),
    );
  });

  it('mark_manual_complete já terminal → 409', async () => {
    asUser();
    campaignRepoReal.get.mockResolvedValue(
      campaignFixture({ channel: 'manual', resultKind: 'manual', status: 'completed' }),
    );
    expect((await post({ action: 'mark_manual_complete' })).status).toBe(409);
  });

  it('preview: amostras interpoladas e ESCAPADAS, ZERO envios (§16)', async () => {
    asUser();
    campaignRepoReal.get.mockResolvedValue(campaignFixture());
    campaignRepoReal.pendingRecipients.mockResolvedValue([]); // fila ainda vazia
    listMarketingContacts.mockResolvedValue(CONTACTS);
    const res = await post({ action: 'preview' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.samples).toHaveLength(2);
    expect(json.samples[0].contactId).toBe('ct-1');
    expect(json.samples[0].text).toBe('Olá Maria, sua oferta: X&lt;Y&gt;'); // escape do §9
    expect(json.samples[1].text).toBe('Olá João, sua oferta: X&lt;Y&gt;');
    expect(json.note).toContain('nenhuma mensagem foi enviada');
    expect(sendWhatsAppText).not.toHaveBeenCalled();
    expect(campaignRepoReal.markRecipients).not.toHaveBeenCalled();
  });

  it('start de estado terminal → 409 com dica', async () => {
    asUser();
    campaignRepoReal.get.mockResolvedValue(campaignFixture({ status: 'completed' }));
    const res = await post({ action: 'start', accountId: 'ACC-1' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'invalid_state', from: 'completed', hint: 'terminal' });
  });

  it('start whatsapp sem conta → 409 account_selection_required (§11: nunca default silencioso)', async () => {
    asUser();
    campaignRepoReal.get.mockResolvedValue(campaignFixture());
    const res = await post({ action: 'start' });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe('account_selection_required');
    expect(json.hint).toContain('Selecione a conta');
  });

  it('accountId grande demais → 400', async () => {
    asUser();
    campaignRepoReal.get.mockResolvedValue(campaignFixture());
    const res = await post({ action: 'start', accountId: 'x'.repeat(65) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_account_id');
  });

  it('conta indisponível no tenant → 409 account_unavailable com motivo', async () => {
    asUser();
    campaignRepoReal.get.mockResolvedValue(campaignFixture());
    resolveTenantMetaAccess.mockResolvedValue({ ok: false, reason: 'no_token' });
    const res = await post({ action: 'start', accountId: 'ACC-1' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'account_unavailable', reason: 'no_token', accountId: 'ACC-1' });
    expect(campaignRepoReal.setStatus).not.toHaveBeenCalled();
  });

  it('canal email → 409 honesto (envio não implementado, §18)', async () => {
    asUser();
    campaignRepoReal.get.mockResolvedValue(campaignFixture({ channel: 'email', resultKind: 'auto' }));
    const res = await post({ action: 'start', accountId: 'ACC-1' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'channel_not_available_yet', channel: 'email' });
  });

  it('start manual → "aguardando validação" (§12: a RX não envia)', async () => {
    asUser();
    campaignRepoReal.get.mockResolvedValue(
      campaignFixture({ channel: 'manual', resultKind: 'manual', status: 'draft' }),
    );
    const res = await post({ action: 'start' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('awaiting_validation');
    expect(json.note).toContain('ação manual');
    expect(campaignRepoReal.setStatus).toHaveBeenCalledWith('org-1', 'camp-1', 'awaiting_validation', {});
  });
});

// ── start/resume — execução REAL do lote sobre repo mockado (fake timers) ──

describe('POST /api/campaigns/[id] start — lote real (fake timers, sem Meta)', () => {
  const ctx = { params: { id: 'camp-1' } };

  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('happy: replaneja a fila, envia 2/2, conclui com métricas REAIS', async () => {
    asUser();
    campaignRepoReal.get.mockResolvedValue(campaignFixture());
    connectedAccess();
    listMarketingContacts.mockResolvedValue(CONTACTS);
    campaignRepoReal.replacePendingRecipients.mockResolvedValue({ planned: 2 });
    campaignRepoReal.pendingRecipients.mockResolvedValue(pendingRows());
    campaignRepoReal.pendingCount.mockResolvedValue(0);
    let sendN = 0;
    sendWhatsAppText.mockImplementation(async () => {
      sendN++;
      return { ok: true, messageId: 'wamid.' + sendN };
    });

    const p = campIdPOST(
      req('/api/campaigns/camp-1', { method: 'POST', body: { action: 'start', accountId: 'ACC-1' } }),
      ctx,
    );
    await jest.advanceTimersByTimeAsync(2000);
    const res = await p;

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('completed');
    expect(json.batch).toEqual({ sent: 2, failed: 0, remaining: 0 });
    expect(json.planned).toBe(2);
    expect(json.skipped).toBe(0);
    expect(json.account).toEqual({ accountId: 'ACC-1', phoneNumberId: 'PNH-1' }); // número honesto (§11)

    // A conta vem da seleção EXPLÍCITA, sempre validada contra o tenant.
    expect(resolveTenantMetaAccess).toHaveBeenCalledWith('org-1', {}, 'ACC-1');

    // Fila replanejada a partir da audiência atual (tag 'vip').
    expect(campaignRepoReal.replacePendingRecipients).toHaveBeenCalledWith('org-1', 'camp-1', ['ct-1', 'ct-2']);

    // Envios REAIS pelo sender (mock), com texto interpolado + ESCAPADO.
    expect(sendWhatsAppText).toHaveBeenCalledTimes(2);
    const [acc0, to0, text0] = sendWhatsAppText.mock.calls[0];
    expect(acc0).toEqual({ accessToken: 'TOK', phoneNumberId: 'PNH-1', wabaId: 'W' });
    expect(to0).toBe('+5511911112222');
    expect(text0).toBe('Olá Maria, sua oferta: X&lt;Y&gt;');
    expect(sendWhatsAppText.mock.calls[1][2]).toBe('Olá João, sua oferta: X&lt;Y&gt;');

    // Máquina de estados: queued → running → completed (contagens reais).
    const statuses = campaignRepoReal.setStatus.mock.calls.map((c) => c[2]);
    expect(statuses).toEqual(['queued', 'running', 'completed']);
    const [runOrg, runId, , runPatch] = campaignRepoReal.setStatus.mock.calls[1];
    expect([runOrg, runId]).toEqual(['org-1', 'camp-1']);
    expect(runPatch).toEqual({
      sentCount: 2,
      failedCount: 0,
      totalCount: 2,
      progress: 100,
      startedAt: expect.any(Date),
    });

    // Resultado POR DESTINATÁRIO persistido (idempotente, §10).
    expect(campaignRepoReal.markRecipients).toHaveBeenCalledWith('org-1', 'camp-1', [
      { contactId: 'ct-1', status: 'sent', attempts: 1, externalMessageId: 'wamid.1', lastError: null },
      { contactId: 'ct-2', status: 'sent', attempts: 1, externalMessageId: 'wamid.2', lastError: null },
    ]);
  });

  it('falha com retry: retry + backoff, completed_partial e lastError honesta', async () => {
    asUser();
    campaignRepoReal.get.mockResolvedValue(
      campaignFixture({ batchJson: { maxPerRun: 5, delayMs: 10, maxAttempts: 2 } }),
    );
    connectedAccess();
    listMarketingContacts.mockResolvedValue(CONTACTS);
    campaignRepoReal.replacePendingRecipients.mockResolvedValue({ planned: 2 });
    campaignRepoReal.pendingRecipients.mockResolvedValue(pendingRows());
    campaignRepoReal.pendingCount.mockResolvedValue(0);
    // ct-1 (Maria, +5511911112222) falha nas 2 tentativas; ct-2 ok na 1ª.
    sendWhatsAppText.mockImplementation(async (_access, to) => {
      if (to === '+5511911112222') {
        return { ok: false, error: 'http_error', errorDetail: '429 rate limit' };
      }
      return { ok: true, messageId: 'wamid.ok' };
    });

    const p = campIdPOST(
      req('/api/campaigns/camp-1', { method: 'POST', body: { action: 'start', accountId: 'ACC-1' } }),
      ctx,
    );
    await jest.advanceTimersByTimeAsync(2000);
    const res = await p;

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('completed_partial');
    expect(json.batch).toEqual({ sent: 1, failed: 1, remaining: 0 });
    expect(sendWhatsAppText).toHaveBeenCalledTimes(3); // 2 tentativas p/ ct-1 + 1 p/ ct-2
    const statuses = campaignRepoReal.setStatus.mock.calls.map((c) => c[2]);
    expect(statuses).toEqual(['queued', 'running', 'completed_partial']);
    expect(campaignRepoReal.markRecipients).toHaveBeenCalledWith('org-1', 'camp-1', [
      {
        contactId: 'ct-1',
        status: 'failed',
        attempts: 2,
        externalMessageId: null,
        lastError: 'http_error: 429 rate limit',
      },
      { contactId: 'ct-2', status: 'sent', attempts: 1, externalMessageId: 'wamid.ok', lastError: null },
    ]);
  });
});

// ── POST /api/crm/contacts/import ───────────────────────────────────────────

describe('POST /api/crm/contacts/import (CSV, §8)', () => {
  const CSV = 'nome,email\nMaria,m@x.com\n';
  const MAP = { nome: 'name', email: 'email' };

  it('401 sem sessão', async () => {
    asNoUser();
    expect((await importPOST(req('/api/crm/contacts/import', { method: 'POST', body: { csv: CSV, mapping: MAP } }))).status).toBe(401);
  });

  it('JSON inválido → 400', async () => {
    asUser();
    const res = await importPOST(req('/api/crm/contacts/import', { method: 'POST', body: 'oops' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_json');
  });

  it('sem CSV (ou >5MB) → 400 csv_required', async () => {
    asUser();
    expect((await importPOST(req('/api/crm/contacts/import', { method: 'POST', body: {} }))).status).toBe(400);
    const big = await importPOST(
      req('/api/crm/contacts/import', { method: 'POST', body: { csv: 'a'.repeat(5_000_001), mapping: MAP } }),
    );
    expect(big.status).toBe(400);
    expect((await big.json()).error).toBe('csv_required');
  });

  it('etapa 1 (sem mapping): sugere + prévia, NADA escrito, sem duplicados', async () => {
    asUser();
    const res = await importPOST(req('/api/crm/contacts/import', { method: 'POST', body: { csv: CSV } }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.needsMapping).toBe(true);
    expect(json.delimiter).toBe(',');
    expect(json.headers).toEqual(['nome', 'email']);
    expect(json.suggestedMapping).toEqual({ nome: 'name', email: 'email' });
    expect(json.preview).toHaveLength(1);
    // Etapa 1 não toca a base (nem duplicados, nem escrita).
    expect(listIdentifiers).not.toHaveBeenCalled();
    expect(bulkCreateContacts).not.toHaveBeenCalled();
  });

  it('dryRun: processa tudo e devolve resumo + relatório, SEM gravar', async () => {
    asUser();
    const res = await importPOST(
      req('/api/crm/contacts/import', { method: 'POST', body: { csv: CSV, mapping: MAP, dryRun: true } }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.summary).toEqual({ total: 1, valid: 1, duplicates: 0, invalid: 0, skipped: 0, truncated: false });
    expect(json.rows).toHaveLength(1);
    expect(json.rows[0].record.email).toBe('m@x.com');
    expect(json.errorReport).toContain('line,status,reasons');
    expect(listIdentifiers).toHaveBeenCalledWith('org-1');
    expect(bulkCreateContacts).not.toHaveBeenCalled(); // dryRun nunca grava
  });

  it('commit: grava SOMENTE linhas válidas; consentimento fail-closed', async () => {
    asUser();
    bulkCreateContacts.mockResolvedValue({ inserted: 1 });
    const res = await importPOST(
      req('/api/crm/contacts/import', { method: 'POST', body: { csv: CSV, mapping: MAP } }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.inserted).toBe(1);
    expect(json.summary.valid).toBe(1);
    expect(bulkCreateContacts).toHaveBeenCalledTimes(1);
    const [org, records] = bulkCreateContacts.mock.calls[0];
    expect(org).toBe('org-1');
    expect(records).toHaveLength(1);
    const rec = records[0];
    expect(rec.name).toBe('Maria');
    expect(rec.email).toBe('m@x.com');
    expect(rec.consentMarketing).toBe(false); // sem coluna de consentimento → FALSO (fail-closed, §11)
    expect(rec.source).toBe('csv-import');
    expect(rec.tags).toEqual([]);
  });

  it('multi-tenant: organizationId do body é IGNORADO (tenant server-derived)', async () => {
    asUser();
    bulkCreateContacts.mockResolvedValue({ inserted: 1 });
    const res = await importPOST(
      req('/api/crm/contacts/import', {
        method: 'POST',
        body: { csv: CSV, mapping: MAP, organizationId: 'other-org', userId: 'someone-else' },
      }),
    );
    expect(res.status).toBe(200);
    expect(bulkCreateContacts.mock.calls[0][0]).toBe('org-1'); // nunca 'other-org'
  });

  it('mapeamento protegido (role/org) é sanitizado: nunca vira campo gravado', async () => {
    asUser();
    bulkCreateContacts.mockResolvedValue({ inserted: 0 });
    const res = await importPOST(
      req('/api/crm/contacts/import', {
        method: 'POST',
        body: { csv: CSV, mapping: { nome: 'role', email: 'organizationId' } },
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.inserted).toBe(0);
    // As duas colunas caíram em 'custom' → a linha não tem identificador
    // (nem email/telefone/name mapeados) → invalida; NADA é gravado.
    expect(bulkCreateContacts.mock.calls[0][1]).toEqual([]);
    expect(json.summary.invalid).toBe(1);
  });

  it('aceita multipart (file + mapping + dryRun) e devolve dryRun', async () => {
    asUser();
    const form = new FormData();
    form.append('file', new Blob([CSV], { type: 'text/csv' }));
    form.append('mapping', JSON.stringify(MAP));
    form.append('dryRun', 'true');
    const r = new NextRequest('http://localhost/api/crm/contacts/import', { method: 'POST', body: form });
    const res = await importPOST(r);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.summary.valid).toBe(1);
    expect(json.rows[0].record.name).toBe('Maria');
    expect(bulkCreateContacts).not.toHaveBeenCalled();
  });
});
