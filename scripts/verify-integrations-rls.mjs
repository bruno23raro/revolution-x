// Verificação RLS da tabela `integrations` (migration 018) no banco LOCAL de
// testes RLS (revolution_x_rls_test). Uso: node scripts/verify-integrations-rls.mjs
//shortcut: verificação one-shot do turno de validação; virar jest test quando a 018 entrar na rotina de CI.
import { readFileSync } from 'fs';
import { Pool } from 'pg';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.test', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')];
    })
);

const admin = new Pool({ connectionString: env.TEST_ADMIN_DATABASE_URL, max: 2 });
const rls = new Pool({ connectionString: env.TEST_RLS_DATABASE_URL, max: 4 });

let pass = 0, fail = 0;
function check(name, ok, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
  ok ? pass++ : fail++;
}

async function main() {
  // 0) prerequisites
  const { rows: r0 } = await admin.query(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='integrations') t`
  );
  console.log('integrations table exists:', r0[0].t);
  // always re-apply fresh (test DB is disposable) so the CURRENT 018 is exercised
  await admin.query(`DROP TABLE IF EXISTS integrations`);
  {
    // Needs auth.users — check first.
    const { rows: au } = await admin.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='auth' AND table_name='users') t`
    );
    if (!au[0].t) {
      await admin.query(`CREATE SCHEMA IF NOT EXISTS auth;
        CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid());`);
      console.log('created stub auth.users (test DB only)');
    }
    const sql = readFileSync(new URL('../supabase/migrations/018_integrations_oauth.sql', import.meta.url), 'utf8');
    await admin.query(sql);
    console.log('applied migration 018 to test DB');
  }

  // ensure revx_test grants
  await admin.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON integrations TO revx_test`);

  // 1) RLS on + forced + policy present
  const { rows: r1 } = await admin.query(
    `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid='integrations'::regclass`
  );
  check('RLS enabled + FORCE', r1[0].relrowsecurity && r1[0].relforcerowsecurity);

  const { rows: r2 } = await admin.query(
    `SELECT polname, pg_get_expr(polqual, polrelid) q, pg_get_expr(polwithcheck, polrelid) w FROM pg_policy WHERE polrelid='integrations'::regclass`
  );
  check('policy exists', r2.length >= 1, r2[0] && r2[0].q);

  // 2) seed users A and B + integrations rows (admin bypasses RLS)
  const { rows: users } = await admin.query(`
    WITH a AS (INSERT INTO auth.users DEFAULT VALUES RETURNING id),
         b AS (INSERT INTO auth.users DEFAULT VALUES RETURNING id)
    SELECT a.id aid, b.id bid FROM a, b`);
  const { aid, bid } = users[0];

  await admin.query(
    `INSERT INTO integrations (user_id, channel, status, access_token, meta_account_id)
     VALUES ($1,'whatsapp','CONNECTED','enc-A','acct-A'), ($2,'whatsapp','CONNECTED','enc-B','acct-B')`,
    [aid, bid]
  );

  async function asUser(userId, fn) {
    const c = await rls.connect();
    try {
      await c.query('BEGIN');
      await c.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);
      const out = await fn((sql, p = []) => c.query(sql, p));
      await c.query('ROLLBACK');
      return out;
    } catch (e) {
      try { await c.query('ROLLBACK'); } catch {}
      throw e;
    } finally { c.release(); }
  }

  // policy must honor the GUC the app actually sets
  check("policy uses app.current_user_id", /current_user_id/.test(r2[0].q));

  const nA = await asUser(aid, async (q) =>
    (await q(`SELECT id FROM integrations`)).rowCount);
  check('user A sees own integrations row count == 1', nA === 1, `saw ${nA}`);

  const cross = await asUser(bid, async (q) =>
    (await q(`SELECT id FROM integrations WHERE meta_account_id='acct-A'`)).rowCount);
  check('user B CANNOT see user A integration', cross === 0, `saw ${cross}`);

  const ins = await asUser(bid, async (q) => {
    try {
      await q(`INSERT INTO integrations (user_id, channel, access_token) VALUES ($1,'facebook','evil')`, [aid]);
      return 'inserted';
    } catch { return 'rejected'; }
  });
  check('user B cannot INSERT for user A', ins === 'rejected', ins);

  // 3) upsert path used by the OAuth callbacks (service role = admin here)
  try {
    await admin.query(
      `INSERT INTO integrations (user_id, channel, status, access_token, meta_account_id)
       VALUES ($1,'whatsapp','CONNECTED','enc-A2','acct-A')
       ON CONFLICT (user_id, channel, meta_account_id)
       DO UPDATE SET access_token='enc-A2', status='CONNECTED', updated_at=now()`,
      [aid]
    );
    const { rows } = await admin.query(
      `SELECT access_token FROM integrations WHERE user_id=$1 AND meta_account_id='acct-A'`, [aid]
    );
    check('upsert ON CONFLICT updates in place (callback path)', rows.length === 1 && rows[0].access_token === 'enc-A2');
  } catch (e) {
    check('upsert ON CONFLICT updates in place (callback path)', false, e.message);
  }

  // cleanup seeded rows/users
  await admin.query(`DELETE FROM integrations WHERE user_id IN ($1,$2)`, [aid, bid]);
  await admin.query(`DELETE FROM auth.users WHERE id IN ($1,$2)`, [aid, bid]);

  // 3) does the real Supabase-style path work at all? (app never sets app.current_user)
  const none = await (async () => {
    const c = await rls.connect();
    try {
      await c.query('BEGIN');
      const r = (await c.query(`SELECT id FROM integrations`)).rowCount;
      await c.query('ROLLBACK');
      return r;
    } finally { c.release(); }
  })();
  check('no GUC set → zero rows (fail-closed)', none === 0, `saw ${none}`);

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exitCode = fail ? 1 : 0;
}

main().finally(() => { admin.end(); rls.end(); });
