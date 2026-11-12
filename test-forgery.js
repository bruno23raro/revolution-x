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
    const header = JSON.parse(Buffer.from(h.replace(/-/g,'+').replace(/_/g,'/') + '=='.repeat((4-h.length%4)%4), 'base64'));
    const payload = JSON.parse(Buffer.from(p.replace(/-/g,'+').replace(/_/g,'/') + '=='.repeat((4-p.length%4)%4), 'base64'));
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
  const h = toB64(JSON.stringify({alg:'HS256', typ:'JWT'}));
  const p = toB64(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', TEST_SECRET).update(`${h}.${p}`).digest('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  return `${h}.${p}.${sig}`;
}

function validPayload(overrides={}) {
  return {sub:DEMO_USER_ID, email:'demo@revolutionx.dev', org_id:DEMO_ORG_ID, role:'admin', is_demo:true, exp:Math.floor(Date.now()/1000)+86400, ...overrides};
}

const results = [];

// 1. Fixed signature "demodummy"
const h1 = toB64(JSON.stringify({alg:'HS256', typ:'JWT'}));
const p1 = toB64(JSON.stringify(validPayload()));
const t1 = `${h1}.${p1}.demodummy`;
results.push({name:'1. Fixed signature "demodummy"', isDemo:isDemo(t1), expected:'blocked', actual:isDemo(t1)?'allowed':'blocked', passed:!isDemo(t1)});

// 2. Wrong secret
const wrongSig = crypto.createHmac('sha256','wrong-secret-12345').update(`${h1}.${p1}`).digest('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const t2 = `${h1}.${p1}.${wrongSig}`;
results.push({name:'2. Wrong secret key', isDemo:isDemo(t2), expected:'blocked', actual:isDemo(t2)?'allowed':'blocked', passed:!isDemo(t2)});

// 3. Wrong sub
const t3 = makeToken(validPayload({sub:'real-user-123', email:'attacker@evil.com'}));
results.push({name:'3. Wrong sub in payload', isDemo:isDemo(t3), expected:'blocked', actual:isDemo(t3)?'allowed':'blocked', passed:!isDemo(t3)});

// 4. Expired token
const t4 = makeToken(validPayload({exp:Math.floor(Date.now()/1000)-3600}));
results.push({name:'4. Expired token', isDemo:isDemo(t4), expected:'blocked', actual:isDemo(t4)?'allowed':'blocked', passed:!isDemo(t4)});

// 5. Missing is_demo
const {is_demo,...p5} = validPayload();
const t5 = makeToken(p5);
results.push({name:'5. Missing is_demo field', isDemo:isDemo(t5), expected:'blocked', actual:isDemo(t5)?'allowed':'blocked', passed:!isDemo(t5)});

// 6. Invalid base64
const t6 = 'header!!.!!invalid.payload.signature';
results.push({name:'6. Invalid base64 encoding', isDemo:isDemo(t6), expected:'blocked', actual:isDemo(t6)?'allowed':'blocked', passed:!isDemo(t6)});

// Output
console.log(JSON.stringify({
  forgery_attempts: results.map(r => ({name:r.name, result:r.passed?'blocked':'allowed', passed:r.passed})),
  summary: { total: results.length, blocked: results.filter(r=>r.passed).length, allowed: results.filter(r=>!r.passed).length, all_blocked: results.every(r=>r.passed) }
}, null, 2));