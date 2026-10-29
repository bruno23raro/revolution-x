// test-user-token.mjs
// Testa Marketing API com user access token (não system user)

import { config } from 'dotenv';
config({ path: '.env.local' });

const USER_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const AD_ACCOUNT_ID = process.env.AD_ACCOUNT_ID || '';

async function main() {
  console.log('=== TESTE MARKETING API COM USER TOKEN ===');
  console.log('AD_ACCOUNT_ID:', AD_ACCOUNT_ID);
  console.log('');

  const timeRange = { since: '2026-01-01', until: '2026-10-27' };
  const timeRangeStr = JSON.stringify(timeRange);
  const fields = 'spend,impressions,clicks,reach,ctr,cpc';

  const url = `https://graph.facebook.com/v26.0/${AD_ACCOUNT_ID}/insights?fields=${fields}&time_range=${encodeURIComponent(timeRangeStr)}&limit=10&access_token=${USER_TOKEN}`;

  console.log('Chamando:', url.substring(0, 150) + '...');
  console.log('');

  const res = await fetch(url);
  const data = await res.json();

  if (res.ok && data.data) {
    console.log('✅ SUCESSO!');
    console.log('Insights retornados:', data.data.length);
    console.log('');
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log('❌ ERRO:', res.status);
    console.log(JSON.stringify(data, null, 2));
  }
}

main().catch(e => console.error('FATAL:', e));