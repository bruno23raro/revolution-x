// Demo mode end-to-end test via Node.js fetch
const BASE = process.env.BASE || 'http://localhost:3002';
const cookieJar = [];

function parseCookies(setCookie) {
  if (!setCookie) return [];
  const list = resHeadersArray(setCookie);
  const out = [];
  for (const c of list) {
    const parts = c.split(';');
    const m = parts[0].match(/^([^=]+)=(.*)$/);
    if (m) out.push(`${m[1].trim()}=${m[2].trim()}`);
  }
  return out;
}

function resHeadersArray(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') return [v];
  return [];
}

async function req(method, path, body) {
  const url = BASE + path;
  const headers = { 'Content-Type': 'application/json' };
  if (cookieJar.length) headers['Cookie'] = cookieJar.join('; ');
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : resHeadersArray(res.headers.get('set-cookie'));
  for (const c of parseCookies(sc)) cookieJar.push(c);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

async function main() {
  console.log('=== DEMO LOGIN ===');
  const login = await req('POST', '/api/dev/demo-login', {});
  console.log('status', login.status);
  console.log('body', JSON.stringify(login.json).slice(0, 200));
  console.log('cookies', cookieJar);

  const paths = [
    '/api/dev/status',
    '/api/crm/contacts',
    '/api/crm/leads',
    '/api/crm/deals',
    '/api/crm/pipelines',
    '/api/growth/leads',
    '/api/growth/analytics',
    '/api/whatsapp/templates',
    '/api/whatsapp/send',
    '/api/facebook/publish',
    '/api/instagram/publish',
  ];

  console.log('\n=== ENDPOINTS ===');
  for (const p of paths) {
    const r = await req('GET', p);
    const body = r.json ? JSON.stringify(r.json).slice(0, 200) : r.text.slice(0, 200);
    console.log(`[${r.status}] ${p}  ${body}`);
  }

  // Test POST endpoints in demo mode
  console.log('\n=== POST (create) ===');
  const createLead = await req('POST', '/api/growth/leads', { metadata: { name: 'Teste Demo' }, contact: '5511999999999', source: 'demo' });
  console.log(`[${createLead.status}] POST /api/growth/leads ${JSON.stringify(createLead.json).slice(0,200)}`);

  const sendWA = await req('POST', '/api/whatsapp/send', { to: '5511999999999', message: 'Olá demo' });
  console.log(`[${sendWA.status}] POST /api/whatsapp/send ${JSON.stringify(sendWA.json).slice(0,200)}`);
}

main().catch(e => { console.error(e); process.exit(1); });
