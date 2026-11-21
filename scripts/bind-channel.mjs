import fs from 'node:fs';
import { Pool } from 'pg';

const ORG = '279bccee-7fab-4b05-bc65-b65ff252bd2b';
for (const line of fs.readFileSync('.env.prod.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const base = process.env.OPENBSP_BASE_URL.replace(/\/+$/, '');
const h = { apikey: process.env.OPENBSP_PUBLISHABLE_KEY, 'api-key': process.env.OPENBSP_API_KEY };
const res = await fetch(`${base}/organizations_addresses?service=eq.whatsapp&status=eq.connected&select=address,extra`, { headers: h });
const rows = await res.json();
const hit = rows.find((r) => r.extra?.callback_url?.includes(ORG));
if (!hit) { console.log('sem endereco conectado para a org'); process.exit(1); }
console.log('alvo: ' + hit.address + ' / ' + hit.extra.phone_number + ' / ' + hit.extra.verified_name);

const enc = await import('../src/lib/encryption.ts');
const fn = Object.keys(enc).find((k) => /^encrypt/i.test(k) && typeof enc[k] === 'function');
if (!fn) { console.log('sem funcao encrypt: ' + Object.keys(enc).join(', ')); process.exit(1); }
const tokenEnc = await enc[fn](hit.extra.access_token);
console.log('cifrado com ' + fn);

const cs = process.env.POSTGRES_URL_NON_POOLING + (process.env.POSTGRES_URL_NON_POOLING.includes('?') ? '&' : '?') + 'sslmode=no-verify';
const pool = new Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const upd = await pool.query(
  "update whatsapp_channels set status='CONNECTED', verify_token=$2, onboarding_token_id=$3, waba_id=$4, phone_number_id=$5, phone_number=$6, verified_name=$7, access_token_enc=$8, last_error=null, updated_at=now() where organization_id=$1 returning id, status, phone_number, verified_name",
  [ORG, hit.extra.verify_token, hit.extra.onboarding_token_id, hit.extra.waba_id, hit.address, hit.extra.phone_number, hit.extra.verified_name, tokenEnc],
);
console.log('DB: ' + JSON.stringify(upd.rows));
await pool.end();
