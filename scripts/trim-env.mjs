import fs from 'node:fs';
const f = 'src/integrations/whatsapp/openbsp/client.ts';
let s = fs.readFileSync(f, 'utf8');
for (const k of ['OPENBSP_BASE_URL', 'OPENBSP_API_KEY', 'OPENBSP_PUBLISHABLE_KEY', 'OPENBSP_ORG_ID']) {
  s = s.split(`process.env.${k}`).join(`String(process.env.${k} ?? '').trim()`);
}
s = s.split(`String(String(process.env.`).join(`String(process.env.`);
fs.writeFileSync(f, s);
console.log('envs normalizadas');