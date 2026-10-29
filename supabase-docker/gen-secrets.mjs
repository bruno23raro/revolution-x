// Gera segredos rotacionados para o stack Supabase self-hosted local.
// ANON/SERVICE = JWT HS256 assinados com o JWT_SECRET gerado aqui (nunca reusar demo keys).
import { randomBytes, createHmac } from 'node:crypto';

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const hex = (n) => randomBytes(n).toString('hex');

function jwtHS256(secret, payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

const JWT_SECRET = hex(32);
const now = Math.floor(Date.now() / 1000);
const exp = now + 10 * 365 * 24 * 3600; // 10 anos (dev local)
const base = { aud: 'authenticated', iss: 'supabase', iat: now, exp, ref: 'local' };
const ANON_KEY = jwtHS256(JWT_SECRET, { ...base, role: 'anon' });
const SERVICE_ROLE_KEY = jwtHS256(JWT_SECRET, { ...base, role: 'service_role' });

const vars = {
  POSTGRES_PASSWORD: 'rx' + hex(24),
  JWT_SECRET,
  ANON_KEY,
  SERVICE_ROLE_KEY,
  SECRET_KEY_BASE: hex(32),
  VAULT_ENC_KEY: hex(16),
  PG_META_CRYPTO_KEY: hex(16),
  DASHBOARD_USERNAME: 'admin',
  DASHBOARD_PASSWORD: 'Rx' + hex(16) + '!',
  REALTIME_DB_ENC_KEY: hex(8), // string de 16 chars = AES-128 (realtime criptografa o jwt_secret do tenant com ela)
  S3_PROTOCOL_ACCESS_KEY_ID: 'localak' + hex(8),
  S3_PROTOCOL_ACCESS_KEY_SECRET: '.localsk' + hex(20),
};

console.log(JSON.stringify(vars, null, 2));
