// Script standalone para teste de ataques JWT
// Executar: node run-forgery-test.js
// Requer: DEMO_JWT_SECRET definido em .env.local

const crypto = require('crypto');

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000002';
const TEST_SECRET = process.env.DEMO_JWT_SECRET;

if (!TEST_SECRET) {
  console.error('ERRO: DEMO_JWT_SECRET não está definido em .env.local');
  process.exit(1);
}

function toB64(s) { return Buffer.from(s).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'); }

function verifySig(h, p, sig) {
  try {
    const expected = crypto.createHmac('sha256', TEST_SECRET).update(`${h}.${p}`).digest('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch { return false; }
}

function decode(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h, p, sig] = parts;
    if (!verifySig(h, p, sig)) return null;
    const header = JSON.parse(Buffer.from(h.replace(/-/g,'+').replace(/_/g,'/') + '==', 'base64').toString());
    const payload = JSON.parse(Buffer.from(p.replace(/-/g,'+').replace(/_/g,'/') + '==', 'base64').toString());
    return { header, payload };
  } catch { return null; }
}

function isDemo(token) {
  if (!token) return false;
  const r = decode(token);
  if (!r) return false;
  const p = r.payload;
  if (p.is_demo !== true) return false;
  if (p.sub !== DEMO_USER_ID) return false;
  if (p.org_id !== DEMO_ORG_ID) return false;
  const exp = Number(p.exp);
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now()/1000)) return false;
  return true;
}

function decodeDemo(token) {
  const r = decode(token);
  if (!r) return null;
  const p = r.payload;
  if (p.is_demo !== true || p.sub !== DEMO_USER_ID || p.org_id !== DEMO_ORG_ID) return null;
  const exp = Number(p.exp);
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now()/1000)) return null;
  return { userId: DEMO_USER_ID, email: p.email, organizationId: DEMO_ORG_ID, role: p.role || 'admin' };
}

function makeToken(payload) {
  const h = toB64(JSON.stringify({alg:'HS256',typ:'JWT'}));
  const p = toB64(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', TEST_SECRET).update(`${h}.${p}`).digest('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  return `${h}.${p}.${sig}`;
}

function validPayload(overrides={}) {
  return {sub:DEMO_USER_ID, email:'demo@revolutionx.dev', org_id:DEMO_ORG_ID, role:'admin', is_demo:true, exp:Math.floor(Date.now()/1000)+86400, ...overrides};
}

const results = [];

// 1. Fixed signature "demodummy"
const h1 = toB64(JSON.stringify({alg:'HS256',typ:'JWT'}));
const p1 = toB64(JSON.stringify(validPayload()));
const t1 = `${h1}.${p1}.demodummy`;
results.push({attack:'1_fixed_signature_demodummy', blocked:isDemo(t1), description:'Tenta usar assinatura fixa em vez de HMAC-SHA256'});

// 2. Wrong secret key
const wrongSig = crypto.createHmac('sha256','wrong-secret-12345').update(`${h1}.${p1}`).digest('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const t2 = `${h1}.${p1}.${wrongSig}`;
results.push({attack:'2_wrong_secret_key', blocked:isDemo(t2), description:'Tenta usar segredo diferente para assinatura'});

// 3. Wrong sub in payload
const t3 = makeToken(validPayload({sub:'real-user-123', email:'attacker@evil.com'}));
results.push({attack:'3_wrong_sub_in_payload', blocked:isDemo(t3), description:'Tenta usar sub diferente para representar outro usuário'});

// 4. Expired token
const t4 = makeToken(validPayload({exp:Math.floor(Date.now()/1000)-3600}));
results.push({attack:'4_expired_token', blocked:isDemo(t4), description:'Tenta usar token expirado'});

// 5. Missing is_demo field
const {is_demo,...p5} = validPayload();
const t5 = makeToken(p5);
results.push({attack:'5_missing_is_demo_field', blocked:isDemo(t5), description:'Tenta omitir campo is_demo do payload'});

// 6. Invalid base64 encoding
const t6 = 'header!!.!!invalid!!.base64!!payload.signature';
results.push({attack:'6_invalid_base64_encoding', blocked:isDemo(t6), description:'Tenta usar encoding base64 inválido'});

// Output JSON
const jsonOutput = {
  forgery_attempts: results.map(r => ({attack:r.attack, result:r.blocked?'blocked':'allowed', blocked:r.blocked, description:r.description})),
  summary: { total: results.length, blocked: results.filter(r=>r.blocked).length, allowed: results.filter(r=>!r.blocked).length, all_blocked: results.every(r=>r.blocked) }
};

console.log(JSON.stringify(jsonOutput, null, 2));