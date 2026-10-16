// FASE AGENT — Phase 2: testes da fila de tarefas persistente.
// - Máquina de estados (transições válidas/inválidas).
// - Degradação honesta: P2021/P1001/P1013 → TaskQueueUnavailableError.
// - Ciclo de vida real com fake Prisma em memória: progresso calculado
//   SOMENTE do estado dos passos (nunca estimado), recusa de completação
//   com etapas abertas, cancelamento preserva histórico, isolamento de
//   tenant, upsert de memória.

import { describe, it, expect } from '@jest/globals';
import type { PrismaClient } from '@prisma/client';
import {
  canTransition,
  isQueueUnavailable,
  isTaskOpen,
  TaskQueueUnavailableError,
  TaskNotCompletableError,
  createTask,
  startTask,
  markStep,
  waitForHuman,
  resumeAfterHuman,
  completeTask,
  failTask,
  cancelTask,
  listTasks,
  getTaskDetail,
  saveMemory,
  listMemory,
  type TaskStatus,
  type OrgScope,
} from '../lib/taskQueue';

// ------------------------------------------------------------------
// Fake Prisma em memória (apenas a superfície usada por taskQueue)
// ------------------------------------------------------------------
interface Row {
  [k: string]: unknown;
}

function makeFakeClient(overrides?: { failP2021OnTask?: boolean }) {
  const tasks: Row[] = [];
  const steps: Row[] = [];
  const events: Row[] = [];
  const memories: Row[] = [];
  let seq = 0;
  let ts = 1_000_000;

  const now = () => new Date(ts++);
  const newId = () => `id-${++seq}`;
  const match = (row: Row, where: Row) =>
    Object.entries(where).every(([k, v]) => {
      if (v === undefined) return true; // filtro ausente (ex.: status não especificado)
      if (v === null) return row[k] === null; // equals-NULL (ex.: supersededAt: null)
      if (typeof v === 'object') {
        const inner = v as { in?: unknown[] };
        if (inner.in) return inner.in.includes(row[k]);
        return false;
      }
      return row[k] === v;
    });

  const p2021 = () => {
    const e = new Error('P2021: Table "Task" does not exist');
    (e as { code?: string }).code = 'P2021';
    return e;
  };

  const task = {
    create: async ({ data }: { data: Row }) => {
      if (overrides?.failP2021OnTask) throw p2021();
      const row: Row = {
        id: newId(),
        status: 'queued',
        progress: 0,
        inputJson: data.inputJson,
        organizationId: data.organizationId,
        userId: data.userId,
        title: data.title,
        errorText: null,
        resultJson: null,
        usageJson: null,
        modelUsed: null,
        waitingReason: null,
        createdAt: now(),
        updatedAt: now(),
        completedAt: null,
        ...data,
      };
      tasks.push(row);
      return row;
    },
    findFirst: async (args: {
      where: Row;
      select?: Row;
      include?: Row;
    }) => {
      const row = tasks.find((t) => match(t, args.where));
      if (!row) return null;
      if (args.include) {
        return {
          ...row,
          steps: steps
            .filter((s) => s.taskId === row.id)
            .sort((a, b) => Number(a.seq) - Number(b.seq)),
          events: events
            .filter((ev) => ev.taskId === row.id)
            .sort((a, b) => Number(a.createdAt) - Number(b.createdAt))
            .slice(0, 500),
        };
      }
      if (args.select) {
        const out: Row = {};
        for (const k of Object.keys(args.select)) out[k] = row[k];
        return out;
      }
      return row;
    },
    update: async ({ where, data }: { where: Row; data: Row }) => {
      const row = tasks.find((t) => match(t, where));
      if (!row) throw new Error('tarefa não encontrada');
      Object.assign(row, data);
      return row;
    },
    findMany: async (args: { where: Row; take?: number; skip?: number }) => {
      let rows = tasks.filter((t) => match(t, args.where));
      rows = rows
        .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
        .slice(args.skip ?? 0, (args.skip ?? 0) + (args.take ?? 50));
      return rows;
    },
  };

  const taskStep = {
    createMany: async ({ data }: { data: Row[] }) => {
      for (const d of data) {
        steps.push({
          id: newId(),
          organizationId: d.organizationId,
          seq: d.seq,
          name: d.name,
          status: 'pending',
          detailJson: null,
          startedAt: null,
          finishedAt: null,
          createdAt: now(),
          taskId: d.taskId,
        });
      }
      return { count: data.length };
    },
    findFirst: async (args: { where: Row; orderBy?: Row }) => {
      let rows = steps.filter((s) => match(s, args.where));
      if (args.orderBy?.seq === 'asc') {
        rows = [...rows].sort((a, b) => Number(a.seq) - Number(b.seq));
      }
      return rows[0] ?? null;
    },
    update: async ({ where, data }: { where: Row; data: Row }) => {
      const row = steps.find((s) => match(s, where));
      if (!row) throw new Error('etapa não encontrada');
      Object.assign(row, data);
      return row;
    },
    updateMany: async ({ where, data }: { where: Row; data: Row }) => {
      let count = 0;
      for (const s of steps) {
        if (match(s, where)) {
          Object.assign(s, data);
          count++;
        }
      }
      return { count };
    },
    count: async ({ where }: { where: Row }) =>
      steps.filter((s) => match(s, where)).length,
    findMany: async ({ where }: { where: Row }) =>
      steps.filter((s) => match(s, where)),
  };

  const taskEvent = {
    create: async ({ data }: { data: Row }) => {
      const row = {
        id: newId(),
        organizationId: data.organizationId,
        taskId: data.taskId,
        type: data.type,
        payloadJson: data.payloadJson,
        createdAt: now(),
      };
      events.push(row);
      return row;
    },
  };

  const agentMemory = {
    upsert: async (args: {
      where: Row & { organizationId_userId_kind_memoryKey: Row };
      update: Row;
      create: Row;
    }) => {
      const key = args.where.organizationId_userId_kind_memoryKey;
      const existing = memories.find(
        (m) =>
          m.organizationId === key.organizationId &&
          m.userId === key.userId &&
          m.kind === key.kind &&
          m.memoryKey === key.memoryKey,
      );
      if (existing) {
        Object.assign(existing, args.update, { updatedAt: now() });
        return existing;
      }
      const row: Row = {
        id: newId(),
        createdAt: now(),
        supersededAt: null,
        ...args.create,
        valueJson: args.create.valueJson,
      };
      row.updatedAt = now();
      memories.push(row);
      return row;
    },
    findMany: async (args: { where: Row; take?: number }) =>
      memories
        .filter((m) => match(m, args.where))
        .sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt))
        .slice(0, args.take ?? 50),
  };

  const tx = {
    $executeRaw: async (..._args: unknown[]) => 0,
    task,
    taskStep,
    taskEvent,
    agentMemory,
  };

  const client = {
    $transaction: async <T>(cb: (t: typeof tx) => Promise<T>): Promise<T> =>
      cb(tx as never),
  } as unknown as PrismaClient & { __store: { tasks: Row[]; steps: Row[] } };
  (client as unknown as { __store: Row }).__store = { tasks, steps };

  return { client, tasks, steps, events, memories };
}

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const USER_A = '33333333-3333-4333-8333-333333333333';
const scopeA: OrgScope = { organizationId: ORG_A, userId: USER_A };
const scopeB: OrgScope = { organizationId: ORG_B, userId: USER_A };

// ------------------------------------------------------------------
// Máquina de estados
// ------------------------------------------------------------------
describe('canTransition (máquina de estados da Task)', () => {
  it('permite as transições válidas', () => {
    expect(canTransition('queued', 'running')).toBe(true);
    expect(canTransition('queued', 'canceled')).toBe(true);
    expect(canTransition('running', 'waiting_human')).toBe(true);
    expect(canTransition('running', 'completed')).toBe(true);
    expect(canTransition('running', 'failed')).toBe(true);
    expect(canTransition('running', 'canceled')).toBe(true);
    expect(canTransition('waiting_human', 'running')).toBe(true);
    expect(canTransition('waiting_human', 'canceled')).toBe(true);
  });

  it('bloqueia transições inválidas', () => {
    expect(canTransition('queued', 'completed')).toBe(false);
    expect(canTransition('queued', 'failed')).toBe(false);
    expect(canTransition('running', 'queued')).toBe(false);
    expect(canTransition('waiting_human', 'completed')).toBe(false);
    expect(canTransition('waiting_human', 'failed')).toBe(false);
  });

  it('estados terminais não aceitam transição', () => {
    const terminals: TaskStatus[] = ['completed', 'failed', 'canceled'];
    for (const from of terminals) {
      for (const to of ['queued', 'running', 'waiting_human', 'completed', 'failed', 'canceled'] as TaskStatus[]) {
        expect(canTransition(from, to)).toBe(false);
      }
    }
  });
});

// ------------------------------------------------------------------
// Degradação honesta (tabela ausente / falha de conexão)
// ------------------------------------------------------------------
describe('isQueueUnavailable + degradação', () => {
  it('detecta P2021/P1001/P1013 e ignora demais erros', () => {
    const p2021 = new Error('missing table');
    (p2021 as { code?: string }).code = 'P2021';
    const p1001 = new Error('conn refused');
    (p1001 as { code?: string }).code = 'P1001';
    const p1013 = new Error('timeout');
    (p1013 as { code?: string }).code = 'P1013';
    const other = new Error('P1009 timeout');
    (other as { code?: string }).code = 'P1009';
    expect(isQueueUnavailable(p2021)).toBe(true);
    expect(isQueueUnavailable(p1001)).toBe(true);
    expect(isQueueUnavailable(p1013)).toBe(true);
    expect(isQueueUnavailable(other)).toBe(false);
    expect(isQueueUnavailable('string errada')).toBe(false);
    expect(isQueueUnavailable(null)).toBe(false);
  });

  it('createTask degrada para TaskQueueUnavailableError quando a tabela não existe', async () => {
    const { client } = makeFakeClient({ failP2021OnTask: true });
    await expect(
      createTask(client, scopeA, { title: 'x', steps: ['a'] }),
    ).rejects.toBeInstanceOf(TaskQueueUnavailableError);
  });

  it('listTasks degrada do mesmo jeito', async () => {
    const c2 = {
      $transaction: async <T>(cb: (t: never) => Promise<T>) => {
        const tx = {
          $executeRaw: async () => 0,
          task: {
            findMany: async () => {
              const e = new Error('P2021: missing');
              (e as { code?: string }).code = 'P2021';
              throw e;
            },
          },
          taskStep: {},
          taskEvent: {},
          agentMemory: {},
        };
        return cb(tx as never);
      },
    } as unknown as PrismaClient;
    await expect(listTasks(c2, scopeA)).rejects.toBeInstanceOf(
      TaskQueueUnavailableError,
    );
  });

  it('isTaskOpen classifica corretamente', () => {
    expect(isTaskOpen('queued')).toBe(true);
    expect(isTaskOpen('running')).toBe(true);
    expect(isTaskOpen('waiting_human')).toBe(true);
    expect(isTaskOpen('completed')).toBe(false);
    expect(isTaskOpen('failed')).toBe(false);
    expect(isTaskOpen('canceled')).toBe(false);
  });
});

// ------------------------------------------------------------------
// Ciclo de vida real (progresso derivado dos passos, nunca estimado)
// ------------------------------------------------------------------
describe('ciclo de vida da Task (fake Prisma em memória)', () => {
  it('cria tarefa com etapas e evento "created"', async () => {
    const { client, events } = makeFakeClient();
    const { taskId, steps: n } = await createTask(client, scopeA, {
      title: 't',
      input: { prompt: 'oi' },
      steps: ['preparar-contexto', 'gerar-resposta', 'registrar-tarefa'],
    });
    expect(n).toBe(3);
    expect(taskId).toBeTruthy();
    expect(events.filter((e) => e.type === 'created')).toHaveLength(1);
  });

  it('recalcula progresso real a cada etapa (33 → 66 → 100)', async () => {
    const { client } = makeFakeClient();
    const { taskId } = await createTask(client, scopeA, {
      title: 't',
      steps: ['a', 'b', 'c'],
    });
    await startTask(client, scopeA, taskId);

    const p1 = await markStep(client, scopeA, taskId, 0, 'done');
    expect(p1.progress).toBe(33);
    expect(p1.total).toBe(3);

    const p2 = await markStep(client, scopeA, taskId, 1, 'done');
    expect(p2.progress).toBe(66);

    const p3 = await markStep(client, scopeA, taskId, 2, 'done');
    expect(p3.progress).toBe(100);

    await completeTask(client, scopeA, taskId, {
      modelUsed: 'm1',
      usage: { totalTokens: 42 },
    });
    const detail = await getTaskDetail(client, scopeA, taskId);
    expect(detail?.status).toBe('completed');
    expect(detail?.progress).toBe(100);
    expect(detail?.modelUsed).toBe('m1');
    expect(detail?.completedAt).toBeInstanceOf(Date);
  });

  it('recusa completeTask com etapas ainda abertas (progresso nunca falso)', async () => {
    const { client } = makeFakeClient();
    const { taskId } = await createTask(client, scopeA, { title: 't', steps: ['a', 'b'] });
    await startTask(client, scopeA, taskId);
    await expect(completeTask(client, scopeA, taskId)).rejects.toBeInstanceOf(
      TaskNotCompletableError,
    );
    // após concluir as duas etapas, completa:
    await markStep(client, scopeA, taskId, 0, 'done');
    await markStep(client, scopeA, taskId, 1, 'done');
    const r = await completeTask(client, scopeA, taskId);
    expect(r.progress).toBe(100);
  });

  it('cancela tarefa aberta: etapas pendentes viram "skipped", sem apagar histórico', async () => {
    const { client, steps } = makeFakeClient();
    const { taskId } = await createTask(client, scopeA, { title: 't', steps: ['a', 'b', 'c'] });
    await startTask(client, scopeA, taskId);
    await markStep(client, scopeA, taskId, 0, 'done');
    await cancelTask(client, scopeA, taskId, 'cancelada pelo teste');
    const bySeq = steps
      .filter((s) => s.taskId === taskId)
      .sort((x, y) => Number(x.seq) - Number(y.seq));
    expect(bySeq.map((s) => s.status)).toEqual(['done', 'skipped', 'skipped']);
    const detail = await getTaskDetail(client, scopeA, taskId);
    expect(detail?.status).toBe('canceled');
  });

  it('failTask a partir de running registra erro e uso real', async () => {
    const { client } = makeFakeClient();
    const { taskId } = await createTask(client, scopeA, { title: 't', steps: ['a'] });
    await startTask(client, scopeA, taskId);
    await failTask(client, scopeA, taskId, 'boom', { modelUsed: 'm' });
    const detail = await getTaskDetail(client, scopeA, taskId);
    expect(detail?.status).toBe('failed');
    expect(detail?.errorText).toBe('boom');
    expect(detail?.modelUsed).toBe('m');
  });

  it('waitForHuman + resumeAfterHuman: running → waiting_human → running', async () => {
    const { client } = makeFakeClient();
    const { taskId } = await createTask(client, scopeA, { title: 't', steps: ['a'] });
    await startTask(client, scopeA, taskId);
    await waitForHuman(client, scopeA, taskId, 'aguardando login');
    let detail = await getTaskDetail(client, scopeA, taskId);
    expect(detail?.status).toBe('waiting_human');
    expect(detail?.waitingReason).toBe('aguardando login');
    await resumeAfterHuman(client, scopeA, taskId);
    detail = await getTaskDetail(client, scopeA, taskId);
    expect(detail?.status).toBe('running');
    expect(detail?.waitingReason).toBeNull();
  });

  it('rejeita transição inválida (startTask em tarefa completed)', async () => {
    const { client } = makeFakeClient();
    const { taskId } = await createTask(client, scopeA, { title: 't', steps: ['a'] });
    await startTask(client, scopeA, taskId);
    await markStep(client, scopeA, taskId, 0, 'done');
    await completeTask(client, scopeA, taskId);
    await expect(startTask(client, scopeA, taskId)).rejects.toThrow(/inválida|não encontrada/);
  });

  it('isolamento de tenant: tarefa de outra org não é visível', async () => {
    const { client } = makeFakeClient();
    const { taskId } = await createTask(client, scopeA, { title: 'só da A' });
    await expect(startTask(client, scopeB, taskId)).rejects.toThrow(
      /não encontrada neste tenant/,
    );
    const listB = await listTasks(client, scopeB);
    expect(listB).toHaveLength(0);
    const listA = await listTasks(client, scopeA, { status: 'queued' });
    expect(listA).toHaveLength(1);
    expect(listA[0].id).toBe(taskId);
  });

  it('listTasks respeita status e limit', async () => {
    const { client } = makeFakeClient();
    for (let i = 0; i < 5; i++) {
      await createTask(client, scopeA, { title: `t${i}` });
    }
    expect(await listTasks(client, scopeA)).toHaveLength(5);
    expect(await listTasks(client, scopeA, { limit: 2 })).toHaveLength(2);
    expect(await listTasks(client, scopeA, { status: 'completed' })).toHaveLength(0);
  });
});

// ------------------------------------------------------------------
// Memória persistente (upsert + lista de ativas)
// ------------------------------------------------------------------
describe('AgentMemory', () => {
  it('saveMemory faz upsert: mesmo (tenant,user,kind,key) sobrescreve sem duplicar', async () => {
    const { client, memories } = makeFakeClient();
    await saveMemory(client, scopeA, 'decision', 'db-choice', { pick: 'pg' });
    await saveMemory(client, scopeA, 'decision', 'db-choice', { pick: 'mysql' });
    const rows = memories.filter(
      (m) => m.kind === 'decision' && m.memoryKey === 'db-choice',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].valueJson).toEqual({ pick: 'mysql' });
    expect(rows[0].supersededAt).toBeNull();
  });

  it('listMemory retorna somente ativas, do mais recente', async () => {
    const { client } = makeFakeClient();
    await saveMemory(client, scopeA, 'lesson', 'k1', 'v1');
    await saveMemory(client, scopeA, 'lesson', 'k2', 'v2');
    const all = await listMemory(client, scopeA, 10);
    expect(all.map((m) => m.key)).toEqual(['k2', 'k1']);
    expect(all[0].value).toBe('v2');
  });

  it('memória de outro tenant não vaza', async () => {
    const { client } = makeFakeClient();
    await saveMemory(client, scopeA, 'fact', 'segredo', 'só A');
    const listB = await listMemory(client, scopeB, 10);
    expect(listB).toHaveLength(0);
  });
});
