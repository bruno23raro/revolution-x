#!/usr/bin/env node
/**
 * Teste rápido do fluxo demo
 * Executar enquanto o servidor está rodando em localhost:3000
 */

let sbToken = null;
let orgId = null;

async function test() {
  console.log('=== TESTE FLUXO DEMO COMPLETO ===\n');

  // 1. Login demo
  console.log('1. Login demo...');
  const loginResp = await fetch('http://localhost:3000/api/dev/demo-login', { method: 'POST' });
  console.log('   Status:', loginResp.status);

  if (loginResp.status !== 200) {
    const err = await loginResp.text();
    console.log('   Error:', err.substring(0, 300));
    process.exit(1);
  }

  const loginData = await loginResp.json();
  console.log('   User:', loginData.user.email);

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
  const sessResp = await fetch('http://localhost:3000/api/auth/session', {
    headers: { 'Cookie': `sb:token=${sbToken}; x-organization-id=${orgId}` }
  });
  const sessData = await sessResp.json();
  console.log('   Auth response:', JSON.stringify(sessData));
  const sessionOk = sessData.authenticated === true && sessData.user && sessData.user.id;
  console.log('   Session check:', sessionOk ? '✅' : '❌');

  // 3. CRM Contacts
  console.log('\n3. CRM Contacts...');
  const contactsResp = await fetch('http://localhost:3000/api/crm/contacts', {
    headers: { 'Cookie': `sb:token=${sbToken}; x-organization-id=${orgId}` }
  });
  console.log('   Status:', contactsResp.status, contactsResp.status === 200 ? '✅' : '❌');
  if (contactsResp.status === 200) {
    const contacts = await contactsResp.json();
    console.log('   Count:', Array.isArray(contacts.items) ? contacts.items.length : 'N/A');
  } else {
    const err = await contactsResp.json().catch(() => ({}));
    console.log('   Error:', err.error || err.message || 'Unknown');
  }

  // 4. CRM Leads
  console.log('\n4. CRM Leads...');
  const leadsResp = await fetch('http://localhost:3000/api/crm/leads', {
    headers: { 'Cookie': `sb:token=${sbToken}; x-organization-id=${orgId}` }
  });
  console.log('   Status:', leadsResp.status, leadsResp.status === 200 ? '✅' : '❌');

  // 5. CRM Deals
  console.log('\n5. CRM Deals...');
  const dealsResp = await fetch('http://localhost:3000/api/crm/deals', {
    headers: { 'Cookie': `sb:token=${sbToken}; x-organization-id=${orgId}` }
  });
  console.log('   Status:', dealsResp.status, dealsResp.status === 200 ? '✅' : '❌');
  if (dealsResp.status === 200) {
    const deals = await dealsResp.json();
    const total = Array.isArray(deals.items) ? deals.items.reduce((s, d) => s + Number(d.value || 0), 0) : 0;
    console.log('   Total value:', total);
  }

  console.log('\n=== RESULTADO: ' + (sessionOk && contactsResp.status === 200 && leadsResp.status === 200 && dealsResp.status === 200 ? 'SUCESSO ✅' : 'FALHA ❌') + ' ===');
  process.exit(sessionOk && contactsResp.status === 200 && leadsResp.status === 200 && dealsResp.status === 200 ? 0 : 1);
}

test().catch(e => { console.error(e); process.exit(1); });