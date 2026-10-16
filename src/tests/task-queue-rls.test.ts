import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';
import * as path from 'path';
import type { PrismaClient } from '@prisma/client';
import { createPrismaClient } from '../lib/prisma';
import {
  createTask,
  startTask,
  markStep,
  completeTask,
  listTasks,
  getTaskDetail,
  cancelTask,
  saveMemory,
  listMemory,
} from '../lib/taskQueue';

// Staging-first validation of migration 014 (FASE AGENT task queue).
// Two real PostgreSQL paths, no mocks:
//  1. RESTRICTED role (revx_test) — proves the RLS policies that 014 created
//     (Task/TaskStep/TaskEvent tenant-scoped, AgentMemory user-scoped) and
//     that they fail-closed when the GUC is empty/absent.
//  2. ADMIN role (BYPASSRLS, same as the production app) — proves the app
//     path end-to-end through taskQueue (lifecycle, real progress, memory).
// Against the LOCAL isolated test DB only (TEST_*_DATABASE_URL from .env.test).
// Never connects to production (DATABASE_URL/DIRECT_URL are intentionally unused).
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL;
const RLS_URL = process.env.TEST_RLS_DATABASE_URL;

type R = { rows: any[]; rowCount: number | null };

let admin: Pool; // BYPASSRLS — preparation + cleanup + app path
let rlsPool: Pool; // restricted revx_test — RLS assertions only
let prismaAdmin: PrismaClient; // app path, same wiring as production

beforeAll(async () => {
  if (!ADMIN_URL) throw new Error('TEST_ADMIN_DATABASE_URL must be set in .env.test');
  if (!RLS_URL) throw new Error('TEST_RLS_DATABASE_URL must be set in .env.test');
  admin = new Pool({ connectionString: ADMIN_URL, max: 2 });
  rlsPool = new Pool({ connectionString: RLS_URL, max: 2 });
  prismaAdmin = createPrismaClient(admin);
  await admin.query('SELECT 1');
  await rlsPool.query('SELECT 1');
  await prismaAdmin.$connect();
});

afterAll(async () => {
  await prismaAdmin?.$disconnect();
  await rlsPool?.end();
  await admin?.end();
});

// Restricted-role query helper with transaction rollback (mirrors rls.test.ts).
// Any error inside fn aborts the tx; we still ROLLBACK so the pooled
// connection is returned in a clean state.
async function rlsCtx<T>(
  mode: { kind: 'org'; org: string } | { kind: 'user'; user: string } | { kind: 'empty' } | { kind: 'absent' },
  fn: (q: (sql: string, params?: unknown[]) => Promise<R>) => Promise<T>,
): Promise<T> {
  const c = await rlsPool.connect();
  const q = async (sql: string, params: unknown[] = []): Promise<R> =>
    (await c.query(sql, params as any[])) as unknown as R;
  let out: T;
  try {
    await c.query('BEGIN');
    if (mode.kind === 'org') await c.query(`SELECT set_config('app.current_org', $1, true)`, [mode.org]);
    else if (mode.kind === 'user') await c.query(`SELECT set_config('app.current_user_id', $1, true)`, [mode.user]);
    else if (mode.kind === 'empty') await c.query(`SELECT set_config('app.current_org', '', true)`);
    // 'absent' — leave the GUC unset; current_setting(..., TRUE) returns NULL
    out = await fn(q);
  } finally {
    try {
      await c.query('ROLLBACK');
    } catch {
      /* tx already ended */
    }
    c.release();
  }
  return out;
}

describe('014 agent task queue (staging-first: real local DB)', () => {
  const orgA = uuidv4();
  const orgB = uuidv4();
  const userA = uuidv4();
  const userB = uuidv4();

  const scopeA = { organizationId: orgA, userId: userA };
  const scopeB = { organizationId: orgB, userId: userB };

  let taskA: string;
  let taskB: string;

  beforeAll(async () => {
    await admin.query(
      `INSERT INTO "Organization" (id, name, slug) VALUES ($1,$2,$3), ($4,$5,$6)
       ON CONFLICT (id) DO NOTHING`,
      [orgA, 'TQ A', `tq_a_${uuidv4().slice(0, 8)}`, orgB, 'TQ B', `tq_b_${uuidv4().slice(0, 8)}`],
    );
    await admin.query(
      `INSERT INTO "User" (id, email, name, password_hash, email_verified) VALUES
       ($1,$2,$3,$4,false), ($5,$6,$7,$8,false)
       ON CONFLICT (id) DO NOTHING`,
      [userA, `tq.a.${uuidv4().slice(0, 8)}@x.test`, 'TQ User A', 'x', userB, `tq.b.${uuidv4().slice(0, 8)}@x.test`, 'TQ User B', 'x'],
    );
    // App path (BYPASSRLS admin, as production runs)
    const rA = await createTask(prismaAdmin, scopeA, { title: 'task A', steps: ['s1', 's2', 's3'] });
    const rB = await createTask(prismaAdmin, scopeB, { title: 'task B', steps: ['s1'] });
    taskA = rA.taskId;
    taskB = rB.taskId;
    await saveMemory(prismaAdmin, scopeA, 'lesson', 'tq-key', { v: 1 });
  });

  afterAll(async () => {
    await admin.query('DELETE FROM "Task" WHERE "organizationId" IN ($1,$2)', [orgA, orgB]);
    await admin.query('DELETE FROM "AgentMemory" WHERE "organizationId" IN ($1,$2)', [orgA, orgB]);
    await admin.query('DELETE FROM "User" WHERE id IN ($1,$2)', [userA, userB]);
    await admin.query('DELETE FROM "Organization" WHERE id IN ($1,$2)', [orgA, orgB]);
  });

  // ---------------- Schema created by 014 ----------------
  describe('schema', () => {
    it('cria as 4 tabelas com RLS FORCE (fail-closed)', async () => {
      const r = await admin.query(
        `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
           FROM pg_class c
          WHERE c.relnamespace = 'public'::regnamespace
            AND c.relname IN ('Task','TaskStep','TaskEvent','AgentMemory')
          ORDER BY 1`,
      );
      const tables = r.rows.map((x: any) => x.relname).sort();
      expect(tables).toEqual(['AgentMemory', 'Task', 'TaskEvent', 'TaskStep']);
      for (const row of r.rows) {
        expect(row.relrowsecurity).toBe(true);
        expect(row.relforcerowsecurity).toBe(true);
      }
    });

    it('políticas de tenant (Task/TaskStep/TaskEvent) e de usuário (AgentMemory)', async () => {
      const r = await admin.query(
        `SELECT tablename, policyname FROM pg_policies
          WHERE schemaname = 'public' AND tablename IN ('Task','TaskStep','TaskEvent','AgentMemory')
          ORDER BY 1,2`,
      );
      const got = r.rows.map((x: any) => `${x.tablename}:${x.policyname}`).sort();
      expect(got).toEqual([
        'AgentMemory:AgentMemory_user',
        'Task:Task_tenant',
        'TaskEvent:TaskEvent_tenant',
        'TaskStep:TaskStep_tenant',
      ]);
    });
  });

  // ---------------- RLS path (restricted role) ----------------
  describe('RLS (papel revx_test, via GUCs)', () => {
    it('org A vê apenas a própria tarefa; org B não vê a de A', async () => {
      const a = await rlsCtx({ kind: 'org', org: orgA }, async (q) =>
        q(`SELECT id FROM "Task"`));
      const b = await rlsCtx({ kind: 'org', org: orgB }, async (q) =>
        q(`SELECT id FROM "Task"`));
      expect(a.rows.map((x: any) => x.id)).toEqual([taskA]);
      expect(b.rows.map((x: any) => x.id)).toEqual([taskB]);
    });

    it('GUC vazio ou ausente → fail-closed, 0 linhas', async () => {
      for (const mode of ['empty', 'absent'] as const) {
        const r = await rlsCtx({ kind: mode } as never, async (q) => q(`SELECT id FROM "Task"`));
        expect(r.rows).toHaveLength(0);
      }
    });

    it('AgentMemory é escopo de USUÁRIO: user A vê, user B não', async () => {
      const a = await rlsCtx({ kind: 'user', user: userA }, async (q) =>
        q(`SELECT id FROM "AgentMemory"`));
      const b = await rlsCtx({ kind: 'user', user: userB }, async (q) =>
        q(`SELECT id FROM "AgentMemory"`));
      expect(a.rows).toHaveLength(1);
      expect(b.rows).toHaveLength(0);
    });

    it('escrita cross-tenant é fail-closed: INSERT de outra org é rejeitado; UPDATE afeta 0 linhas', async () => {
      const foreignId = uuidv4();
      // PG rejeita o INSERT (violação WITH CHECK → erro 42501), não devolve 0 linhas.
      const ins = await rlsCtx({ kind: 'org', org: orgA }, async (q) =>
        q(
          `INSERT INTO "Task" (id, "organizationId", "userId", title)
           VALUES ($1,$2,$3,'invasao') RETURNING id`,
          [foreignId, orgB, userB],
        )).then(
        (r) => ({ ok: true as const, rows: r.rows.length }),
        (e: { code?: string; message?: string }) => ({ ok: false as const, code: e.code, message: e.message }),
      );
      expect(ins.ok).toBe(false);
      expect((ins as { code?: string }).code).toBe('42501');
      // Mensagem localizada (pt) ou em inglês, conforme lc_messages do servidor
      expect((ins as { message?: string }).message).toMatch(/(row-level security|pol[íi]tica de seguran[çc]a)/i);
      // Nada foi gravado
      const none = await admin.query('SELECT id FROM "Task" WHERE id = $1', [foreignId]);
      expect(none.rows).toHaveLength(0);

      // UPDATE cross-tenant: PG filtra silenciosamente → 0 linhas afetadas
      const upd = await rlsCtx({ kind: 'org', org: orgA }, async (q) =>
        q(`UPDATE "Task" SET status = 'completed' WHERE id = $1`, [taskB]));
      expect(upd.rowCount).toBe(0);
      const after = await admin.query(`SELECT status FROM "Task" WHERE id = $1`, [taskB]);
      expect((after.rows[0] as any).status).toBe('queued');
    });
  });

  // ---------------- App path (BYPASSRLS admin, como a produção) ----------------
  describe('app path (mesmo wiring da produção: Prisma + taskQueue)', () => {
    it('ciclo de vida completo com progresso REAL (33 → 66 → 100) e evento "created"', async () => {
      await startTask(prismaAdmin, scopeA, taskA);
      const p1 = await markStep(prismaAdmin, scopeA, taskA, 0, 'done');
      expect(p1.progress).toBe(33);
      const p2 = await markStep(prismaAdmin, scopeA, taskA, 1, 'done');
      expect(p2.progress).toBe(66);
      const p3 = await markStep(prismaAdmin, scopeA, taskA, 2, 'done');
      expect(p3.progress).toBe(100);
      await completeTask(prismaAdmin, scopeA, taskA, { modelUsed: 'tq-test' });

      const detail = await getTaskDetail(prismaAdmin, scopeA, taskA);
      expect(detail?.status).toBe('completed');
      expect(detail?.progress).toBe(100);
      expect(detail?.modelUsed).toBe('tq-test');
      expect(detail?.completedAt).toBeInstanceOf(Date);
      expect(detail?.events.map((e) => e.type)).toContain('created');

      const listA = await listTasks(prismaAdmin, scopeA);
      expect(listA.map((t) => t.id)).toContain(taskA);
      expect(listA.find((t) => t.id === taskA)?.status).toBe('completed');
    });

    it('isolamento de tenant no app path: org B não vê tarefa de A', async () => {
      const listB = await listTasks(prismaAdmin, scopeB);
      expect(listB.map((t) => t.id)).not.toContain(taskA);
      expect(listB.map((t) => t.id)).toContain(taskB);
    });

    it('cancela tarefa aberta preservando histórico', async () => {
      await startTask(prismaAdmin, scopeB, taskB);
      await markStep(prismaAdmin, scopeB, taskB, 0, 'done');
      await cancelTask(prismaAdmin, scopeB, taskB, 'cancel de staging');
      const detail = await getTaskDetail(prismaAdmin, scopeB, taskB);
      expect(detail?.status).toBe('canceled');
    });

    it('AgentMemory upsert + list (escopo tenant+usuário)', async () => {
      await saveMemory(prismaAdmin, scopeA, 'decision', 'tq-key', { v: 2 });
      const mem = await listMemory(prismaAdmin, scopeA, 10);
      const hit = mem.find((m) => m.key === 'tq-key');
      expect(hit?.value).toEqual({ v: 2 });
      const noneB = await listMemory(prismaAdmin, scopeB, 10);
      expect(noneB.find((m) => m.key === 'tq-key')).toBeUndefined();
    });
  });
});
