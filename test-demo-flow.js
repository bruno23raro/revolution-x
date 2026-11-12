#!/usr/bin/env node
/**
 * Teste rápido do fluxo demo
 * Detecta automaticamente a porta do servidor
 */

const http = require('http');

// Detectar porta: variável de ambiente ou padrão
const PORT = process.env.DEMO_PORT || process.env.PORT || 3000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

console.log(`=== TESTE FLUXO DEMO - Porta ${PORT} ===\n`);

// Teste de conectividade
function testConnectivity() {
  return new Promise((resolve) => {
    const req = http.get(`${BASE_URL}/api/dev/demo-login`, { method: 'POST' }, (res) => {
      resolve(res.statusCode);
    });
    req.on('error', () => resolve(0));
    req.setTimeout(3000, () => { req.destroy(); resolve(0); });
  });
}

async function runTest() {
  // Verificar se servidor está disponível
  const statusCode = await testConnectivity();
  if (statusCode === 0) {
    console.log('❌ Servidor não está disponível em', BASE_URL);
    console.log('   Inicie com: set PORT=' + PORT + ' && npm.cmd run dev:demo');
    process.exit(1);
  }
  console.log('✅ Servidor disponível em', BASE_URL);

  let sbToken = null;
  let orgId = null;

  // 1. Login demo
  console.log('\n1. Login demo...');
  const loginResp = await fetch(`${BASE_URL}/api/dev/demo-login`, { method: 'POST' });
  console.log('   Status:', loginResp.status);

  if (loginResp.status !== 200) {
    const err = await loginResp.text();
    console.log('   Error:', err.substring(0, 200));
    process.exit(1);
  }

  const loginData = await loginResp.json();
  console.log('   User:', loginData.user.email, '| Demo:', loginData.demo);

  // Extract cookies
  const setCookies = loginResp.headers.get('set-cookie')?.split(',') || [];
  for (const cookie of setCookies) {
    if (cookie.startsWith('sb:token=')) {
      sbToken = cookie.split(';')[0].split('=')[1];
    }
    if (cookie.startsWith('x-organization-id=')) {
      orgId = cookie.split('=')[1].split(';')[0];
    }
  }
  console.log('   Token received:', sbToken ? '✅' : '❌');
  console.log('   Org ID:', orgId || '❌');

  // 2. Check session
  console.log('\n2. Session check...');
  const sessResp = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { 'Cookie': `sb:token=${sbToken}; x-organization-id=${orgId}` }
  });
  const sessData = await sessResp.json();
  console.log('   Authenticated:', sessData.authenticated, '| User ID:', sessData.user?.id?.substring(0, 8) + '...');
  const sessionOk = sessData.authenticated === true;

  // 3. CRM Contacts
  console.log('\n3. CRM Contacts...');
  const contactsResp = await fetch(`${BASE_URL}/api/crm/contacts`, {
    headers: { 'Cookie': `sb:token=${sbToken}; x-organization-id=${orgId}` }
  });
  const contactsStatus = contactsResp.status;
  console.log('   Status:', contactsStatus, contactsStatus === 200 ? '✅' : '❌');
  let contactsCount = 0;
  if (contactsStatus === 200) {
    const contacts = await contactsResp.json();
    contactsCount = Array.isArray(contacts.items) ? contacts.items.length : 0;
    console.log('   Count:', contactsCount);
  }

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
  if (dealsResp.status === 200) {
    const deals = await dealsResp.json();
    const total = Array.isArray(deals.items) ? deals.items.reduce((s, d) => s + Number(d.value || 0), 0) : 0;
    console.log('   Total value:', total);
  }

  // Result
  const success = sessionOk && contactsStatus === 200 && leadsResp.status === 200 && dealsResp.status === 200;
  console.log('\n=== RESULTADO:', success ? 'SUCESSO ✅' : 'FALHA ❌', '===');
  process.exit(success ? 0 : 1);
}

runTest().catch(e => {
  console.error('Erro:', e.message);
  process.exit(1);
});