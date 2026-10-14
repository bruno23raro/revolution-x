// Applies setup_test_db.sql to the LOCAL, ISOLATED test database ONLY.
// Connects as the ADMIN role (TEST_ADMIN_DATABASE_URL / postgres, BYPASSRLS)
// because that is the only role permitted to create tables, alter roles and
// grant privileges. Prints NO credentials; only host/port/db identity.
//
// Usage: node scripts/apply-rls-setup.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
const { Pool } = require('pg');
const { readFileSync } = require('node:fs');
const { fileURLToPath } = require('node:url');
const path = require('node:path');

dotenv.config({ path: new URL('../.env.test', import.meta.url) });

const url = process.env.TEST_ADMIN_DATABASE_URL;
if (!url) {
  console.log('NO_ADMIN_URL: TEST_ADMIN_DATABASE_URL is not set in .env.test');
  process.exit(2);
}

// Confirm target identity without printing the credential portion.
try {
  const u = new URL(url);
  console.log('TARGET host=', u.hostname, '| port=', u.port || '5432', '| db=', u.pathname.replace(/^\/$/, ''));
} catch {
  console.log('TARGET: (could not parse TEST_ADMIN_DATABASE_URL as URL)');
}

const here = path.dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(path.join(here, '..', 'setup_test_db.sql'), 'utf8');

const pool = new Pool({ connectionString: url });

try {
  await pool.query(sql);
  console.log('\nAPPLIED setup_test_db.sql (idempotent, non-destructive)');

  const conf = await pool.query(
    `SELECT c.relname AS t, c.relforcerowsecurity AS forced,
            (SELECT r.rolname FROM pg_roles r WHERE r.oid = c.relowner) AS owner
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname IN ('Contact','Organization')
      ORDER BY c.relname`
  );
  console.log('POST-APPLY tables:', JSON.stringify(conf.rows));

  const grants = await pool.query(
    `SELECT has_table_privilege('revx_test', '"Contact"', 'SELECT')  AS c_sel,
            has_table_privilege('revx_test', '"Contact"', 'INSERT')  AS c_ins,
            has_table_privilege('revx_test', '"Organization"', 'SELECT') AS o_sel`
  );
  console.log('revx_test grants:', JSON.stringify(grants.rows[0]));

  const pol = await pool.query(
    `SELECT p.relname AS t, pol.polname,
            coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid) IS NOT NULL, false) AS has_with_check
       FROM pg_policy pol
       JOIN pg_class p ON p.oid = pol.polrelid
      WHERE p.relnamespace = 'public'::regnamespace
        AND p.relname IN ('Contact','Organization')
      ORDER BY p.relname, pol.polname`
  );
  console.log('policies:', JSON.stringify(pol.rows));
} catch (e) {
  console.log('APPLY_ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
