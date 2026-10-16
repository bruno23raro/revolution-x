// FASE AGENT — Phase 2: fila persistente de tarefas + memória do projeto.
//
// O progresso reportado é SEMPRE real: deriva do estado atual dos
// TaskStep (concluídas / total). Nada é estimado — se a fila não está
// disponível no ambiente (ex.: tabela ainda não migrada em produção),
// TaskQueueUnavailableError é lançado e o chamador decide como degradar.
//
// RLS: todas as operações rodam em com withTenantContextOn (GUC
// app.current_org) para as tabelas de tenant; AgentMemory define também
// app.current_user_id, alinhado ao padrão de user-scoping da migration 008.

import { Prisma, PrismaClient } from '@prisma/client';
import { withTenantContextOn } from './prisma';

// ============================================================
// Tipos
// ============================================================

export type TaskStatus =
  | 'queued'
  | 'running'
  | 'waiting_human'
  | 'completed'
  | 'failed'
  | 'canceled';

export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export type MemoryKind = 'decision' | 'preference' | 'lesson' | 'fact';

export interface OrgScope {
  organizationId: string;
  userId: string;
}

export interface TaskSummary {
  id: string;
  title: string;
  status: TaskStatus;
  progress: number;
  modelUsed: string | null;
  errorText: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface TaskDetail extends TaskSummary {
  inputJson: Prisma.JsonValue;
  resultJson: Prisma.JsonValue | null;
  usageJson: Prisma.JsonValue | null;
  waitingReason: string | null;
  steps: Array<{
    seq: number;
    name: string;
    status: StepStatus;
    startedAt: Date | null;
    finishedAt: Date | null;
  }>;
  events: Array<{ type: string; payload: Prisma.JsonValue; at: Date }>;
}

// ============================================================
// Erros
// ============================================================

/** A fila não existe neste ambiente (tabela não migrada) — degradar, não fingir. */
export class TaskQueueUnavailableError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'TaskQueueUnavailableError';
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

/** Tentou completar com etapas obrigatórias ainda pendentes. */
export class TaskNotCompletableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskNotCompletableError';
  }
}

export function isQueueUnavailable(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  // P2021 = tabela não existe; P1001/P1013 falhas de conexão.
  return code === 'P2021' || code === 'P1001' || code === 'P1013';
}

// ============================================================
// Máquina de estados
// ============================================================

const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  queued: ['running', 'canceled'],
  running: ['waiting_human', 'completed', 'failed', 'canceled'],
  waiting_human: ['running', 'canceled'],
  completed: [],
  failed: [],
  canceled: [],
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

// ============================================================
// Helpers internos
// ============================================================

async function withAgentContext<T>(
  client: PrismaClient,
  scope: OrgScope,
  cb: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return await withTenantContextOn(client, scope.organizationId, async (tx) => {
    // AgentMemory é user-scoped (migration 008): define os dois GUCs.
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${scope.userId}, true)`;
    return await cb(tx);
  });
}

function guardAvailable(e: unknown, context: string): never {
  if (isQueueUnavailable(e)) {
    throw new TaskQueueUnavailableError(
      `fila de tarefas indisponível (${context}): ${String((e as { message?: string })?.message ?? e)}`,
      e,
    );
  }
  throw e;
}

type JsonInput = Prisma.InputJsonValue | typeof Prisma.JsonNull;

function jsonSafe(v: unknown): JsonInput {
  if (v === undefined || v === null) return Prisma.JsonNull;
  return v as Prisma.InputJsonValue;
}

async function computeProgress(tx: Prisma.TransactionClient, taskId: string): Promise<number> {
  const steps = await tx.taskStep.findMany({
    where: { taskId },
    select: { status: true },
  });
  const total = steps.length;
  if (total === 0) return 0;
  const done = steps.filter(
    (s) => s.status === 'done' || s.status === 'skipped',
  ).length;
  return Math.min(100, Math.floor((done / total) * 100));
}

async function logEvent(
  tx: Prisma.TransactionClient,
  scope: OrgScope,
  taskId: string,
  type: string,
  payload?: Prisma.JsonValue,
): Promise<void> {
  await tx.taskEvent.create({
    data: {
      taskId,
      organizationId: scope.organizationId,
      type,
      payloadJson: jsonSafe(payload),
    },
  });
}

// ============================================================
// Tarefas
// ============================================================

export interface CreateTaskInput {
  title: string;
  input?: Prisma.JsonValue;
  /** Nomes das etapas planejadas. Progresso real = concluídas/total. */
  steps?: string[];
}

export async function createTask(
  client: PrismaClient,
  scope: OrgScope,
  input: CreateTaskInput,
): Promise<{ taskId: string; steps: number }> {
  try {
    return await withAgentContext(client, scope, async (tx) => {
      const task = await tx.task.create({
        data: {
          organizationId: scope.organizationId,
          userId: scope.userId,
          title: input.title.slice(0, 300),
          inputJson: jsonSafe(input.input),
        },
      });
      const names = input.steps ?? [];
      if (names.length > 0) {
        await tx.taskStep.createMany({
          data: names.map((name, i) => ({
            taskId: task.id,
            organizationId: scope.organizationId,
            seq: i,
            name: name.slice(0, 200),
          })),
        });
      }
      await logEvent(tx, scope, task.id, 'created', {
        title: task.title,
        steps: names.length,
      });
      return { taskId: task.id, steps: names.length };
    });
  } catch (e) {
    return guardAvailable(e, 'createTask');
  }
}

export async function startTask(
  client: PrismaClient,
  scope: OrgScope,
  taskId: string,
): Promise<void> {
  try {
    await withAgentContext(client, scope, async (tx) => {
      const task = await tx.task.findFirst({
        where: { id: taskId, organizationId: scope.organizationId },
        select: { status: true },
      });
      if (!task) throw new Error(`tarefa ${taskId} não encontrada neste tenant`);
      if (!canTransition(task.status as TaskStatus, 'running')) {
        throw new Error(`transição inválida ${task.status} → running`);
      }
      await tx.task.update({
        where: { id: taskId },
        data: { status: 'running', waitingReason: null },
      });
      await logEvent(tx, scope, taskId, 'status_change', { from: task.status, to: 'running' });
      const running = await tx.taskStep.findFirst({
        where: { taskId, organizationId: scope.organizationId, status: 'pending' },
        orderBy: { seq: 'asc' },
      });
      if (running) {
        await tx.taskStep.update({
          where: { id: running.id },
          data: { status: 'running', startedAt: new Date() },
        });
      }
    });
  } catch (e) {
    if (e instanceof Error && /não encontrada|inválida/.test(e.message)) throw e;
    return guardAvailable(e, 'startTask');
  }
}

export async function markStep(
  client: PrismaClient,
  scope: OrgScope,
  taskId: string,
  seq: number,
  status: StepStatus,
  detail?: Prisma.JsonValue,
): Promise<{ progress: number; step: number; total: number }> {
  try {
    return await withAgentContext(client, scope, async (tx) => {
      const step = await tx.taskStep.findFirst({
        where: { taskId, organizationId: scope.organizationId, seq },
      });
      if (!step) throw new Error(`etapa seq=${seq} não existe na tarefa ${taskId}`);
      const data: Prisma.TaskStepUpdateInput = { status };
      if (status === 'running' && !step.startedAt) data.startedAt = new Date();
      if (status === 'done' || status === 'failed' || status === 'skipped') {
        data.finishedAt = new Date();
      }
      if (detail !== undefined) data.detailJson = jsonSafe(detail);
      await tx.taskStep.update({ where: { id: step.id }, data });

      // Ao concluir uma etapa, a próxima pendente entra em execução.
      if (status === 'done') {
        const next = await tx.taskStep.findFirst({
          where: { taskId, organizationId: scope.organizationId, status: 'pending' },
          orderBy: { seq: 'asc' },
        });
        if (next) {
          await tx.taskStep.update({
            where: { id: next.id },
            data: { status: 'running', startedAt: new Date() },
          });
        }
      }

      const total = await tx.taskStep.count({
        where: { taskId, organizationId: scope.organizationId },
      });
      const progress = await computeProgress(tx, taskId);
      await tx.task.update({ where: { id: taskId }, data: { progress } });
      await logEvent(tx, scope, taskId, 'step', { seq, status, detail });
      return { progress, step: seq, total };
    });
  } catch (e) {
    if (e instanceof Error && /não existe/.test(e.message)) throw e;
    return guardAvailable(e, 'markStep');
  }
}

export async function waitForHuman(
  client: PrismaClient,
  scope: OrgScope,
  taskId: string,
  reason: string,
): Promise<void> {
  try {
    await withAgentContext(client, scope, async (tx) => {
      const task = await tx.task.findFirst({
        where: { id: taskId, organizationId: scope.organizationId },
        select: { status: true },
      });
      if (!task) throw new Error(`tarefa ${taskId} não encontrada neste tenant`);
      if (!canTransition(task.status as TaskStatus, 'waiting_human')) {
        throw new Error(`transição inválida ${task.status} → waiting_human`);
      }
      await tx.task.update({
        where: { id: taskId },
        data: { status: 'waiting_human', waitingReason: reason.slice(0, 300) },
      });
      await logEvent(tx, scope, taskId, 'status_change', {
        from: task.status,
        to: 'waiting_human',
        reason,
      });
    });
  } catch (e) {
    if (e instanceof Error && /não encontrada|inválida/.test(e.message)) throw e;
    return guardAvailable(e, 'waitForHuman');
  }
}

/** waiting_human → running (exatamente `startTask`). */
export async function resumeAfterHuman(
  client: PrismaClient,
  scope: OrgScope,
  taskId: string,
): Promise<void> {
  await startTask(client, scope, taskId);
}

export interface FinishTaskInput {
  result?: Prisma.JsonValue;
  usage?: Prisma.JsonValue;
  modelUsed?: string;
}

export async function completeTask(
  client: PrismaClient,
  scope: OrgScope,
  taskId: string,
  input: FinishTaskInput = {},
): Promise<{ progress: number }> {
  try {
    return await withAgentContext(client, scope, async (tx) => {
      const task = await tx.task.findFirst({
        where: { id: taskId, organizationId: scope.organizationId },
        select: { status: true, modelUsed: true },
      });
      if (!task) throw new Error(`tarefa ${taskId} não encontrada neste tenant`);
      if (!canTransition(task.status as TaskStatus, 'completed')) {
        throw new Error(`transição inválida ${task.status} → completed`);
      }
      // Progresso REAL: só completa se nenhuma etapa obrigatória pendente/rodando.
      const open = await tx.taskStep.count({
        where: {
          taskId,
          organizationId: scope.organizationId,
          status: { in: ['pending', 'running'] },
        },
      });
      if (open > 0) {
        throw new TaskNotCompletableError(
          `${open} etapa(s) ainda pendente(s)/em execução — use markStep antes de completeTask`,
        );
      }
      await tx.task.update({
        where: { id: taskId },
        data: {
          status: 'completed',
          progress: 100,
          completedAt: new Date(),
          resultJson: jsonSafe(input.result),
          usageJson: jsonSafe(input.usage),
          modelUsed: input.modelUsed ?? task.modelUsed ?? null,
        },
      });
      await logEvent(tx, scope, taskId, 'status_change', {
        from: task.status,
        to: 'completed',
      });
      return { progress: 100 };
    });
  } catch (e) {
    if (
      e instanceof TaskNotCompletableError ||
      (e instanceof Error && /não encontrada|inválida/.test(e.message))
    ) {
      throw e;
    }
    return guardAvailable(e, 'completeTask');
  }
}

export async function failTask(
  client: PrismaClient,
  scope: OrgScope,
  taskId: string,
  error: string,
  input: Pick<FinishTaskInput, 'usage' | 'modelUsed'> = {},
): Promise<void> {
  try {
    await withAgentContext(client, scope, async (tx) => {
      const task = await tx.task.findFirst({
        where: { id: taskId, organizationId: scope.organizationId },
        select: { status: true },
      });
      if (!task) throw new Error(`tarefa ${taskId} não encontrada neste tenant`);
      if (!canTransition(task.status as TaskStatus, 'failed')) {
        throw new Error(`transição inválida ${task.status} → failed`);
      }
      await tx.task.update({
        where: { id: taskId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorText: error.slice(0, 8000),
          usageJson: jsonSafe(input.usage),
          modelUsed: input.modelUsed ?? null,
        },
      });
      await logEvent(tx, scope, taskId, 'status_change', {
        from: task.status,
        to: 'failed',
      });
      await logEvent(tx, scope, taskId, 'error', { message: error });
    });
  } catch (e) {
    if (e instanceof Error && /não encontrada|inválida/.test(e.message)) throw e;
    return guardAvailable(e, 'failTask');
  }
}

export async function cancelTask(
  client: PrismaClient,
  scope: OrgScope,
  taskId: string,
  reason?: string,
): Promise<void> {
  try {
    await withAgentContext(client, scope, async (tx) => {
      const task = await tx.task.findFirst({
        where: { id: taskId, organizationId: scope.organizationId },
        select: { status: true },
      });
      if (!task) throw new Error(`tarefa ${taskId} não encontrada neste tenant`);
      if (!canTransition(task.status as TaskStatus, 'canceled')) {
        throw new Error(`transição inválida ${task.status} → canceled`);
      }
      await tx.task.update({
        where: { id: taskId },
        data: { status: 'canceled', completedAt: new Date() },
      });
      // Etapas não concluídas viram 'skipped' (não apaga o histórico real).
      await tx.taskStep.updateMany({
        where: {
          taskId,
          organizationId: scope.organizationId,
          status: { in: ['pending', 'running'] },
        },
        data: { status: 'skipped', finishedAt: new Date() },
      });
      await logEvent(tx, scope, taskId, 'status_change', {
        from: task.status,
        to: 'canceled',
        reason,
      });
    });
  } catch (e) {
    if (e instanceof Error && /não encontrada|inválida/.test(e.message)) throw e;
    return guardAvailable(e, 'cancelTask');
  }
}

export function isTaskOpen(status: TaskStatus): boolean {
  return status === 'queued' || status === 'running' || status === 'waiting_human';
}

export interface ListTasksInput {
  status?: TaskStatus;
  limit?: number;
  offset?: number;
}

export async function listTasks(
  client: PrismaClient,
  scope: OrgScope,
  input: ListTasksInput = {},
): Promise<TaskSummary[]> {
  try {
    return await withAgentContext(client, scope, async (tx) => {
      const items = await tx.task.findMany({
        where: {
          organizationId: scope.organizationId,
          status: input.status,
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(input.limit ?? 50, 200),
        skip: input.offset ?? 0,
        select: {
          id: true,
          title: true,
          status: true,
          progress: true,
          modelUsed: true,
          errorText: true,
          createdAt: true,
          completedAt: true,
        },
      });
      return items.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status as TaskStatus,
        progress: t.progress,
        modelUsed: t.modelUsed,
        errorText: t.errorText,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
      }));
    });
  } catch (e) {
    return guardAvailable(e, 'listTasks');
  }
}

export async function getTaskDetail(
  client: PrismaClient,
  scope: OrgScope,
  taskId: string,
): Promise<TaskDetail | null> {
  try {
    return await withAgentContext(client, scope, async (tx) => {
      const task = await tx.task.findFirst({
        where: { id: taskId, organizationId: scope.organizationId },
        include: {
          steps: { orderBy: { seq: 'asc' } },
          events: { orderBy: { createdAt: 'asc' }, take: 500 },
        },
      });
      if (!task) return null;
      return {
        id: task.id,
        title: task.title,
        status: task.status as TaskStatus,
        progress: task.progress,
        modelUsed: task.modelUsed,
        errorText: task.errorText,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
        inputJson: task.inputJson,
        resultJson: task.resultJson,
        usageJson: task.usageJson,
        waitingReason: task.waitingReason,
        steps: task.steps.map((s) => ({
          seq: s.seq,
          name: s.name,
          status: s.status as StepStatus,
          startedAt: s.startedAt,
          finishedAt: s.finishedAt,
        })),
        events: task.events.map((ev) => ({
          type: ev.type,
          payload: ev.payloadJson,
          at: ev.createdAt,
        })),
      };
    });
  } catch (e) {
    return guardAvailable(e, 'getTaskDetail');
  }
}

// ============================================================
// Memória persistente (AgentMemory)
// ============================================================

export async function saveMemory(
  client: PrismaClient,
  scope: OrgScope,
  kind: MemoryKind,
  key: string,
  value: Prisma.JsonValue,
): Promise<void> {
  try {
    await withAgentContext(client, scope, async (tx) => {
      // Upsert: mesmo (tenant, user, kind, key) sobrescreve e zera supersededAt.
      await tx.agentMemory.upsert({
        where: {
          organizationId_userId_kind_memoryKey: {
            organizationId: scope.organizationId,
            userId: scope.userId,
            kind,
            memoryKey: key.slice(0, 200),
          },
        },
        update: { valueJson: jsonSafe(value), supersededAt: null },
        create: {
          organizationId: scope.organizationId,
          userId: scope.userId,
          kind,
          memoryKey: key.slice(0, 200),
          valueJson: jsonSafe(value),
        },
      });
    });
  } catch (e) {
    return guardAvailable(e, 'saveMemory');
  }
}

export async function listMemory(
  client: PrismaClient,
  scope: OrgScope,
  limit = 50,
): Promise<Array<{ kind: MemoryKind; key: string; value: Prisma.JsonValue; updatedAt: Date }>> {
  try {
    return await withAgentContext(client, scope, async (tx) => {
      const items = await tx.agentMemory.findMany({
        where: {
          organizationId: scope.organizationId,
          userId: scope.userId,
          supersededAt: null,
        },
        orderBy: { updatedAt: 'desc' },
        take: Math.min(limit, 200),
        select: { kind: true, memoryKey: true, valueJson: true, updatedAt: true },
      });
      return items.map((m) => ({
        kind: m.kind as MemoryKind,
        key: m.memoryKey,
        value: m.valueJson,
        updatedAt: m.updatedAt,
      }));
    });
  } catch (e) {
    return guardAvailable(e, 'listMemory');
  }
}
