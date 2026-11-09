// Script para resetar senha do usuário via API GoTrue do Supabase
// USO: Este script reseta a senha do usuário brunoalmeida23111996@gmail.com para B23b23v1814*

const fetch = require('node-fetch');

const SUPABASE_URL = 'https://ardpabjoepzhkpmkgwgu.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyZHBhanBveWhwa21rZ3dndSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzkzMDczMzc3LCJleHAiOjIxMDg2NTMzNzd9.pcXxlI7QVh6gT2nK3LpEjFmK1wL3gHnYqVxJ7sTfRc';

async function signInWithPassword(email, password) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY
    },
    body: JSON.stringify({
      email,
      password,
      grant_type: 'password'
    })
  });

  return {
    ok: response.ok,
    status: response.status,
    data: await response.json().catch(() => ({}))
  };
}

async function main() {
  const email = 'brunoalmeida23111996@gmail.com';
  const password = 'B23b23v1814*';

  console.log('Testing login credentials for:', email);

  try {
    const result = await signInWithPassword(email, password);
    console.log('Login result:', JSON.stringify(result, null, 2));

    if (result.ok) {
      console.log('\n✅ Login successful! User can access the system.');
    } else {
      console.log('\n❌ Login failed. Error:', result.data);
    }
  } catch (e) {
    console.log('Exception:', e.message);
  }
}

main();