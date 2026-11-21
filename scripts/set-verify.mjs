import fs from 'node:fs';
import { Pool } from 'pg';
const ORG = process.argv[2];
const VT = process.argv[3];
const raw = fs.readFileSync('.env.prod.local', 'utf8').split(/\r?\n/).find((l) => l.startsWith('POSTGRES_URL_NON_POOLING='));
const u = new URL(raw.slice('POSTGRES_URL_NON_POOLING='.length).trim().replace(/^["']|["']$/g, ''));
const pool = new Pool({
  host: u.hostname,
  port: Number(u.port || 5432),
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  database: u.pathname.replace(/^\//, '') || 'postgres',
  ssl: { rejectUnauthorized: false },
});
await pool.query('select 1');
console.log('conexao ok');
const r = await pool.query(
  "update whatsapp_channels set verify_token=$2, status='PENDING', last_error=null, updated_at=now() where organization_id=$1 returning id, status",
  [ORG, VT],
);
console.log('DB: ' + JSON.stringify(r.rows));
await pool.end();
