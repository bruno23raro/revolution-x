// Debug script for session endpoint
const http = require('http');

const BASE_URL = 'http://127.0.0.1:4000';

async function debugSession() {
  // First get the demo token
  console.log('=== Step 1: Login Demo ===');
  const loginResp = await fetch(`${BASE_URL}/api/dev/demo-login`, { method: 'POST' });
  console.log('Login status:', loginResp.status);

  const rawCookie = loginResp.headers.get('set-cookie');
  console.log('Raw Set-Cookie header:', rawCookie?.substring(0, 200));

  // Parse cookies
  let sbToken = null;
  let orgId = null;
  if (rawCookie) {
    const cookies = rawCookie.split(', ');
    for (const cookie of cookies) {
      const eqIdx = cookie.indexOf('=');
      if (eqIdx > 0) {
        const name = cookie.substring(0, eqIdx).trim();
        const value = cookie.substring(eqIdx + 1).split(';')[0].trim();
        if (name === 'sb:token') sbToken = value;
        if (name === 'x-organization-id') orgId = value;
      }
    }
  }

  console.log('Extracted sb:token:', sbToken ? sbToken.substring(0, 50) + '...' : 'NONE');
  console.log('Extracted orgId:', orgId || 'NONE');

  // Now test session
  console.log('\n=== Step 2: Check Session ===');
  const sessionResp = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: {
      'Cookie': `sb:token=${sbToken}; x-organization-id=${orgId}`
    }
  });

  console.log('Session status:', sessionResp.status);
  const sessionData = await sessionResp.json();
  console.log('Session response:', JSON.stringify(sessionData, null, 2));

  // Also check what the server sees
  console.log('\n=== Step 3: Direct API Test ===');
  const directResp = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: {
      'Cookie': `sb:token=dummy; x-organization-id=test`
    }
  });
  console.log('Direct test status:', directResp.status);
  const directData = await directResp.json();
  console.log('Direct test response:', JSON.stringify(directData, null, 2));
}

debugSession().catch(console.error);
