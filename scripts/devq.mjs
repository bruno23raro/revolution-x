// uso: node devq.mjs "SQL" — roda SQL no DEV Supabase com senha nova
import pg from 'pg';
const pw = process.env.DEVPW;
const host = process.argv[3] || 'db.urdmpzjycwywsjzhpntc.supabase.co';
const c = new pg.Client({ host, port: 5432, user: 'postgres', password: pw, database: 'postgres', ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
try {
  await c.connect();
  const r = await c.query(process.argv[2]);
  console.log(JSON.stringify(r.rows, null, 1));
} catch (e) { console.log('ERR:', e.message); process.exitCode = 1; } finally { await c.end().catch(() => {}); }
