import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load ONLY .env.test — it now carries BOTH connection URLs under explicit,
// distinct names. There is no collision and no silent fallback to
// DATABASE_URL/DIRECT_URL (Supabase production), so the RLS assertions can
// never accidentally run as the BYPASSRLS admin role.
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL;
const RLS_URL = process.env.TEST_RLS_DATABASE_URL;

// A minimal, version-agnostic shape for query results. The installed pg type
// definitions in this project do not consistently expose `rowCount` (or the
// `PoolClient` name), so we normalize results to a shape we control.
type R = { rows: any[]; rowCount: number | null };

let admin: Pool; // preparation + scoped cleanup ONLY (superuser/BYPASSRLS)
let rls: Pool; // every RLS assertion (restricted revx_test)

beforeAll(async () => {
  if (!ADMIN_URL) throw new Error('TEST_ADMIN_DATABASE_URL must be set in .env.test');
  if (!RLS_URL) throw new Error('TEST_RLS_DATABASE_URL must be set in .env.test');
  admin = new Pool({ connectionString: ADMIN_URL, max: 2 });
  rls = new Pool({ connectionString: RLS_URL, max: 4 });
  await admin.query('SELECT 1');
  await rls.query('SELECT 1');
});

afterAll(async () => {
  await admin?.end();
  await rls?.end();
});

async function adminQ(pool: Pool, sql: string, params: unknown[] = []): Promise<R> {
  const raw = await pool.query(sql, params as any[]);
  return raw as unknown as R;
}

// Runs a callback under a tenant context using the RESTRICTED role.
//  - 'org'    : set app.current_org to a specific UUID
//  - 'empty'  : set app.current_org to '' (must be handled fail-closed, no error)
//  - 'absent' : leave the GUC unset (must be handled fail-closed, no error)
// `q` is a normalized query helper (rows + rowCount). The statement runs in a
// transaction that is always rolled back, so any successful write is undone;
// the admin pool performs the authoritative cleanup instead.
type CtxMode = { kind: 'org'; org: string } | { kind: 'empty' } | { kind: 'absent' };
type QueryFn = (sql: string, params?: unknown[]) => Promise<R>;

async function withCtx<T>(mode: CtxMode, fn: (q: QueryFn) => Promise<T>): Promise<T> {
  const c = await rls.connect();
  const q: QueryFn = async (sql, params) => {
    const raw = await c.query(sql, (params ?? []) as any[]);
    return raw as unknown as R;
  };
  try {
    await c.query('BEGIN');
    if (mode.kind === 'org') {
      await c.query(`SELECT set_config('app.current_org', $1, true)`, [mode.org]);
    } else if (mode.kind === 'empty') {
      await c.query(`SELECT set_config('app.current_org', '', true)`);
    }
    // 'absent' -> do nothing; current_setting(..., TRUE) returns NULL
    try {
      return await fn(q);
    } finally {
      // Always end the transaction so the connection is returned to the pool
      // clean. A RLS violation aborts the transaction; without this ROLLBACK
      // the next BEGIN on a recycled connection fails with "transaction
      // aborted". We never commit here — admin performs the real cleanup.
      try {
        await c.query('ROLLBACK');
      } catch {
        /* connection already aborted/closed */
      }
    }
  } finally {
    c.release();
  }
}

describe('RLS Tenant Isolation (restricted role vs real PostgreSQL)', () => {
  let orgA: string;
  let orgB: string;

  beforeAll(async () => {
    orgA = uuidv4();
    orgB = uuidv4();
    // Seed the two tenant organizations via the admin role only.
    await adminQ(admin, `INSERT INTO "Organization" (id, name, slug) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`, [
      orgA,
      'Org A',
      `a_${uuidv4().slice(0, 8)}`,
    ]);
    await adminQ(admin, `INSERT INTO "Organization" (id, name, slug) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`, [
      orgB,
      'Org B',
      `b_${uuidv4().slice(0, 8)}`,
    ]);
  });

  afterAll(async () => {
    // Scoped cleanup: delete only the orgs this suite created (cascades contacts).
    await adminQ(admin, 'DELETE FROM "Contact" WHERE "organizationId" IN ($1, $2)', [orgA, orgB]);
    await adminQ(admin, 'DELETE FROM "Organization" WHERE id IN ($1, $2)', [orgA, orgB]);
  });

  it('precondition: the RLS role is non-superuser and non-BYPASSRLS', async () => {
    const { rows } = await adminQ(rls, `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`);
    expect(rows[0].rolsuper).toBe(false);
    expect(rows[0].rolbypassrls).toBe(false);
  });

  it('1. org A reads its own contacts (restricted role)', async () => {
    const c1 = uuidv4();
    const c2 = uuidv4();
    await adminQ(admin, `INSERT INTO "Contact" (id, "organizationId", name, email) VALUES ($1,$2,$3,$4)`, [
      c1,
      orgA,
      'A1',
      'a1@x.test',
    ]);
    await adminQ(admin, `INSERT INTO "Contact" (id, "organizationId", name, email) VALUES ($1,$2,$3,$4)`, [
      c2,
      orgA,
      'A2',
      'a2@x.test',
    ]);
    const out = await withCtx({ kind: 'org', org: orgA }, async (q) => {
      const { rows } = await q('SELECT id FROM "Contact" ORDER BY name');
      return rows.map((r) => r.id).sort();
    });
    expect(out).toEqual([c1, c2].sort());
    await adminQ(admin, 'DELETE FROM "Contact" WHERE id IN ($1, $2)', [c1, c2]);
  });

  it('2. org A cannot read org B contacts', async () => {
    const cB = uuidv4();
    await adminQ(admin, `INSERT INTO "Contact" (id, "organizationId", name) VALUES ($1,$2,$3)`, [
      cB,
      orgB,
      'B1',
    ]);
    const n = await withCtx({ kind: 'org', org: orgA }, async (q) => {
      const { rowCount } = await q('SELECT id FROM "Contact" WHERE id = $1', [cB]);
      return rowCount ?? 0;
    });
    expect(n).toBe(0);
    await adminQ(admin, 'DELETE FROM "Contact" WHERE id = $1', [cB]);
  });

  it('3. restricted INSERT to another org is rejected by WITH CHECK', async () => {
    await expect(
      withCtx({ kind: 'org', org: orgA }, async (q) => {
        await q(`INSERT INTO "Contact" (id, "organizationId", name) VALUES ($1,$2,$3)`, [
          uuidv4(),
          orgB,
          'evil',
        ]);
      })
    ).rejects.toThrow();
  });

  it('4. UPDATE moving a record to another org is rejected', async () => {
    const cA = uuidv4();
    await adminQ(admin, `INSERT INTO "Contact" (id, "organizationId", name) VALUES ($1,$2,$3)`, [
      cA,
      orgA,
      'move-me',
    ]);
    await expect(
      withCtx({ kind: 'org', org: orgA }, async (q) => {
        await q(`UPDATE "Contact" SET "organizationId" = $1 WHERE id = $2`, [orgB, cA]);
      })
    ).rejects.toThrow();
    await adminQ(admin, 'DELETE FROM "Contact" WHERE id = $1', [cA]);
  });

  it('5. DELETE of another org record affects 0 rows', async () => {
    const cB = uuidv4();
    await adminQ(admin, `INSERT INTO "Contact" (id, "organizationId", name) VALUES ($1,$2,$3)`, [
      cB,
      orgB,
      'keep-me',
    ]);
    const res = await withCtx({ kind: 'org', org: orgA }, async (q) => {
      const { rowCount } = await q(`DELETE FROM "Contact" WHERE id = $1`, [cB]);
      return rowCount ?? 0;
    });
    expect(res).toBe(0);
    // The row must still exist (admin view).
    const still = await adminQ(admin, 'SELECT 1 FROM "Contact" WHERE id = $1', [cB]);
    expect(still.rowCount ?? 0).toBe(1);
    await adminQ(admin, 'DELETE FROM "Contact" WHERE id = $1', [cB]);
  });

  it('6. absent tenant context grants no access', async () => {
    const cA = uuidv4();
    await adminQ(admin, `INSERT INTO "Contact" (id, "organizationId", name) VALUES ($1,$2,$3)`, [
      cA,
      orgA,
      'x',
    ]);
    const n = await withCtx({ kind: 'absent' }, async (q) => {
      const { rowCount } = await q('SELECT id FROM "Contact"');
      return rowCount ?? 0;
    });
    expect(n).toBe(0);
    await adminQ(admin, 'DELETE FROM "Contact" WHERE id = $1', [cA]);
  });

  it('7. empty tenant context is fail-closed and error-free', async () => {
    const cA = uuidv4();
    await adminQ(admin, `INSERT INTO "Contact" (id, "organizationId", name) VALUES ($1,$2,$3)`, [
      cA,
      orgA,
      'x',
    ]);
    // With the NULLIF guard, an empty context yields 0 rows and NO cast error.
    // (The old unguarded policy would throw: invalid input syntax for uuid.)
    const n = await withCtx({ kind: 'empty' }, async (q) => {
      const { rowCount } = await q('SELECT id FROM "Contact"');
      return rowCount ?? 0;
    });
    expect(n).toBe(0);
    await adminQ(admin, 'DELETE FROM "Contact" WHERE id = $1', [cA]);
  });

  it('8. FORCE ROW LEVEL SECURITY is enabled on the tenant tables', async () => {
    const { rows } = await adminQ(
      admin,
      `SELECT c.relname AS t, c.relforcerowsecurity AS forced
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname IN ('Contact','Organization')
        ORDER BY c.relname`
    );
    expect(rows.length).toBe(2);
    for (const r of rows) expect(r.forced).toBe(true);
  });

  it('9. restricted role has DML grants yet cannot bypass RLS', async () => {
    const { rows } = await adminQ(
      admin,
      `SELECT
         has_table_privilege('revx_test', '"Contact"', 'SELECT')  AS sel,
         has_table_privilege('revx_test', '"Contact"', 'INSERT')  AS ins,
         has_table_privilege('revx_test', '"Contact"', 'UPDATE')  AS upd,
         has_table_privilege('revx_test', '"Contact"', 'DELETE')  AS del`
    );
    expect(rows[0]).toEqual({ sel: true, ins: true, upd: true, del: true });
    const attrs = await adminQ(admin, `SELECT rolbypassrls FROM pg_roles WHERE rolname = 'revx_test'`);
    expect(attrs.rows[0].rolbypassrls).toBe(false);

    // Even with full DML grants, a privileged-but-restricted role is still
    // blocked from another tenant's row by RLS.
    const cB = uuidv4();
    await adminQ(admin, `INSERT INTO "Contact" (id, "organizationId", name) VALUES ($1,$2,$3)`, [
      cB,
      orgB,
      'z',
    ]);
    const n = await withCtx({ kind: 'org', org: orgA }, async (q) => {
      const { rowCount } = await q('SELECT 1 FROM "Contact" WHERE id = $1', [cB]);
      return rowCount ?? 0;
    });
    expect(n).toBe(0);
    await adminQ(admin, 'DELETE FROM "Contact" WHERE id = $1', [cB]);
  });

  it('10. scoped cleanup spares pre-existing rows', async () => {
    const keep = uuidv4();
    const keepC = uuidv4();
    const wipe = uuidv4();
    const wipeC = uuidv4();
    await adminQ(admin, `INSERT INTO "Organization" (id, name, slug) VALUES ($1,$2,$3)`, [
      keep,
      'Keep',
      `k_${uuidv4().slice(0, 8)}`,
    ]);
    await adminQ(admin, `INSERT INTO "Contact" (id, "organizationId", name) VALUES ($1,$2,$3)`, [
      keepC,
      keep,
      'keep-contact',
    ]);
    await adminQ(admin, `INSERT INTO "Organization" (id, name, slug) VALUES ($1,$2,$3)`, [
      wipe,
      'Wipe',
      `w_${uuidv4().slice(0, 8)}`,
    ]);
    await adminQ(admin, `INSERT INTO "Contact" (id, "organizationId", name) VALUES ($1,$2,$3)`, [
      wipeC,
      wipe,
      'wipe-contact',
    ]);

    // Scoped cleanup targets ONLY `wipe` (the pattern the suite's afterAll uses).
    await adminQ(admin, 'DELETE FROM "Contact" WHERE "organizationId" IN ($1)', [wipe]);
    await adminQ(admin, 'DELETE FROM "Organization" WHERE id IN ($1)', [wipe]);

    expect((await adminQ(admin, 'SELECT 1 FROM "Organization" WHERE id = $1', [keep])).rowCount ?? 0).toBe(1);
    expect((await adminQ(admin, 'SELECT 1 FROM "Contact" WHERE id = $1', [keepC])).rowCount ?? 0).toBe(1);
    expect((await adminQ(admin, 'SELECT 1 FROM "Organization" WHERE id = $1', [wipe])).rowCount ?? 0).toBe(0);

    // Remove what we left.
    await adminQ(admin, 'DELETE FROM "Contact" WHERE id = $1', [keepC]);
    await adminQ(admin, 'DELETE FROM "Organization" WHERE id = $1', [keep]);
  });
});
