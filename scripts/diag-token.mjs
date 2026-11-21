import fs from 'node:fs';
import { Pool } from 'pg';
const ORG = '279bccee-7fab-4b05-bc65-b65ff252bd2b';
const raw = fs.readFileSync('.env.prod.local', 'utf8').split(/\r?\n/).find((l) => l.startsWith('POSTGRES_URL_NON_POOLING='));
const u = new URL(raw.slice('POSTGRES_URL_NON_POOLING='.length).trim().replace(/^["']|["']$/g, ''));
const pool = new Pool({ host: u.hostname, port: Number(u.port || 5432), user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: 'postgres', ssl: { rejectUnauthorized: false } });
const r = await pool.query('select verify_token, status, onboarding_token_id from whatsapp_channels where organization_id=$1', [ORG]);
const dbToken = r.rows[0]?.verify_token ?? '';
console.log('DB status: ' + r.rows[0]?.status);
console.log('DB token  : [' + dbToken + '] len=' + dbToken.length);

const base = 'https://nheelwshzbgenpavwhcy.supabase.co/rest/v1';
const h = { apikey: 'sb_publishable_jS_LQSbttNz2nRyAcjOVUw_J1KpXhUd', 'api-key': 'sk_dcca9cc0057142ce95bba1e051b01699' };
const res = await fetch(base + '/organizations_addresses?service=eq.whatsapp&status=eq.connected&select=address,extra', { headers: h });
const rows = await res.json();
for (const row of rows) {
  const t = row.extra?.verify_token ?? '';
  console.log('addr ' + row.address + ' token=[' + t + '] len=' + t.length + ' match=' + (t === dbToken));
}
await pool.end();
