import fs from 'node:fs';
import { Pool } from 'pg';
const raw = fs.readFileSync('.env.prod.local', 'utf8').split(/\r?\n/).find((l) => l.startsWith('POSTGRES_URL_NON_POOLING='));
const u = new URL(raw.slice('POSTGRES_URL_NON_POOLING='.length).trim().replace(/^["']|["']$/g, ''));
const pool = new Pool({ host: u.hostname, port: Number(u.port || 5432), user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: 'postgres', ssl: { rejectUnauthorized: false } });
const r = await pool.query("select status, phone_number, verified_name, waba_id, phone_number_id, access_token_enc is not null as token_cifrado, length(access_token_enc) as len from whatsapp_channels where organization_id='279bccee-7fab-4b05-bc65-b65ff252bd2b'");
console.log(JSON.stringify(r.rows));
await pool.end();
