// Read-only inspection of roles, table ownership/ACLs and RLS policy definitions
// for the RLS test database. Prints NO credentials; only host/db/role identity.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: new URL('../.env.test', import.meta.url) });
dotenv.config({ path: new URL('../.env.local', import.meta.url) });

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.log('NO_TEST_URL: TEST_DATABASE_URL is not set');
  process.exit(2);
}

// Confirm target identity without printing the credential portion.
try {
  const u = new URL(url);
  console.log('TARGET host=', u.hostname, '| port=', u.port || '(default)', '| db=', u.pathname.replace(/^\/$/, ''));
} catch {
  console.log('TARGET: (could not parse TEST_DATABASE_URL as URL)');
}

const pool = new Pool({ connectionString: url, statement_timeout: 8000 });

try {
  const ident = await pool.query(
    `select current_user as role, current_database() as db,
            (inet_server_addr() is not null) as is_tcp,
            version()`
  );
  const i = ident.rows[0];
  console.log('\nCURRENT DATABASE =', i.db, '| connected role =', i.role, '| tcp =', i.is_tcp);
  console.log('SERVER =', String(i.version).split(' on ')[0]);

  // All non-internal roles with RLS-relevant attributes
  const roles = await pool.query(`
    select rolname, rolsuper, rolbypassrls, rolcanlogin, rolcreatedb
    from pg_roles
    where rolname not like 'pg\_%'
    order by rolname
  `);
  console.log('\nROLES (rolsuper / rolbypassrls / rolcanlogin / rolcreatedb):');
  for (const r of roles.rows) {
    console.log(
      `  ${String(r.rolname).padEnd(20)} super=${r.rolsuper} bypassrls=${r.rolbypassrls} login=${r.rolcanlogin} createdb=${r.rolcreatedb}`
    );
  }

  // Owners + ACL for the tables of interest
  const owners = await pool.query(`
    select c.relname as table,
           (select r.rolname from pg_roles r where r.oid = c.relowner) as owner,
           c.relrowsecurity as rls_enabled,
           c.relforcerowsecurity as rls_forced,
           c.relacl as acl
    from pg_class c
    where c.relnamespace = 'public'::regnamespace
      and c.relkind = 'r'
      and c.relname in ('Contact','Organization','contacts','organizations')
    order by c.relname
  `);
  console.log('\nTARGET TABLES (owner / rls / forced / acl):');
  for (const t of owners.rows) {
    console.log(`  ${t.table.padEnd(14)} owner=${t.owner} rls=${t.rls_enabled} forced=${t.rls_forced}`);
    console.log(`  ${' '.repeat(16)} acl=${t.acl ?? '(default)'}`);
  }

  // Full policy definitions (permissive / USING / WITH CHECK)
  const pol = await pool.query(`
    select p.relname as table, pol.polname, pol.polcmd,
           pol.polpermissive,
           coalesce(pg_get_expr(pol.polqual, pol.polrelid), '(none)')        as using_expr,
           coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '(none)')  as with_check
    from pg_policy pol
    join pg_class p on p.oid = pol.polrelid
    where p.relnamespace = 'public'::regnamespace
      and p.relname in ('Contact','Organization','contacts','organizations')
    order by p.relname, pol.polname
  `);
  console.log('\nPOLICIES (permissive / USING / WITH CHECK):');
  for (const p of pol.rows) {
    console.log(`  [${p.table}] ${p.policy} cmd=${p.polcmd} permissive=${p.polpermissive}`);
    console.log(`      USING      = ${p.using_expr}`);
    console.log(`      WITH CHECK = ${p.with_check}`);
  }

  // Does the GUC default exist / have a default value?
  const guc = await pool.query(`
    select name, setting, source
    from pg_settings
    where name = 'app.current_org'
  `);
  console.log('\nGUC app.current_org:');
  if (guc.rows.length === 0) {
    console.log('  (not defined as a custom GUC yet — current_setting(..., TRUE) will return NULL)');
  } else {
    for (const g of guc.rows) console.log(`  ${g.name} = ${JSON.stringify(g.setting)} source=${g.source}`);
  }

  // Authentication method for local TCP (does revx_test need a password?)
  const hba = await pool.query(`
    select type,
           coalesce(array_to_string(user_name, ','), '(all)')    as users,
           coalesce(array_to_string(database, ','), '(all)')    as dbs,
           auth_method,
           coalesce(address, '(n/a)')                          as address
    from pg_hba_file_rules
    where error is null
    order by rule_number
  `);
  console.log('\npg_hba rules (type / users / dbs / auth_method / address):');
  for (const h of hba.rows) {
    console.log(`  ${String(h.type).padEnd(8)} users=[${h.users}] dbs=[${h.dbs}] auth=${h.auth_method} addr=${h.address}`);
  }

  // Does the restricted role have a password set?
  const pw = await pool.query(`
    select rolname, rolpassword is not null as has_password
    from pg_authid where rolname in ('revx_test','postgres')
    order by rolname
  `);
  console.log('\nPassword-set status:');
  for (const r of pw.rows) console.log(`  ${r.rolname.padEnd(12)} has_password=${r.has_password}`);
} catch (e) {
  console.log('INSPECT_ERROR:', e.message);
} finally {
  await pool.end();
}
