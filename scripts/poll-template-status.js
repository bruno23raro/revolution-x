// Cron de status de templates oficiais. Ativar no hPanel: `node scripts/poll-template-status.js` (*/15 * * * *).
// Requer envs: SUPABASE_URL (= NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY,
// META_TOKEN_ENCRYPTION_KEY, WHATSAPP_GRAPH_API_VERSION (=v23.0, default).
//
// Para cada whatsapp_channels CONNECTED: GET Graph /{waba_id}/message_templates
// com o token do canal e atualiza o espelho whatsapp_templates
// (PENDING→APPROVED/REJECTED). Só o Meta aprova — o cron nunca inventa status.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

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
const ENC_KEY = process.env.META_TOKEN_ENCRYPTION_KEY;
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || 'v23.0';

if (!SUPABASE_URL || !SERVICE_KEY || !ENC_KEY) {
  console.error('Faltam envs: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, META_TOKEN_ENCRYPTION_KEY');
  process.exit(1);
}

// iv:authTag:ciphertext (src/lib/encryption.ts)
function decryptToken(ciphertext) {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) return ciphertext; // shortcut: valor legado plaintext; remover quando não houver mais
  const d = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENC_KEY.slice(0, 32)), Buffer.from(parts[0], 'hex'));
  d.setAuthTag(Buffer.from(parts[1], 'hex'));
  return d.update(parts[2], 'hex', 'utf8') + d.final('utf8');
}

const sbHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function main() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/whatsapp_channels?status=eq.CONNECTED&select=organizationId,wabaId,accessTokenEnc`,
    { headers: sbHeaders },
  );
  if (!res.ok) throw new Error(`channels list ${res.status}`);
  const channels = await res.json();
  console.log(`Canais conectados: ${channels.length}`);

  let updated = 0, failed = 0;
  for (const ch of channels) {
    if (!ch.wabaId || !ch.accessTokenEnc) continue;
    let token;
    try {
      token = decryptToken(ch.accessTokenEnc);
    } catch (e) {
      console.error(`decrypt falhou org=${ch.organizationId}: ${e.message}`);
      failed++;
      continue;
    }
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${ch.wabaId}/message_templates?fields=name,language,category,status,rejection_reason&limit=250`;
    const gr = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!gr.ok) {
      const body = (await gr.text()).slice(0, 300);
      console.error(`Graph ${gr.status} org=${ch.organizationId}: ${body}`);
      await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_channels?organizationId=eq.${ch.organizationId}`, {
        method: 'PATCH',
        headers: { ...sbHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify({ lastError: `graph_templates_${gr.status}`.slice(0, 200), updatedAt: new Date().toISOString() }),
      });
      failed++;
      continue;
    }
    const { data: templates = [] } = await gr.json();
    for (const t of templates) {
      // upsert do espelho (PK única org+name+language; PostgREST upsert on_conflict)
      const up = await fetch(
        `${SUPABASE_URL}/rest/v1/whatsapp_templates?on_conflict=organizationId,name,language`,
        {
          method: 'POST',
          headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify([
            {
              organizationId: ch.organizationId,
              name: t.name,
              language: t.language,
              category: t.category ?? 'MARKETING',
              status: t.status ?? 'PENDING',
              rejectionReason: t.rejection_reason ?? null,
              lastCheckedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ]),
        },
      );
      if (!up.ok) console.error(`upsert template ${t.name}: ${up.status} ${(await up.text()).slice(0, 200)}`);
      else updated++;
    }
  }
  console.log(`Templates sincronizados: ${updated} | falhas: ${failed}`);
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
