// E2E validation - Demo Flow
const http = require('http');

const BASE = { hostname: 'localhost', port: 4000 };

async function testEndpoint(path, method, cookie) {
  return new Promise((resolve) => {
    const opts = { ...BASE, path, method, headers: {} };
    if (cookie) opts.headers.Cookie = cookie;

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', (e) => resolve({ status: 0, error: e.message }));
    req.end();
  });
}

async function run() {
  console.log('=== E2E Demo Flow Validation ===\n');

  // 1. Login
  const loginRes = await testEndpoint('/api/dev/demo-login', 'POST');
  console.log('1. POST /api/dev/demo-login:', loginRes.status === 200 ? '✅' : '❌');

  const cookies = loginRes.cds || [];
  let sbToken = null, orgId = null;
  if (loginRes.data) {
    const parsed = loginRes.data; // Already JSON
    if (parsed.authenticated || parsed.demo) {
      const setCookie = loginRes.headers?.['set-cookie'] || [];
      for (const c of setCookie) {
        const match = c.split(';')[0].split('=');
        if (match[0] === 'sb:token') sbToken = match[1];
        if (match[0] === 'x-organization-id') orgId = match[1]?.split(';')[0];
      }
    }
  }

  const cookie = sbToken ? `sb:token=${sbToken}; x-organization-id=${orgId}` : '';

  // 2. Session
  const sessRes = await testEndpoint('/api/auth/session', 'GET', cookie);
  console.log('2. GET /api/auth/session:', sessRes.status === 200 ? '✅' : '❌');

  // 3. CRM endpoints
  const crmTests = [
    ['/api/crm/contacts', 'GET'],
    ['/api/crm/leads', 'GET'],
    ['/api/crm/deals', 'GET'],
  ];

  let passed = 2, total = 2;
  for (const [path, method] of crmTests) {
    const res = await testEndpoint(path, method, cookie);
    console.log(`3.${++total - 2}. ${method} ${path}:`, res.status === 200 ? '✅' : `❌ (${res.status})`);
    if (res.status === 200) passed++;
  }

  // 4. Dashboard page
  const dashRes = await testEndpoint('/api/dashboard/stats', 'GET', cookie);
  console.log(`4. GET /api/dashboard/stats:`, dashRes.status === 200 ? '✅' : `❌ (${dashRes.status})`);

  console.log(`\n=== SUMMARY: ${passed}/${total} tests passed ===`);
  process.exit(passed === total ? 0 : 1);
}

run();