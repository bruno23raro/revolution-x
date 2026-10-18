// src/tests/admin-routes.test.ts  (G1 — FASE C)
// Teste de autorização negativa + comportamento das 4 rotas /api/admin.
//
// A REAL taskQueue roda aqui: mockamos apenas as fronteiras
// (@/lib/prisma → client fake, @/lib/auth, e o omniRouter). Assim a
// máquina de estados (transições, progresso real, upsert de memória) é
// exercitada de verdade em cada chamada.
// @ts-nocheck  -- wiring de mocks dinâmicos; coerente com auth-security.test.ts
import { NextRequest } from 'next/server';

// ── omniRouter (rota do chat importa via relative path; sem alias @/ai) ──────
jest.mock('../../src/ai/omniRouter', () => ({
  resolveOmniRouterConfig: jest.fn(),
  chatCompletion: jest.fn(),
}));

// ── auth ──────────────────────────────────────────────────────────────────────
jest.mock('@/lib/auth', () => ({
  getAuthenticatedUser: jest.fn(),
  getAllOrganizationMemberships: jest.fn(),
}));

// ── prisma: client fake + pass-throughs de contexto de tenant ────────────────
jest.mock('@/lib/prisma', () => {
  const prisma = {
    task: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    taskStep: {
      createMany: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    taskEvent: {
      create: jest.fn(),
    },
    agentMemory: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $executeRaw: jest.fn().mockResolvedValue(0),
  };
  return {
    prisma,
    // com withTenantContextOn(client, org, cb) a taskQueue roda cb(client):
    withTenantContextOn: jest.fn(async (client: unknown, _org: string, cb: (tx: unknown) => Promise<unknown>) => cb(client)),
    withTenantContext: jest.fn(async (_org: string, cb: (tx: unknown) => Promise<unknown>) => cb(prisma)),
  };
});

const { getAuthenticatedUser, getAllOrganizationMemberships } = require('@/lib/auth');
const { prisma } = require('@/lib/prisma');
const { resolveOmniRouterConfig, chatCompletion } = require('../../src/ai/omniRouter');

const { GET: tasksGET } = require('../../app/api/admin/tasks/route');
const { GET: taskByIdGET, POST: taskByIdPOST } = require('../../app/api/admin/tasks/[id]/route');
const { GET: memoryGET, POST: memoryPOST } = require('../../app/api/admin/memory/route');
const { GET: chatGET, POST: chatPOST } = require('../../app/api/admin/chat/route');
const { GET: aiConfigGET, POST: aiConfigPOST, DELETE: aiConfigDELETE } = require('../../app/api/admin/ai-config/route');

// ── fixtures de usuário ───────────────────────────────────────────────────────
const ADMIN = { id: 'user-admin', role: 'admin', organizationId: 'org-admin', email: 'admin@x.com' };
const MEMBER = { id: 'user-member', role: 'member', organizationId: 'org-a', email: 'member@x.com' };

function asUser(user: unknown) {
  (getAuthenticatedUser as jest.Mock).mockResolvedValue(user);
}
function asMemberWith(memberships: Array<{ role: string; organizationId?: string }>) {
  (getAllOrganizationMemberships as jest.Mock).mockResolvedValue(memberships);
}
function asNoAdmin() {
  asUser(ADMIN);
}
function asUnauthorized() {
  asUser(null);
}
function asPlainMember() {
  asUser(MEMBER);
  asMemberWith([{ role: 'member', organizationId: 'org-a' }]);
}

function adminReq(url: string, { method = 'GET', body }: { method?: string; body?: unknown } = {}) {
  const init: Record<string, unknown> = { method };
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
    init.headers = { 'content-type': 'application/json' };
  }
  return new NextRequest('http://localhost' + url, init);
}

function p2021() {
  return Object.assign(new Error('P2021: Table not found'), { code: 'P2021' });
}

// Sonda a stream de SSE para uma lista de eventos JSON.
async function readSse(res: Response): Promise<Array<Record<string, unknown>>> {
  const text = await res.text();
  return text
    .split('\n\n')
    .map((line) => {
      const m = line.match(/^data: (.*)$/);
      return m ? JSON.parse(m[1]) : null;
    })
    .filter((e) => e !== null);
}

beforeEach(() => {
  jest.clearAllMocks();
  // delegates "inocentes" por padrão; cada teste reprograma o que precisa.
  prisma.task.update = jest.fn().mockResolvedValue({});
  prisma.task.create = jest.fn().mockResolvedValue({ id: 'task-1', title: 't' });
  prisma.taskStep.createMany = jest.fn().mockResolvedValue({ count: 3 });
  prisma.taskStep.update = jest.fn().mockResolvedValue({ count: 1 });
  prisma.taskStep.updateMany = jest.fn().mockResolvedValue({ count: 0 });
  prisma.taskEvent.create = jest.fn().mockResolvedValue({});
  prisma.agentMemory.upsert = jest.fn().mockResolvedValue({});
  prisma.agentMemory.findMany = jest.fn().mockResolvedValue([]);
});

// ============================================================================
// GATE requireAdmin (compartilhado pelas 4 rotas)
// ============================================================================
describe('gate requireAdmin', () => {
  it('401 sem usuário autenticado', async () => {
    asUnauthorized();
    const res = await tasksGET(adminReq('/api/admin/tasks'));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('Unauthorized');
  });

  it('401 para member sem papéis admin/owner', async () => {
    asPlainMember();
    const res = await tasksGET(adminReq('/api/admin/tasks'));
    expect(res.status).toBe(401);
  });

  it('autoriza member com membership de owner (cross-tenant)', async () => {
    asUser({ ...MEMBER, role: 'member' });
    asMemberWith([{ role: 'owner', organizationId: 'org-b' }]);
    prisma.task.findMany = jest.fn().mockResolvedValue([]);
    const res = await tasksGET(adminReq('/api/admin/tasks'));
    expect(res.status).toBe(200);
    // escopo = user.organizationId (org-a), não o da membership de owner
    const json = await res.json();
    expect(json.organizationId).toBe('org-a');
    // findMany filtra por organizationId do escopo do usuário
    const arg = prisma.task.findMany.mock.calls[0][0];
    expect(arg.where.organizationId).toBe('org-a');
  });
});

// ============================================================================
// GET /api/admin/tasks
// ============================================================================
describe('GET /api/admin/tasks', () => {
  it('200 lista do tenant (admin), clamp de limit', async () => {
    asNoAdmin();
    const rows = [
      { id: 't1', title: 'A', status: 'running', progress: 50, modelUsed: 'claude-x', errorText: null, createdAt: new Date(), completedAt: null },
      { id: 't2', title: 'B', status: 'completed', progress: 100, modelUsed: 'claude-x', errorText: null, createdAt: new Date(), completedAt: new Date() },
    ];
    prisma.task.findMany = jest.fn().mockResolvedValue(rows);
    const res = await tasksGET(adminReq('/api/admin/tasks?limit=5'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.count).toBe(2);
    expect(json.items).toHaveLength(2);
    expect(json.organizationId).toBe('org-admin');
    // limit é clampado: Math.min(Number('5')||50, 200) = 5 → take:5
    const arg = prisma.task.findMany.mock.calls[0][0];
    expect(arg.take).toBe(5);
    expect(arg.where.organizationId).toBe('org-admin');
    // sem status → where.status undefined
    expect(arg.where.status).toBeUndefined();
  });

  it('503 quando a fila não está migrada (P2021)', async () => {
    asNoAdmin();
    prisma.task.findMany = jest.fn().mockRejectedValue(p2021());
    const res = await tasksGET(adminReq('/api/admin/tasks'));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.queueAvailable).toBe(false);
    expect(json.items).toEqual([]);
    expect(json.detail).toContain('fila de tarefas indisponível');
  });
});

// ============================================================================
// GET /api/admin/tasks/[id]
// ============================================================================
describe('GET /api/admin/tasks/[id]', () => {
  const fullTask = {
    id: 'task-1',
    title: 'T',
    status: 'completed',
    progress: 100,
    modelUsed: 'claude-x',
    errorText: null,
    createdAt: new Date(),
    completedAt: new Date(),
    inputJson: {},
    resultJson: { textLength: 3 },
    usageJson: { inputTokens: 1, outputTokens: 2 },
    waitingReason: null,
    steps: [{ seq: 0, name: 'a', status: 'done', startedAt: null, finishedAt: new Date() }],
    events: [{ type: 'created', payloadJson: {}, createdAt: new Date() }],
  };

  it('401 sem admin', async () => {
    asUnauthorized();
    const res = await taskByIdGET(adminReq('/api/admin/tasks/task-1'), { params: { id: 'task-1' } });
    expect(res.status).toBe(401);
  });

  it('200 retorna o detalhe (steps + eventos)', async () => {
    asNoAdmin();
    prisma.task.findFirst = jest.fn().mockResolvedValue(fullTask);
    const res = await taskByIdGET(adminReq('/api/admin/tasks/task-1'), { params: { id: 'task-1' } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe('task-1');
    expect(json.steps).toHaveLength(1);
    expect(json.events).toHaveLength(1);
    const arg = prisma.task.findFirst.mock.calls[0][0];
    expect(arg.where.id).toBe('task-1');
    expect(arg.where.organizationId).toBe('org-admin');
  });

  it('404 quando a tarefa não existe neste tenant', async () => {
    asNoAdmin();
    prisma.task.findFirst = jest.fn().mockResolvedValue(null);
    const res = await taskByIdGET(adminReq('/api/admin/tasks/nao-existe'), { params: { id: 'nao-existe' } });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Tarefa não encontrada');
  });

  it('503 quando a fila não está migrada', async () => {
    asNoAdmin();
    prisma.task.findFirst = jest.fn().mockRejectedValue(p2021());
    const res = await taskByIdGET(adminReq('/api/admin/tasks/task-1'), { params: { id: 'task-1' } });
    expect(res.status).toBe(503);
  });
});

// ============================================================================
// POST /api/admin/tasks/[id]  — cancel / resume
// ============================================================================
describe('POST /api/admin/tasks/[id]', () => {
  const ctx = { params: { id: 'task-1' } };

  it('401 sem admin', async () => {
    asUnauthorized();
    const res = await taskByIdPOST(adminReq('/api/admin/tasks/task-1', { method: 'POST', body: { action: 'cancel' } }), ctx);
    expect(res.status).toBe(401);
  });

  it('400 JSON inválido', async () => {
    asNoAdmin();
    const res = await taskByIdPOST(adminReq('/api/admin/tasks/task-1', { method: 'POST', body: 'isso-nao-e-json' }), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('JSON inválido');
  });

  it("400 action inválida (nem 'cancel' nem 'resume')", async () => {
    asNoAdmin();
    const res = await taskByIdPOST(adminReq('/api/admin/tasks/task-1', { method: 'POST', body: { action: 'bogus' } }), ctx);
    expect(res.status).toBe(400);
  });

  it("200 cancel: transição running → canceled + etapas viram 'skipped'", async () => {
    asNoAdmin();
    // cancelTask: findFirst(status) → running (transição ok)
    prisma.task.findFirst = jest.fn().mockResolvedValue({ status: 'running' });
    const res = await taskByIdPOST(adminReq('/api/admin/tasks/task-1', { method: 'POST', body: { action: 'cancel' } }), ctx);
    expect(res.status).toBe(200);
    expect((await res.json())).toEqual({ ok: true, status: 'canceled' });
    // task.update gravou status canceled
    const upd = prisma.task.update.mock.calls.find((c) => c[0].data.status === 'canceled');
    expect(upd).toBeDefined();
    // etapas abertas → skipped
    const upm = prisma.taskStep.updateMany.mock.calls[0][0];
    expect(upm.data.status).toBe('skipped');
  });

  it('409 transição inválida (tarefa em estado terminal)', async () => {
    asNoAdmin();
    prisma.task.findFirst = jest.fn().mockResolvedValue({ status: 'completed' });
    const res = await taskByIdPOST(adminReq('/api/admin/tasks/task-1', { method: 'POST', body: { action: 'cancel' } }), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain('inválida');
  });

  it('409 tarefa não encontrada neste tenant', async () => {
    asNoAdmin();
    prisma.task.findFirst = jest.fn().mockResolvedValue(null);
    const res = await taskByIdPOST(adminReq('/api/admin/tasks/xyz', { method: 'POST', body: { action: 'resume' } }), { params: { id: 'xyz' } });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain('não encontrada');
  });

  it("200 resume: waiting_human → running", async () => {
    asNoAdmin();
    // startTask: findFirst(status) → waiting_human (transição p/ running ok)
    prisma.task.findFirst = jest.fn().mockResolvedValue({ status: 'waiting_human' });
    // startTask procura a próxima etapa pendente; sem pendentes → null (aceito)
    prisma.taskStep.findFirst = jest.fn().mockResolvedValue(null);
    const res = await taskByIdPOST(adminReq('/api/admin/tasks/task-1', { method: 'POST', body: { action: 'resume' } }), ctx);
    expect(res.status).toBe(200);
    expect((await res.json())).toEqual({ ok: true, status: 'running' });
  });

  it('503 quando a fila não está migrada', async () => {
    asNoAdmin();
    prisma.task.findFirst = jest.fn().mockRejectedValue(p2021());
    const res = await taskByIdPOST(adminReq('/api/admin/tasks/task-1', { method: 'POST', body: { action: 'cancel' } }), ctx);
    expect(res.status).toBe(503);
    expect((await res.json()).queueAvailable).toBe(false);
  });
});

// ============================================================================
// GET /api/admin/memory
// ============================================================================
describe('GET /api/admin/memory', () => {
  it('401 sem admin', async () => {
    asUnauthorized();
    const res = await memoryGET(adminReq('/api/admin/memory'));
    expect(res.status).toBe(401);
  });

  it('200 lista memórias ativas e filtra por kind', async () => {
    asNoAdmin();
    prisma.agentMemory.findMany = jest.fn().mockResolvedValue([
      { kind: 'fact', memoryKey: 'f1', valueJson: 'a', updatedAt: new Date() },
      { kind: 'decision', memoryKey: 'd1', valueJson: 'b', updatedAt: new Date() },
    ]);
    const res = await memoryGET(adminReq('/api/admin/memory?kind=fact'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.count).toBe(1);
    expect(json.items[0].key).toBe('f1');
    // listMemory seleciona apenas memórias não-suprimidas
    const arg = prisma.agentMemory.findMany.mock.calls[0][0];
    expect(arg.where.supersededAt).toBeNull();
    expect(arg.take).toBe(50);
  });

  it('503 quando a memória não está migrada', async () => {
    asNoAdmin();
    prisma.agentMemory.findMany = jest.fn().mockRejectedValue(p2021());
    const res = await memoryGET(adminReq('/api/admin/memory'));
    expect(res.status).toBe(503);
    expect((await res.json()).memoryAvailable).toBe(false);
  });
});

// ============================================================================
// POST /api/admin/memory
// ============================================================================
describe('POST /api/admin/memory', () => {
  it('401 sem admin', async () => {
    asUnauthorized();
    const res = await memoryPOST(adminReq('/api/admin/memory', { method: 'POST', body: { kind: 'fact', key: 'k', value: 1 } }));
    expect(res.status).toBe(401);
  });

  it('400 sem key', async () => {
    asNoAdmin();
    const res = await memoryPOST(adminReq('/api/admin/memory', { method: 'POST', body: { kind: 'fact', value: 1 } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('key');
  });

  it('400 kind inválido', async () => {
    asNoAdmin();
    const res = await memoryPOST(adminReq('/api/admin/memory', { method: 'POST', body: { kind: 'xpto', key: 'k', value: 1 } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('kind');
  });

  it('400 value excede 8000 caracteres serializados', async () => {
    asNoAdmin();
    const big = 'a'.repeat(8001);
    const res = await memoryPOST(adminReq('/api/admin/memory', { method: 'POST', body: { kind: 'fact', key: 'k', value: big } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('8000');
  });

  it('201 upsert na chave composta (tenant, user, kind, key)', async () => {
    asNoAdmin();
    const res = await memoryPOST(
      adminReq('/api/admin/memory', { method: 'POST', body: { kind: 'decision', key: 'use-prisma', value: { ok: true } } }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toEqual({ ok: true, key: 'use-prisma', kind: 'decision' });
    const arg = prisma.agentMemory.upsert.mock.calls[0][0];
    expect(arg.where.organizationId_userId_kind_memoryKey).toEqual({
      organizationId: 'org-admin',
      userId: 'user-admin',
      kind: 'decision',
      memoryKey: 'use-prisma',
    });
  });

  it('503 quando a memória não está migrada', async () => {
    asNoAdmin();
    prisma.agentMemory.upsert = jest.fn().mockRejectedValue(p2021());
    const res = await memoryPOST(adminReq('/api/admin/memory', { method: 'POST', body: { kind: 'fact', key: 'k', value: 1 } }));
    expect(res.status).toBe(503);
  });
});

// ============================================================================
// GET /api/admin/chat
// ============================================================================
describe('GET /api/admin/chat', () => {
  it('router não configurado → routerConfigured=false, sem segredos', async () => {
    (resolveOmniRouterConfig as jest.Mock).mockReturnValue(null);
    const res = await chatGET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ routerConfigured: false, model: null, baseUrl: null });
  });

  it('router configurado → expõe apenas model + ORIGIN (sem credenciais)', async () => {
    (resolveOmniRouterConfig as jest.Mock).mockReturnValue({
      model: 'claude-x',
      baseUrl: 'https://router.example.com:8443/v1?apiKey=secreto',
      apiKey: 'secreto',
    });
    const res = await chatGET();
    const json = await res.json();
    expect(json.routerConfigured).toBe(true);
    expect(json.model).toBe('claude-x');
    expect(json.baseUrl).toBe('https://router.example.com:8443'); // origin, sem query/userinfo
  });
});

// ============================================================================
// POST /api/admin/chat  (SSE)
// ============================================================================
describe('POST /api/admin/chat (SSE)', () => {
  // Wiring de prisma para o ciclo de vida completo da fila.
  function wireHappyTaskLifecycle() {
    // task.findFirst: chamada #1 (startTask) → queued; #2 (completeTask) → running
    const taskStatus = ['queued', 'running'];
    let ti = 0;
    prisma.task.findFirst = jest.fn(async () => ({ status: taskStatus[ti++], modelUsed: null }));

    // taskStep.findFirst: lookup por seq (markStep) ou por status 'pending'
    prisma.taskStep.findFirst = jest.fn(async (arg) => {
      const where = arg.where;
      if (where.seq !== undefined) return { id: `step-${where.seq}`, seq: where.seq, status: 'pending', startedAt: null };
      if (where.status === 'pending') return { id: 'step-next', startedAt: null };
      return null;
    });
    // total em markStep = 3; abertas em completeTask = 0
    prisma.taskStep.count = jest.fn(async (arg) => (arg.where.status ? 0 : 3));
    // progresso real por chamada: 33 → 66 → 100
    const statuses = [
      [{ status: 'done' }, { status: 'pending' }, { status: 'pending' }],
      [{ status: 'done' }, { status: 'done' }, { status: 'pending' }],
      [{ status: 'done' }, { status: 'done' }, { status: 'done' }],
    ];
    let si = 0;
    prisma.taskStep.findMany = jest.fn(async () => statuses[si++]);
  }

  it('401 sem admin', async () => {
    asUnauthorized();
    const res = await chatPOST(adminReq('/api/admin/chat', { method: 'POST', body: { message: 'oi' } }));
    expect(res.status).toBe(401);
  });

  it('400 JSON inválido', async () => {
    asNoAdmin();
    const res = await chatPOST(adminReq('/api/admin/chat', { method: 'POST', body: 'oops' }));
    expect(res.status).toBe(400);
  });

  it('400 message ausente/vazio', async () => {
    asNoAdmin();
    const res = await chatPOST(adminReq('/api/admin/chat', { method: 'POST', body: { message: '   ' } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('message é obrigatório');
  });

  it('fluxo happy: start→task→progress(33/66/100)→step→usage→message→done(ok)', async () => {
    asNoAdmin();
    wireHappyTaskLifecycle();
    (resolveOmniRouterConfig as jest.Mock).mockReturnValue({ model: 'claude-x', baseUrl: 'https://r.example.com/v1' });
    (chatCompletion as jest.Mock).mockResolvedValue({
      text: 'olá, chefe',
      model: 'claude-x',
      usage: { inputTokens: 10, outputTokens: 5 },
    });

    const res = await chatPOST(adminReq('/api/admin/chat', { method: 'POST', body: { message: 'olá' } }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');

    const events = await readSse(res);
    const types = events.map((e) => e.type);
    expect(types[0]).toBe('start');
    expect(types[1]).toBe('task');
    expect(types[types.length - 1]).toBe('done');
    expect(events[1]).toMatchObject({ taskId: 'task-1', status: 'running', progress: 0 });
    expect(types).toContain('step');
    expect(types).toContain('usage');
    expect(types).toContain('message');

    // progresso REAL: 33 → 66 → 100
    const pcts = events.filter((e) => e.type === 'progress').map((e) => e.pct);
    expect(pcts).toEqual([33, 66, 100]);

    // done.ok final
    const done = events[events.length - 1];
    expect(done).toMatchObject({ type: 'done', ok: true, taskId: 'task-1' });

    // message carrega o texto e o usage
    const msg = events.find((e) => e.type === 'message');
    expect(msg.text).toBe('olá, chefe');
    expect(msg.usage).toEqual({ inputTokens: 10, outputTokens: 5 });

    // completeTask gravou completed + usageJson
    const completeUpd = prisma.task.update.mock.calls.find((c) => c[0].data.status === 'completed');
    expect(completeUpd).toBeDefined();
    expect(completeUpd[0].data.usageJson).toEqual({ inputTokens: 10, outputTokens: 5 });
  });

  it('router não configurado → resposta informativa com ok:true (chat funciona sem IA)', async () => {
    asNoAdmin();
    // wireHappyTaskLifecycle faz createTask/startTask/markStep/completeTask bem-sucedidos.
    wireHappyTaskLifecycle();
    (resolveOmniRouterConfig as jest.Mock).mockReturnValue(null);
    const res = await chatPOST(adminReq('/api/admin/chat', { method: 'POST', body: { message: 'oi' } }));
    const events = await readSse(res);
    const types = events.map((e) => e.type);
    expect(types[0]).toBe('start');
    expect(types).toContain('message');
    expect(types).toContain('done');
    const msg = events.find((e) => e.type === 'message');
    expect(msg.text).toContain('não está configurado'); // mensagem informativa sobre o router
    expect(msg.routerConfigured).toBe(false);
    expect(events[events.length - 1]).toMatchObject({ type: 'done', ok: true });
  });

  it('fila indisponível → warning queue_unavailable, chat segue e done(ok:true)', async () => {
    asNoAdmin();
    prisma.task.create = jest.fn().mockRejectedValue(p2021());
    (resolveOmniRouterConfig as jest.Mock).mockReturnValue({ model: 'claude-x', baseUrl: 'https://r.example.com/v1' });
    (chatCompletion as jest.Mock).mockResolvedValue({ text: 'resposta', model: 'claude-x', usage: null });

    const res = await chatPOST(adminReq('/api/admin/chat', { method: 'POST', body: { message: 'oi' } }));
    const events = await readSse(res);
    expect(events.find((e) => e.type === 'warning')?.code).toBe('queue_unavailable');
    expect(events.find((e) => e.type === 'message')?.text).toBe('resposta');
    const done = events[events.length - 1];
    expect(done).toMatchObject({ type: 'done', ok: true, taskId: null });
  });

  it('falha na geração → error generation_failed, failTask e done(ok:false)', async () => {
    asNoAdmin();
    // createTask ok, startTask ok (queued→running); depois markStep(1,'failed') e failTask.
    // wireHappyTaskLifecycle já fornece a sequência task.findFirst: #1 startTask→queued,
    // #2 failTask→running (não sobrescrever — clobbera a transição do startTask).
    wireHappyTaskLifecycle();
    (resolveOmniRouterConfig as jest.Mock).mockReturnValue({ model: 'claude-x', baseUrl: 'https://r.example.com/v1' });
    (chatCompletion as jest.Mock).mockRejectedValue(new Error('generation boom'));

    const res = await chatPOST(adminReq('/api/admin/chat', { method: 'POST', body: { message: 'oi' } }));
    const events = await readSse(res);
    expect(events.find((e) => e.type === 'error')?.code).toBe('generation_failed');
    expect(events[events.length - 1]).toMatchObject({ type: 'done', ok: false, taskId: 'task-1' });
    // failTask gravou failed
    const failUpd = prisma.task.update.mock.calls.find((c) => c[0].data.status === 'failed');
    expect(failUpd).toBeDefined();
    expect(failUpd[0].data.errorText).toContain('generation boom');
  });
});

// ============================================================================
// GET /api/admin/ai-config
// ============================================================================
describe('GET /api/admin/ai-config', () => {
  it('401 sem admin', async () => {
    asUnauthorized();
    const res = await aiConfigGET(adminReq('/api/admin/ai-config'));
    expect(res.status).toBe(401);
  });

  it('200 sem config salva → configured=false', async () => {
    asNoAdmin();
    prisma.agentMemory.findMany = jest.fn().mockResolvedValue([]);
    const res = await aiConfigGET(adminReq('/api/admin/ai-config'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ configured: false, baseUrl: null, model: null });
  });

  it('200 com config salva → retorna baseUrl e model, NUNCA apiKey', async () => {
    asNoAdmin();
    // O Prisma retorna memoryKey/valueJson; listMemory mapeia para key/value.
    // O mock simula a resposta crua do banco.
    prisma.agentMemory.findMany = jest.fn().mockResolvedValue([
      {
        id: 'mem-1',
        organizationId: 'org-admin',
        userId: 'user-admin',
        kind: 'preference',
        memoryKey: 'ai_config',
        valueJson: { baseUrl: 'https://api.openai.com', apiKey: 'sk-SECRET', model: 'gpt-4o' },
        supersededAt: null,
        createdAt: new Date().toISOString(),
      },
    ]);
    const res = await aiConfigGET(adminReq('/api/admin/ai-config'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.configured).toBe(true);
    expect(json.baseUrl).toBe('https://api.openai.com');
    expect(json.model).toBe('gpt-4o');
    expect(json.apiKey).toBeUndefined(); // segurança: chave nunca retorna
  });
});

// ============================================================================
// POST /api/admin/ai-config
// ============================================================================
describe('POST /api/admin/ai-config', () => {
  it('401 sem admin', async () => {
    asUnauthorized();
    const res = await aiConfigPOST(
      adminReq('/api/admin/ai-config', { method: 'POST', body: { baseUrl: 'x', apiKey: 'y' } }),
    );
    expect(res.status).toBe(401);
  });

  it('400 sem baseUrl ou apiKey', async () => {
    asNoAdmin();
    const res = await aiConfigPOST(
      adminReq('/api/admin/ai-config', { method: 'POST', body: { apiKey: 'sk-1' } }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('baseUrl');
  });

  it('400 URL inválida', async () => {
    asNoAdmin();
    const res = await aiConfigPOST(
      adminReq('/api/admin/ai-config', { method: 'POST', body: { baseUrl: 'nao-e-url', apiKey: 'sk-1' } }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('URL válida');
  });

  it("200 salva config no DB — apiKey não retorna na resposta", async () => {
    asNoAdmin();
    const res = await aiConfigPOST(
      adminReq('/api/admin/ai-config', {
        method: 'POST',
        body: { baseUrl: 'https://api.openai.com', apiKey: 'sk-test-123', model: 'gpt-4o' },
      }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    const arg = prisma.agentMemory.upsert.mock.calls[0][0];
    // A chave composta do Prisma é gerada automaticamente: organizationId_userId_kind_memoryKey
    expect(arg.where.organizationId_userId_kind_memoryKey).toEqual({
      organizationId: 'org-admin',
      userId: 'user-admin',
      kind: 'preference',
      memoryKey: 'ai_config',
    });
    // saveMemory usa jsonSafe(value) → campo fica em update.valueJson e create.valueJson
    expect(arg.update.valueJson.baseUrl).toBe('https://api.openai.com');
    expect(arg.update.valueJson.apiKey).toBe('sk-test-123');
    expect(arg.update.valueJson.model).toBe('gpt-4o');
  });
});

// ============================================================================
// DELETE /api/admin/ai-config
// ============================================================================
describe('DELETE /api/admin/ai-config', () => {
  it('401 sem admin', async () => {
    asUnauthorized();
    const res = await aiConfigDELETE(adminReq('/api/admin/ai-config', { method: 'DELETE' }));
    expect(res.status).toBe(401);
  });

  it('200 remove configuração do DB', async () => {
    asNoAdmin();
    prisma.agentMemory.deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const res = await aiConfigDELETE(adminReq('/api/admin/ai-config', { method: 'DELETE' }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    const arg = prisma.agentMemory.deleteMany.mock.calls[0][0];
    expect(arg.where.memoryKey).toBe('ai_config');
    expect(arg.where.organizationId).toBe('org-admin');
    expect(arg.where.userId).toBe('user-admin');
  });
});
