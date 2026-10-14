import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load ONLY .env.test (isolated local test DB). Never DATABASE_URL/DIRECT_URL
// (Supabase production) so assertions run as the restricted revx_test role.
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL;
const RLS_URL = process.env.TEST_RLS_DATABASE_URL;

type R = { rows: any[]; rowCount: number | null };

let admin: Pool; // preparation + scoped cleanup ONLY (superuser/BYPASSRLS)
let rls: Pool; // every RLS assertion (restricted revx_test)

const MIGRATION_009 = path.resolve(
  __dirname,
  '../../supabase/migrations/009_b4_session_billing.sql'
);

async function adminQ(pool: Pool, sql: string, params: unknown[] = []): Promise<R> {
  const raw = await pool.query(sql, params as any[]);
  return raw as unknown as R;
}

// Runs a callback under tenant + user context using the RESTRICTED role.
//  - org:  set app.current_org to a specific UUID ('' = empty, 'absent' = unset)
//  - user: set app.current_user_id to a specific UUID ('' = empty, 'absent' = unset)
type Ctx = {
  org?: { kind: 'org'; id: string } | { kind: 'empty' } | { kind: 'absent' };
  user?: { kind: 'user'; id: string } | { kind: 'empty' } | { kind: 'absent' };
};
type QueryFn = (sql: string, params?: unknown[]) => Promise<R>;

async function withCtx<T>(ctx: Ctx, fn: (q: QueryFn) => Promise<T>): Promise<T> {
  const c = await rls.connect();
  const q: QueryFn = async (sql, params) => {
    const raw = await c.query(sql, (params ?? []) as any[]);
    return raw as unknown as R;
  };
  try {
    await c.query('BEGIN');
    if (ctx.org && ctx.org.kind === 'org') {
      await c.query(`SELECT set_config('app.current_org', $1, true)`, [ctx.org.id]);
    } else if (ctx.org && ctx.org.kind === 'empty') {
      await c.query(`SELECT set_config('app.current_org', '', true)`);
    }
    if (ctx.user && ctx.user.kind === 'user') {
      await c.query(`SELECT set_config('app.current_user_id', $1, true)`, [ctx.user.id]);
    } else if (ctx.user && ctx.user.kind === 'empty') {
      await c.query(`SELECT set_config('app.current_user_id', '', true)`);
    }
    try {
      return await fn(q);
    } finally {
      try {
        await c.query('ROLLBACK');
      } catch {
        /* connection already aborted */
      }
    }
  } finally {
    c.release();
  }
}

// Minimal, FK-free tables the 009 policies act on. RLS does not need the
// foreign keys; keeping them out makes the scaffold self-contained on the
// isolated test DB regardless of whether Organization/User exist there.
async function ensureTables(pool: Pool): Promise<void> {
  await adminQ(pool, `CREATE TABLE IF NOT EXISTS "Session" (
    "id"             UUID PRIMARY KEY,
    "userId"         UUID NOT NULL,
    "organizationId" UUID,
    "tokenHash"      VARCHAR(255) NOT NULL
  )`);
  await adminQ(pool, `CREATE TABLE IF NOT EXISTS "BillingEvent" (
    "id"             UUID PRIMARY KEY,
    "organizationId" UUID,
    "eventType"      VARCHAR(100) NOT NULL
  )`);
  await adminQ(pool, `CREATE TABLE IF NOT EXISTS "Role" (
    "id"             UUID PRIMARY KEY,
    "organizationId" UUID,
    "name"           VARCHAR(100) NOT NULL
  )`);
}

beforeAll(async () => {
  if (!ADMIN_URL) throw new Error('TEST_ADMIN_DATABASE_URL must be set in .env.test');
  if (!RLS_URL) throw new Error('TEST_RLS_DATABASE_URL must be set in .env.test');
  admin = new Pool({ connectionString: ADMIN_URL, max: 2 });
  rls = new Pool({ connectionString: RLS_URL, max: 4 });
  await admin.query('SELECT 1');
  await rls.query('SELECT 1');

  // Provision tables + install the REAL 009 policies/grants against the
  // isolated DB so the assertions validate the actual corrective migration.
  await ensureTables(admin);
  const sql = fs.readFileSync(MIGRATION_009, 'utf8');
  await admin.query(sql);
});

afterAll(async () => {
  await admin?.end();
  await rls?.end();
});

describe('B4 RLS: Session (user-scoped) + BillingEvent (strict tenant) + Role (intentional NULL)', () => {
  let orgA: string;
  let orgB: string;
  let userA: string;
  let userB: string;

  beforeAll(async () => {
    orgA = uuidv4();
    orgB = uuidv4();
    userA = uuidv4();
    userB = uuidv4();
  });

  afterAll(async () => {
    // Scoped cleanup of everything this suite inserted.
    await adminQ(admin, 'DELETE FROM "Session" WHERE "userId" IN ($1,$2)', [userA, userB]);
    await adminQ(admin, 'DELETE FROM "BillingEvent" WHERE "organizationId" IN ($1,$2)', [orgA, orgB]);
    await adminQ(admin, 'DELETE FROM "Role" WHERE "organizationId" IN ($1,$2)', [orgA, orgB]);
  });

  it('precondition: restricted role is non-superuser and non-BYPASSRLS', async () => {
    const { rows } = await adminQ(rls, `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`);
    expect(rows[0].rolsuper).toBe(false);
    expect(rows[0].rolbypassrls).toBe(false);
  });

  it('009: the corrected policies are installed on the real tables', async () => {
    const { rows } = await adminQ(
      admin,
      `SELECT c.relname AS t, p.polname AS pname
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_policy p ON p.polrelid = c.oid
        WHERE n.nspname = 'public'
          AND c.relname IN ('Session','BillingEvent','Role')
          AND p.polname IN ('Session_user','BillingEvent_tenant_strict','Role_tenant')
        ORDER BY c.relname, p.polname`,
    );
    const names = rows.map((r: any) => `${r.t}:${r.pname}`).sort();
    expect(names).toEqual([
      'BillingEvent:BillingEvent_tenant_strict',
      'Role:Role_tenant',
      'Session:Session_user',
    ]);
  });

  it('1. Session: a user sees only their own sessions', async () => {
    const sA = uuidv4();
    const sB = uuidv4();
    await adminQ(admin, `INSERT INTO "Session" (id,"userId","organizationId","tokenHash") VALUES ($1,$2,$3,$4)`, [sA, userA, orgA, 'hA']);
    await adminQ(admin, `INSERT INTO "Session" (id,"userId","organizationId","tokenHash") VALUES ($1,$2,$3,$4)`, [sB, userB, orgB, 'hB']);

    // userA reads: sees only sA.
    const got = await withCtx(
      { org: { kind: 'org', id: orgA }, user: { kind: 'user', id: userA } },
      async (q) => {
        const { rows } = await q('SELECT id FROM "Session"');
        return rows.map((r: any) => r.id);
      }
    );
    expect(got).toEqual([sA]);

    // userB cannot read userA's session even under their own tenant.
    const leak = await withCtx(
      { org: { kind: 'org', id: orgB }, user: { kind: 'user', id: userB } },
      async (q) => {
        const { rowCount } = await q('SELECT id FROM "Session" WHERE id = $1', [sA]);
        return rowCount ?? 0;
      }
    );
    expect(leak).toBe(0);

    await adminQ(admin, 'DELETE FROM "Session" WHERE id IN ($1,$2)', [sA, sB]);
  });

  it('2. Session: absent/empty user context is fail-closed (0 rows)', async () => {
    const sA = uuidv4();
    await adminQ(admin, `INSERT INTO "Session" (id,"userId","organizationId","tokenHash") VALUES ($1,$2,$3,$4)`, [sA, userA, orgA, 'hA']);

    for (const ctx of [
      { org: { kind: 'org' as const, id: orgA }, user: { kind: 'absent' as const } },
      { org: { kind: 'org' as const, id: orgA }, user: { kind: 'empty' as const } },
    ]) {
      const n = await withCtx(ctx, async (q) => {
        const { rowCount } = await q('SELECT id FROM "Session"');
        return rowCount ?? 0;
      });
      expect(n).toBe(0);
    }
    await adminQ(admin, 'DELETE FROM "Session" WHERE id = $1', [sA]);
  });

  it('3. BillingEvent: a tenant sees only its own events', async () => {
    const eA = uuidv4();
    const eB = uuidv4();
    const eOrphan = uuidv4(); // NULL org — must be invisible to everyone
    await adminQ(admin, `INSERT INTO "BillingEvent" (id,"organizationId","eventType") VALUES ($1,$2,$3)`, [eA, orgA, 'x']);
    await adminQ(admin, `INSERT INTO "BillingEvent" (id,"organizationId","eventType") VALUES ($1,$2,$3)`, [eB, orgB, 'x']);
    await adminQ(admin, `INSERT INTO "BillingEvent" (id,"organizationId","eventType") VALUES ($1, NULL, $2)`, [eOrphan, 'x']);

    const got = await withCtx({ org: { kind: 'org', id: orgA } }, async (q) => {
      const { rows } = await q('SELECT id FROM "BillingEvent"');
      return rows.map((r: any) => r.id);
    });
    // Strict tenant scope: only orgA's event. Neither orgB's nor the NULL orphan.
    expect(got).toEqual([eA]);

    // orgA cannot touch orgB's event (WITH CHECK blocks UPDATE/DELETE).
    const deleted = await withCtx({ org: { kind: 'org', id: orgA } }, async (q) => {
      const { rowCount } = await q(`DELETE FROM "BillingEvent" WHERE id = $1`, [eB]);
      return rowCount ?? 0;
    });
    expect(deleted).toBe(0);
    const still = await adminQ(admin, 'SELECT 1 FROM "BillingEvent" WHERE id = $1', [eB]);
    expect(still.rowCount ?? 0).toBe(1);

    await adminQ(admin, 'DELETE FROM "BillingEvent" WHERE id IN ($1,$2,$3)', [eA, eB, eOrphan]);
  });

  it('4. BillingEvent: orphaned (NULL org) events are visible to NO tenant', async () => {
    const eOrphan = uuidv4();
    await adminQ(admin, `INSERT INTO "BillingEvent" (id,"organizationId","eventType") VALUES ($1, NULL, $2)`, [eOrphan, 'orphan']);

    for (const org of [orgA, orgB]) {
      const n = await withCtx({ org: { kind: 'org', id: org } }, async (q) => {
        const { rowCount } = await q('SELECT id FROM "BillingEvent" WHERE id = $1', [eOrphan]);
        return rowCount ?? 0;
      });
      expect(n).toBe(0);
    }
    await adminQ(admin, 'DELETE FROM "BillingEvent" WHERE id = $1', [eOrphan]);
  });

  it('5. BillingEvent: absent/empty tenant context is fail-closed', async () => {
    const eA = uuidv4();
    await adminQ(admin, `INSERT INTO "BillingEvent" (id,"organizationId","eventType") VALUES ($1,$2,$3)`, [eA, orgA, 'x']);
    for (const ctx of [
      { org: { kind: 'absent' as const } },
      { org: { kind: 'empty' as const } },
    ]) {
      const n = await withCtx(ctx, async (q) => {
        const { rowCount } = await q('SELECT id FROM "BillingEvent"');
        return rowCount ?? 0;
      });
      expect(n).toBe(0);
    }
    await adminQ(admin, 'DELETE FROM "BillingEvent" WHERE id = $1', [eA]);
  });

  it('6. Role: a NULL-org global role stays visible (intentional design)', async () => {
    const globalRole = uuidv4();
    await adminQ(admin, `INSERT INTO "Role" (id,"organizationId","name") VALUES ($1,NULL,'admin')`, [globalRole]);

    const n = await withCtx({ org: { kind: 'org', id: orgA } }, async (q) => {
      const { rowCount } = await q('SELECT id FROM "Role" WHERE id = $1', [globalRole]);
      return rowCount ?? 0;
    });
    expect(n).toBe(1); // intentional: global system roles are NULL and visible to all tenants
    await adminQ(admin, 'DELETE FROM "Role" WHERE id = $1', [globalRole]);
  });
});
