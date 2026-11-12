#!/usr/bin/env node
/**
 * Teste do fluxo demo - Porta 4000
 */

const BASE_URL = 'http://127.0.0.1:4000';

console.log('=== TESTE FLUXO DEMO - Porta 4000 ===\n');

let sbToken = null;
let orgId = null;

try {
  // 1. Login demo
  console.log('1. Login demo...');
  const loginResp = await fetch(`${BASE_URL}/api/dev/demo-login`, { method: 'POST' });
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
  console.log('   Token received:', sbToken ? '✅ (' + sbToken.substring(0, 30) + '...)' : '❌');
  console.log('   Org ID:', orgId || '❌');

  // 2. Check session
  console.log('\n2. Session check...');
  const sessResp = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { 'Cookie': `sb:token=${sbToken}; x-organization-id=${orgId}` }
  });
  const sessData = await sessResp.json();
  console.log('   Authenticated:', sessData.authenticated);
  console.log('   User:', JSON.stringify(sessData.user));
  const sessionOk = sessData.authenticated === true && sessData.user?.id;

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
    if (contacts.items?.length > 0) {
      console.log('   First contact:', contacts.items[0].name);
    }
  } else {
    const err = await contactsResp.json().catch(() => ({}));
    console.log('   Error:', err.error || err.message || 'Unknown');
  }

  // 4. CRM Leads
  console.log('\n4. CRM Leads...');
  const leadsResp = await fetch(`${BASE_URL}/api/crm/leads`, {
    headers: { 'Cookie': `sb:token=${sbToken}; x-organization-id=${orgId}` }
  });
  const leadsStatus = leadsResp.status;
  console.log('   Status:', leadsStatus, leadsStatus === 200 ? '✅' : '❌');
  let leadsCount = 0;
  if (leadsStatus === 200) {
    const leads = await leadsResp.json();
    leadsCount = Array.isArray(leads.items) ? leads.items.length : 0;
    console.log('   Count:', leadsCount);
  }

  // 5. CRM Deals
  console.log('\n5. CRM Deals...');
  const dealsResp = await fetch(`${BASE_URL}/api/crm/deals`, {
    headers: { 'Cookie': `sb:token=${sbToken}; x-organization-id=${orgId}` }
  });
  const dealsStatus = dealsResp.status;
  console.log('   Status:', dealsStatus, dealsStatus === 200 ? '✅' : '❌');
  if (dealsStatus === 200) {
    const deals = await dealsResp.json();
    const total = Array.isArray(deals.items) ? deals.items.reduce((s, d) => s + Number(d.value || 0), 0) : 0;
    console.log('   Total value:', total);
  }

  // Result
  const success = sessionOk && contactsStatus === 200 && leadsStatus === 200 && dealsStatus === 200;
  console.log('\n=== RESULTADO:', success ? 'SUCESSO ✅' : 'FALHA ❌', '===');
  process.exit(success ? 0 : 1);
} catch (e) {
  console.error('Erro:', e.message);
  process.exit(1);
}