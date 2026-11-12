const crypto = require('crypto');

// DEMO_JWT_SECRET é obrigatório (sem fallback) para testes de segurança
const DEMO_JWT_SECRET = process.env.DEMO_JWT_SECRET;

if (!DEMO_JWT_SECRET) {
  console.error('ERRO: DEMO_JWT_SECRET não está definido em .env.local');
  process.exit(1);
}

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000002';

function toBase64Url(str) {
  return Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function verifyDemoSignature(headerB64, payloadB64, signature, secret) {
  try {
    const signData = `${headerB64}.${payloadB64}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signData)
      .digest('base64')
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signature] = parts;

    // Verificar assinatura HMAC-SHA256 primeiro
    if (!verifyDemoSignature(headerB64, payloadB64, signature, DEMO_JWT_SECRET)) {
      return { verified: false };
    }

    const headerB64Padded = headerB64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (headerB64.length % 4)) % 4);
    const payloadB64Padded = payloadB64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (payloadB64.length % 4)) % 4);
    const header = JSON.parse(Buffer.from(headerB64Padded, 'base64').toString('utf8'));
    const payload = JSON.parse(Buffer.from(payloadB64Padded, 'base64').toString('utf8'));

    return { header, payload };
  } catch {
    return null;
  }
}

function isDemoToken(token) {
  if (!token) return false;
  const result = decodeJwtPayload(token, DEMO_JWT_SECRET);
  if (!result || !result.verified) return false;
  const payload = result.payload;
  if (payload.is_demo !== true) return false;
  if (payload.sub !== DEMO_USER_ID) return false;
  if (payload.org_id !== DEMO_ORG_ID) return false;
  const exp = Number(payload.exp);
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) return false;
  return true;
}

// Test
const header = { alg: 'HS256', typ: 'JWT' };
const payload = {
  sub: DEMO_USER_ID, email: 'demo@revolutionx.dev', org_id: DEMO_ORG_ID,
  role: 'admin', is_demo: true, exp: Math.floor(Date.now() / 1000) + 86400
};

const headerB64 = toBase64Url(JSON.stringify(header));
const payloadB64 = toBase64Url(JSON.stringify(payload));
const signature = crypto.createHmac('sha256', DEMO_JWT_SECRET).update(`${headerB64}.${payloadB64}`).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

const validToken = `${headerB64}.${payloadB64}.${signature}`;
const fakeToken = `${headerB64}.${payloadB64}.fakesignature123`;

console.log('Test 1 - Token válido aceito:', isDemoToken(validToken) === true ? 'PASS' : 'FAIL');
console.log('Test 2 - Token fake rejeitado:', isDemoToken(fakeToken) === false ? 'PASS' : 'FAIL');