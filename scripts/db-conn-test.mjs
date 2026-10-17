// One-shot real connection test for the Supabase Postgres DB.
// Reads credentials from env vars (PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE).
// Prints only success/failure + error code — NEVER the password.
import pg from 'pg';

const host = process.env.PGHOST || 'db.ardpabjoepzhkpmkgwgu.supabase.co';
const port = parseInt(process.env.PGPORT || '5432', 10);
const user = process.env.PGUSER || 'postgres';
const password = process.env.PGPASSWORD || '';
const database = process.env.PGDATABASE || 'postgres';

if (!password) { console.log('RESULT: SKIP (no PGPASSWORD)'); process.exit(0); }

const pool = new pg.Pool({ host, port, user, password, database, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });

const t0 = Date.now();
try {
  const client = await pool.connect();
  const res = await client.query('SELECT now() AS now, current_user AS u, current_database() AS db');
  client.release();
  await pool.end();
  console.log(JSON.stringify({
    result: 'OK',
    ms: Date.now() - t0,
    now: res.rows[0].now,
    user: res.rows[0].u,
    db: res.rows[0].db,
    host, port
  }));
} catch (e) {
  await pool.end().catch(() => {});
  // Never log the password. Log code + message only.
  console.log(JSON.stringify({ result: 'FAIL', code: e.code, message: e.message, host, port, user }));
  process.exit(1);
}
