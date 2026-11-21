import fs from 'node:fs';
import { Pool } from 'pg';
const ORG = process.argv[2];
const VT = process.argv[3];
const raw = fs.readFileSync('.env.prod.local', 'utf8').split(/\r?\n/).find((l) => l.startsWith('POSTGRES_URL_NON_POOLING='));
const cs = raw.replace('POSTGRES_URL_NON_POOLING=', '').trim().replace(/^["']|["']$/g, '') + '?sslmode=no-verify';
const pool = new Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const r = await pool.query(
  "update whatsapp_channels set verify_token=$2, status='PENDING', last_error=null, updated_at=now() where organization_id=$1 returning id, status, verify_token",
  [ORG, VT],
);
console.log('DB: ' + JSON.stringify(r.rows));
await pool.end();
