const http = require('http');

// Step 1: Login demo
const loginOpts = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/dev/demo-login',
  method: 'POST'
};

console.log('=== Testing Demo Login Flow ===\n');

const loginReq = http.request(loginOpts, (res) => {
  console.log('Login Status:', res.statusCode);

  const cookies = res.headers['set-cookie'];
  console.log('\nSet-Cookie headers:');
  if (cookies) {
    cookies.forEach((cookie, i) => {
      console.log(`  ${i + 1}. ${cookie.substring(0, 80)}...`);
    });
  } else {
    console.log('  NONE');
  }

  // Parse cookies
  let token = null;
  let orgId = null;
  if (cookies) {
    for (const cookie of cookies) {
      // Format: "name=value; Path=/; ..."
      const firstColon = cookie.indexOf(';');
      const nameValue = firstColon > 0 ? cookie.substring(0, firstColon) : cookie;
      const eqIdx = nameValue.indexOf('=');
      if (eqIdx > 0) {
        const name = nameValue.substring(0, eqIdx).trim();
        const value = nameValue.substring(eqIdx + 1).trim();
        if (name === 'sb:token') token = value;
        if (name === 'x-organization-id') orgId = value;
      }
    }
  }

  console.log('\nExtracted values:');
  console.log('  sb:token:', token ? token.substring(0, 50) + '...' : 'NONE');
  console.log('  x-organization-id:', orgId || 'NONE');

  // Step 2: Test session with cookies
  if (token && orgId) {
    console.log('\n--- Testing /api/auth/session ---');

    const sessOpts = {
      hostname: 'localhost',
      port: 4000,
      path: '/api/auth/session',
      method: 'GET',
      headers: {
        'Cookie': `sb:token=${token}; x-organization-id=${orgId}`
      }
    };

    const sessReq = http.request(sessOpts, (sessRes) => {
      let data = '';
      sessRes.on('data', (chunk) => { data += chunk; });
      sessRes.on('end', () => {
        console.log('Session Status:', sessRes.statusCode);
        console.log('Session Response:', data);

        try {
          const json = JSON.parse(data);
          if (json.authenticated) {
            console.log('\n✅ SUCCESS: Session authenticated!');
            console.log('   User ID:', json.user?.id);
            console.log('   Organization:', json.organizationId);
          } else {
            console.log('\n❌ FAILED: Session not authenticated');
          }
        } catch (e) {
          console.log('   Raw response:', data);
        }
      });
    });

    sessReq.on('error', (e) => {
      console.error('Session request error:', e.message);
    });

    sessReq.end();
  } else {
    console.log('\n❌ Cannot test session - missing cookies');
  }
});

loginReq.on('error', (e) => {
  console.error('Login request error:', e.message);
});

loginReq.end();
