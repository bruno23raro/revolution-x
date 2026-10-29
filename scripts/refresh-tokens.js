// Cron de refresh de tokens OAuth. Ativar no hPanel: `node scripts/refresh-tokens.js` (ex.: diário).
// Requer envs: SUPABASE_URL (= NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, META_APP_ID, META_APP_SECRET,
// e META_TOKEN_ENCRYPTION_KEY (os callbacks gravam access_token cifrado via src/lib/encryption.ts).
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// node puro não carrega .env.local como o Next; lê as linhas KEY=VALUE direto (não sobrescreve env real)
for (const f of ['.env.local', '.env']) {
  const p = path.join(__dirname, '..', f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim();
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const ENC_KEY = process.env.META_TOKEN_ENCRYPTION_KEY;

// Mesmo formato iv:authTag:ciphertext do src/lib/encryption.ts (aes-256-gcm)
function decryptToken(ciphertext) {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) return ciphertext; // shortcut: valor legado em plaintext passa direto; trocar quando não houver mais
  const d = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENC_KEY.slice(0, 32)), Buffer.from(parts[0], 'hex'));
  d.setAuthTag(Buffer.from(parts[1], 'hex'));
  return d.update(parts[2], 'hex', 'utf8') + d.final('utf8');
}
function encryptToken(plaintext) {
  const iv = crypto.randomBytes(16);
  const c = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENC_KEY.slice(0, 32)), iv);
  return iv.toString('hex') + ':' + c.getAuthTag().toString('hex') + ':' + c.update(plaintext, 'utf8', 'hex') + c.final('hex');
}

if (!SUPABASE_URL || !SERVICE_KEY || !META_APP_ID || !META_APP_SECRET) {
  console.error('❌ Faltam variáveis de ambiente necessárias: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, META_APP_ID, META_APP_SECRET');
  process.exit(1);
}

async function refreshToken(channel, integration) {
  let endpoint = '';
  let body = {};

  switch (channel) {
    case 'whatsapp':
    case 'facebook':
      endpoint = 'https://graph.facebook.com/v23.0/oauth/access_token';
      body = new URLSearchParams({
        grant_type: 'fb_exchange_token',
        fb_exchange_token: decryptToken(integration.access_token),
        client_id: META_APP_ID,
        client_secret: META_APP_SECRET
      }).toString();
      break;
    case 'instagram':
      endpoint = 'https://graph.instagram.com/refresh_access_token';
      body = new URLSearchParams({
        grant_type: 'ig_refresh_token',
        access_token: decryptToken(integration.access_token)
      }).toString();
      break;
    default:
      console.log(`⚠️  Canal ${channel}: sem endpoint de refresh (whatsapp_qr)`);
      return true;
  }

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!resp.ok) throw new Error(`Refresh ${channel} failed: ${resp.status} ${await resp.text()}`);

  const data = await resp.json();

  await fetch(`${SUPABASE_URL}/rest/v1/integrations?id=eq.${integration.id}`, {
    method: 'PATCH',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      access_token: encryptToken(data.access_token),
      expires_at: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString()
    })
  });

  console.log(`✅ Refreshed: ${integration.id} (${integration.channel})`);
  return true;
}

(async () => {
  const cutoff = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const res = await fetch(
    // CHECK da tabela usa maiúsculas; eq do PostgREST é case-sensitive
    `${SUPABASE_URL}/rest/v1/integrations?status=eq.CONNECTED&expires_at=lt.${cutoff}&select=*`,
    {
      headers:
      {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`
      }
    }
  );
  const integrations = await res.json();

  let okCount = 0, errCount = 0;
  for (const integ of integrations) {
    try {
      await refreshToken(integ.channel, integ);
      okCount++;
    } catch (e) {
      console.error(`❌ Failed: ${integ.id} (${integ.channel}):`, e.message);
      errCount++;
    }
  }
  console.log('\n=== Summary ===');
  console.log(`Refreshed OK: ${okCount}`);
  console.log(`Failed: ${errCount}`);
})().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});