// Read-only inspection of the RLS test database. No secrets printed.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: new URL('../.env.test', import.meta.url) });
dotenv.config({ path: new URL('../.env.local', import.meta.url) });

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.log('NO_TEST_URL: TEST_DATABASE_URL is not set in .env.test/.env.local');
  process.exit(2);
}

const pool = new Pool({ connectionString: url, statement_timeout: 8000 });

try {
  const ident = await pool.query(`
    select current_user as role
  `);
  const r = ident.rows[0];
  console.log('CONNECTED role =', r.role, '| superuser =', r.is_superuser);

  // role attributes relevant to RLS
  const attrs = await pool.query(`
    select rolname, rolsuper, rolbypassrls
    from pg_roles
    where rolname = current_user
  `);
  console.log('ROLE ATTRS =', JSON.stringify(attrs.rows[0] || null));

  // does this role own the tenant tables?
  const owners = await pool.query(`
    select c.relname as table,
           (select r.rolname from pg_roles r where r.oid = c.relowner) as owner,
           c.relrowsecurity as rls_enabled,
           c.relforcerowsecurity as rls_forced
    from pg_class c
    where c.relnamespace = 'public'::regnamespace
      and c.relkind = 'r'
      and c.relname not like 'pg_%'
    order by c.relname
  `);
  console.log('\nTABLES (owner / rls_enabled / rls_forced):');
  for (const t of owners.rows) {
    console.log(`  ${t.table.padEnd(28)} owner=${t.owner} rls=${t.rls_enabled} forced=${t.relforcerowsecurity}`);
  }

  // policies per tenant table
  const pol = await pool.query(`
    select p.relname as table, pol.polname as policy, pol.polcmd
    from pg_policy pol
    join pg_class p on p.oid = pol.polrelid
    where p.relnamespace = 'public'::regnamespace
    order by p.relname, pol.polname
  `);
  console.log('\nPOLICIES (polcmd: ALL=*, SELECT=r, UPDATE=u, DELETE=d, INSERT=a):');
  for (const p of pol.rows) {
    console.log(`  ${p.table.padEnd(28)} ${p.policy.padEnd(28)} cmd=${p.polcmd}`);
  }
} catch (e) {
  console.log('INSPECT_ERROR:', e.message);
} finally {
  await pool.end();
}
