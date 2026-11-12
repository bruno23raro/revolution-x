/**
 * Teste de auditoria de segurança JWT - Ataques de forja
 */

const crypto = require('crypto');

// Constantes do demoMode.ts
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000002';
const DEMO_USER_EMAIL = 'demo@revolutionx.dev';

const TEST_SECRET = process.env.DEMO_JWT_SECRET;
if (!TEST_SECRET) {
  console.error('ERRO: DEMO_JWT_SECRET não está definido em .env.local');
  process.exit(1);
}

function toBase64Url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function verifyDemoSignature(header, payload, signature) {
  try {
    const signData = `${header}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', TEST_SECRET)
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

    if (!verifyDemoSignature(headerB64, payloadB64, signature)) {
      return null;
    }

    const headerB64Padded = headerB64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (headerB64.length % 4)) % 4);
    const header = JSON.parse(Buffer.from(headerB64Padded, 'base64').toString('utf8'));

    const payloadB64Padded = payloadB64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (payloadB64.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(payloadB64Padded, 'base64').toString('utf8'));

    return { header, payload };
  } catch {
    return null;
  }
}

function isDemoToken(token) {
  if (!token) return false;
  const result = decodeJwtPayload(token);
  if (!result) return false;
  const payload = result.payload;
  if (payload.is_demo !== true) return false;
  if (payload.sub !== DEMO_USER_ID) return false;
  if (payload.org_id !== DEMO_ORG_ID) return false;
  const exp = Number(payload.exp);
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) return false;
  return true;
}

function decodeDemoToken(token) {
  const result = decodeJwtPayload(token);
  if (!result) return null;
  const payload = result.payload;
  if (payload.is_demo !== true) return null;
  if (payload.sub !== DEMO_USER_ID) return null;
  if (payload.org_id !== DEMO_ORG_ID) return null;
  const exp = Number(payload.exp);
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) return null;

  return {
    userId: DEMO_USER_ID,
    email: typeof payload.email === 'string' ? payload.email : DEMO_USER_EMAIL,
    organizationId: DEMO_ORG_ID,
    role: 'admin', // Role fixo - não pode ser falsificado
  };
}

function makeToken(payload) {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signData = `${header}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', TEST_SECRET)
    .update(signData)
    .digest('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${header}.${encodedPayload}.${signature}`;
}

function validDemoPayload(overrides = {}) {
  return {
    sub: DEMO_USER_ID,
    email: DEMO_USER_EMAIL,
    org_id: DEMO_ORG_ID,
    role: 'admin',
    is_demo: true,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    ...overrides,
  };
}

// ============================================
// TESTES DE ATAQUES DE FORJA
// ============================================

const results = [];

// 1. Fixed signature "demodummy"
console.log('\n=== ATAQUE 1: Assinatura fixa "demodummy" ===');
{
  const toB64 = (s) => Buffer.from(s).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const header = toB64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = toB64(JSON.stringify(validDemoPayload()));
  const fakeSignature = 'demodummy';
  const forgedToken = `${header}.${payload}.${fakeSignature}`;

  const isDemo = isDemoToken(forgedToken);
  const decoded = decodeDemoToken(forgedToken);
  const actualResult = isDemo ? 'allowed' : 'blocked';

  console.log('isDemoToken:', isDemo);
  console.log('decodeDemoToken:', decoded);
  console.log('Resultado:', isDemo ? 'FALHOU - Token foi aceito!' : 'OK - Token foi bloqueado');

  results.push({
    name: '1. Fixed signature "demodummy"',
    token: forgedToken,
    isDemo,
    decoded,
    expectedResult: 'blocked',
    actualResult,
    passed: !isDemo,
    description: 'Tenta usar assinatura fixa em vez de HMAC-SHA256'
  });
}

// 2. Wrong secret
console.log('\n=== ATAQUE 2: Segredo errado (wrong secret) ===');
{
  const wrongSecret = 'wrong-secret-key-12345';
  const toB64 = (s) => Buffer.from(s).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const header = toB64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = toB64(JSON.stringify(validDemoPayload()));

  const signData = `${header}.${payload}`;
  const fakeSig = crypto
    .createHmac('sha256', wrongSecret)
    .update(signData)
    .digest('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const forgedToken = `${header}.${payload}.${fakeSig}`;

  const isDemo = isDemoToken(forgedToken);
  const decoded = decodeDemoToken(forgedToken);
  const actualResult = isDemo ? 'allowed' : 'blocked';

  console.log('isDemoToken:', isDemo);
  console.log('decodeDemoToken:', decoded);
  console.log('Resultado:', isDemo ? 'FALHOU - Token foi aceito!' : 'OK - Token foi bloqueado');

  results.push({
    name: '2. Wrong secret key',
    token: forgedToken,
    isDemo,
    decoded,
    expectedResult: 'blocked',
    actualResult,
    passed: !isDemo,
    description: 'Tenta usar segredo diferente para gerar assinatura válida'
  });
}

// 3. Wrong sub in payload
console.log('\n=== ATAQUE 3: Sub errado no payload ===');
{
  const maliciousPayload = validDemoPayload({
    sub: 'real-user-id-12345',
    email: 'attacker@evil.com'
  });
  const forgedToken = makeToken(maliciousPayload);

  const isDemo = isDemoToken(forgedToken);
  const decoded = decodeDemoToken(forgedToken);
  const actualResult = isDemo ? 'allowed' : 'blocked';

  console.log('Token com sub="real-user-id-12345"');
  console.log('isDemoToken:', isDemo);
  console.log('decodeDemoToken:', decoded);
  console.log('Resultado:', isDemo ? 'FALHOU - Token foi aceito!' : 'OK - Token foi bloqueado (sub mismatch)');

  results.push({
    name: '3. Wrong sub in payload',
    token: forgedToken,
    isDemo,
    decoded,
    expectedResult: 'blocked',
    actualResult,
    passed: !isDemo,
    description: 'Tenta usar sub diferente para representar outro usuário'
  });
}

// 4. Expired token
console.log('\n=== ATAQUE 4: Expired token (exp passed) ===');
{
  const pastExp = Math.floor(Date.now() / 1000) - 3600;
  const expiredPayload = validDemoPayload({ exp: pastExp });
  const forgedToken = makeToken(expiredPayload);

  const isDemo = isDemoToken(forgedToken);
  const decoded = decodeDemoToken(forgedToken);
  const actualResult = isDemo ? 'allowed' : 'blocked';

  console.log('Token com exp no passado:', new Date(pastExp * 1000).toISOString());
  console.log('isDemoToken:', isDemo);
  console.log('decodeDemoToken:', decoded);
  console.log('Resultado:', isDemo ? 'FALHOU - Token expirado foi aceito!' : 'OK - Token foi bloqueado (expirado)');

  results.push({
    name: '4. Expired token (exp passed)',
    token: forgedToken,
    isDemo,
    decoded,
    expectedResult: 'blocked',
    actualResult,
    passed: !isDemo,
    description: 'Tenta usar token expirado'
  });
}

// 5. Missing is_demo field
console.log('\n=== ATAQUE 5: Missing is_demo field ===');
{
  const { is_demo, ...payloadWithoutIsDemo } = validDemoPayload();
  const forgedToken = makeToken(payloadWithoutIsDemo);

  const isDemo = isDemoToken(forgedToken);
  const decoded = decodeDemoToken(forgedToken);
  const actualResult = isDemo ? 'allowed' : 'blocked';

  console.log('isDemoToken:', isDemo);
  console.log('decodeDemoToken:', decoded);
  console.log('Resultado:', isDemo ? 'FALHOU - Token foi aceito!' : 'OK - Token foi bloqueado (is_demo missing)');

  results.push({
    name: '5. Missing is_demo field',
    token: forgedToken,
    isDemo,
    decoded,
    expectedResult: 'blocked',
    actualResult,
    passed: !isDemo,
    description: 'Tenta omitir campo is_demo do payload'
  });
}

// 6. Invalid base64
console.log('\n=== ATAQUE 6: Invalid base64 encoding ===');
{
  const malformedToken = 'header!!.!!invalid!!.base64!!payload.signature';

  const isDemo = isDemoToken(malformedToken);
  const decoded = decodeDemoToken(malformedToken);
  const actualResult = isDemo ? 'allowed' : 'blocked';

  console.log('isDemoToken:', isDemo);
  console.log('decodeDemoToken:', decoded);
  console.log('Resultado:', isDemo ? 'FALHOU - Token foi aceito!' : 'OK - Token foi bloqueado (parse error)');

  results.push({
    name: '6. Invalid base64 encoding',
    token: malformedToken,
    isDemo,
    decoded,
    expectedResult: 'blocked',
    actualResult,
    passed: !isDemo,
    description: 'Tenta usar encoding base64 inválido'
  });
}

// Resumo
console.log('\n' + '='.repeat(60));
console.log('RESUMO DOS ATAQUES DE FORJA');
console.log('='.repeat(60));

let allPassed = true;
for (const result of results) {
  const status = result.passed ? 'OK' : 'FALHOU';
  console.log(`[${status}] ${result.name}`);
  if (!result.passed) {
    allPassed = false;
    console.log(`  -> Este ataque foi bem-sucedido! Token foi aceito como demo.`);
  }
}

console.log('\n' + '='.repeat(60));
if (allPassed) {
  console.log('RESULTADO: TODOS OS ATAQUES FORAM BLOQUEADOS');
  console.log('As defesas HMAC-SHA256 estão funcionando corretamente.');
} else {
  console.log('RESULTADO: FALHOU - Alguns ataques foram bem-sucedidos!');
  console.log('As defesas precisam ser revisadas.');
}
console.log('='.repeat(60));

// Output JSON
const jsonOutput = {
  forgery_attempts: results,
  summary: {
    total: results.length,
    blocked: results.filter(r => r.passed).length,
    allowed: results.filter(r => !r.passed).length,
    all_blocked: allPassed
  }
};

console.log('\n\nJSON OUTPUT:');
console.log(JSON.stringify(jsonOutput, null, 2));