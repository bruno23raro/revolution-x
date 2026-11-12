#!/usr/bin/env node
/**
 * Teste do fluxo demo - Detecção automática de porta
 */
const http = require('http');

// Tentar portas na ordem: 4000 (livre), depois fallback
const PORTS = [4000, 3000, 3003];
let BASE_URL = null;

console.log('=== DEMO FLOW TEST ===\n');

// Encontrar porta disponível
async function findWorkingPort() {
  for (const port of PORTS) {
    const url = `http://127.0.0.1:${port}`;
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`${url}/api/auth/session`, { timeout: 3000 }, (res) => {
          resolve({ ok: true, status: res.statusCode, url });
        });
        req.on('error', (err) => reject(err));
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      });
      console.log(`✅ Porta ${port} responde`);
      return url;
    } catch (e) {
      console.log(`❌ Porta ${port}: ${e.message}`);
    }
  }
  throw new Error('Nenhuma porta encontrada');
}

async function runTest() {
  BASE_URL = await findWorkingPort();
  console.log(`\nUsando: ${BASE_URL}\n`);

  let sbToken = null;
  let orgId = null;

  // 1. Login demo
  console.log('1. Login demo...');
  const loginResp = await fetch(`${BASE_URL}/api/dev/demo-login`, { method: 'POST' });
  console.log('   Status:', loginResp.status);

  if (loginResp.status !== 200) {
    const err = await loginResp.text();
    console.log('   Error:', err.substring(0, 200));
    process.exit(1);
  }

  const loginData = await loginResp.json();
  console.log('   User:', loginData.user.email);

  // Extract cookies - use getSetCookie for proper multi-header handling
  const rawCookie = loginResp.headers.get('set-cookie');
  console.log('   Raw Set-Cookie:', rawCookie ? rawCookie.substring(0, 100) + '...' : 'NONE');

  if (!rawCookie) {
    console.log('   ❌ Nenhum cookie retornado!');
    process.exit(1);
  }

  // Properly split multiple cookies from Set-Cookie header
  // Format: "name1=val1; attrs..., name2=val2; attrs..."
  // We need to split on ", " that precedes a new cookie (word=pattern)
  const cookieParts = rawCookie.split(/,\s*(?=[a-zA-Z][a-zA-Z0-9:_-]*=)/);
  console.log('   Cookie parts:', cookieParts.length);

  for (const part of cookieParts) {
    // Each part is one complete cookie: "name=value; attr1; attr2"
    const [firstAttr] = part.split(';').map(s => s.trim()).filter(s => s);
    if (!firstAttr) continue;
    const eqIdx = firstAttr.indexOf('=');
    if (eqIdx <= 0) continue;
    const name = firstAttr.substring(0, eqIdx).trim();
    const value = firstAttr.substring(eqIdx + 1).trim();
    if (name === 'sb:token') sbToken = value;
    if (name === 'x-organization-id') orgId = value;
    console.log(`      Found: ${name} (${value?.substring(0, 20)}...)`);
  }

  if (!sbToken || !orgId) {
    console.log('   ❌ Cookies não encontrados!');
    process.exit(1);
  }
  console.log('   ✅ Token e Org ID obtidos');

  // 2. Check session
  console.log('\n2. Session check...');
  const sessResp = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { 'Cookie': `sb:token=${sbToken}; x-organization-id=${orgId}` }
  });
  const sessData = await sessResp.json();
  console.log('   Authenticated:', sessData.authenticated);
  console.log('   User ID:', sessData.user?.id ? sessData.user.id.substring(0, 8) + '...' : 'null');
  console.log('   Organization ID:', sessData.organizationId ? sessData.organizationId.substring(0, 8) + '...' : 'null');

  if (!sessData.authenticated || !sessData.user) {
    console.log('   ❌ Falha na autenticação');
    process.exit(1);
  }
  console.log('   ✅ Sessão válida');

  // 3. CRM Contacts
  console.log('\n3. CRM Contacts...');
  const contactsResp = await fetch(`${BASE_URL}/api/crm/contacts`, {
    headers: { 'Cookie': `sb:token=${sbToken}; x-organization-id=${orgId}` }
  });
  const contactsStatus = contactsResp.status;
  console.log('   Status:', contactsStatus);
  if (contactsStatus !== 200) {
    console.log('   ❌ Falha ao buscar contatos');
    process.exit(1);
  }
  const contacts = await contactsResp.json();
  console.log('   ✅ Count:', Array.isArray(contacts.items) ? contacts.items.length : 0);

  // 4. CRM Leads
  console.log('\n4. CRM Leads...');
  const leadsResp = await fetch(`${BASE_URL}/api/crm/leads`, {
    headers: { 'Cookie': `sb:token=${sbToken}; x-organization-id=${orgId}` }
  });
  console.log('   Status:', leadsResp.status, leadsResp.status === 200 ? '✅' : '❌');

  // 5. CRM Deals
  console.log('\n5. CRM Deals...');
  const dealsResp = await fetch(`${BASE_URL}/api/crm/deals`, {
    headers: { 'Cookie': `sb:token=${sbToken}; x-organization-id=${orgId}` }
  });
  console.log('   Status:', dealsResp.status, dealsResp.status === 200 ? '✅' : '❌');

  console.log('\n=== RESULTADO: SUCESSO ✅ ===');
  console.log(`Acesse: ${BASE_URL}/dev`);
  process.exit(0);
}

runTest().catch(e => {
  console.error('\nErro fatal:', e.message);
  process.exit(1);
});