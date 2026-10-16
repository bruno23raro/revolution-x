// Provisions the final pieces of the ISOLATED CI test database, to run AFTER
// scripts/apply-rls-setup.mjs and scripts/apply-token-rls-setup.mjs:
//
//   1. Syncs the restricted role's password with the TEST_RLS_DATABASE_URL
//      credential (in CI this binds revx_test to the workflow env value).
//      The value is NEVER printed.
//   2. Applies supabase/migrations/014_agent_task_queue.sql — Task/TaskStep/
//      TaskEvent/AgentMemory + ENABLE/FORCE RLS + hardened policies + guarded
//      revx_test grants. Idempotent and non-destructive.
//
// Connects as the ADMIN role (TEST_ADMIN_DATABASE_URL, BYPASSRLS) — the only
// role permitted to ALTER ROLE and create tables. Prints NO credentials;
// only host/port/db identity.
//
// Usage: node scripts/provision-ci-test-db.mjs

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
const { Pool } = require('pg');
const { readFileSync } = require('node:fs');
const { fileURLToPath } = require('node:url');
const path = require('node:path');

dotenv.config({ path: new URL('../.env.test', import.meta.url) });

const adminUrl = process.env.TEST_ADMIN_DATABASE_URL;
if (!adminUrl) {
  console.log('NO_ADMIN_URL: TEST_ADMIN_DATABASE_URL is not set in .env.test');
  process.exit(2);
}

// Confirm target identity without printing the credential portion.
try {
  const u = new URL(adminUrl);
  console.log('TARGET host=', u.hostname, '| port=', u.port || '5432', '| db=', u.pathname.replace(/^\/$/, ''));
} catch {
  console.log('TARGET: (could not parse TEST_ADMIN_DATABASE_URL as URL)');
}

const here = path.dirname(fileURLToPath(import.meta.url));
const sql14 = readFileSync(path.join(here, '..', 'supabase', 'migrations', '014_agent_task_queue.sql'), 'utf8');

const pool = new Pool({ connectionString: adminUrl });

async function run(sql) {
  await pool.query(sql);
}

try {
  // ── 1. Sync restricted-role password from TEST_RLS_DATABASE_URL ───────────
  // Only the dedicated test role revx_test is ever altered, and the password
  // is injected from the URL without being printed.
  const rlsUrl = process.env.TEST_RLS_DATABASE_URL;
  if (rlsUrl) {
    let ru;
    try {
      ru = new URL(rlsUrl);
    } catch {
      console.log('SKIP role sync: TEST_RLS_DATABASE_URL is not a parseable URL');
      ru = null;
    }
    if (ru && ru.username !== 'revx_test') {
      console.log('SKIP role sync: TEST_RLS_DATABASE_URL must use the revx_test role');
    } else if (ru && ru.password) {
      await run(`DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'revx_test') THEN
            RAISE EXCEPTION 'role revx_test is missing (run scripts/apply-rls-setup.mjs first)';
          END IF;
        END
        $$`);
      await run(`ALTER ROLE "revx_test" PASSWORD '${ru.password.replace(/'/g, "''")}'`);
      console.log('SYNC role revx_test password from TEST_RLS_DATABASE_URL (value not printed)');
    } else {
      console.log('SKIP role sync: TEST_RLS_DATABASE_URL has no password');
    }
  } else {
    console.log('SKIP role sync: TEST_RLS_DATABASE_URL not set');
  }

  // ── 2. Apply migration 014 (agent task queue) ─────────────────────────────
  await run(sql14);
  console.log('APPLIED 014_agent_task_queue.sql (idempotent, non-destructive)');

  // ── 3. Post-apply verification (identity only) ────────────────────────────
  const conf = await pool.query(
    `SELECT c.relname AS t, c.relforcerowsecurity AS forced
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname IN ('Task','TaskStep','TaskEvent','AgentMemory')
      ORDER BY c.relname`
  );
  console.log('POST-APPLY tables:', JSON.stringify(conf.rows));

  const grants = await pool.query(
    `SELECT has_table_privilege('revx_test', '"Task"', 'SELECT')        AS t_sel,
            has_table_privilege('revx_test', '"Task"', 'INSERT')        AS t_ins,
            has_table_privilege('revx_test', '"AgentMemory"', 'SELECT') AS a_sel`
  );
  console.log('revx_test grants:', JSON.stringify(grants.rows[0]));

  const pol = await pool.query(
    `SELECT tablename, policyname
       FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN ('Task','TaskStep','TaskEvent','AgentMemory')
      ORDER BY tablename, policyname`
  );
  console.log('policies:', JSON.stringify(pol.rows));
} catch (e) {
  console.log('APPLY_ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
