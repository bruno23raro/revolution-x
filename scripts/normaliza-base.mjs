import fs from 'node:fs';
const f = 'src/integrations/whatsapp/openbsp/client.ts';
let s = fs.readFileSync(f, 'utf8');
const ini = s.indexOf('async function openbspPost');
console.log(s.slice(ini, ini + 900).split(/\r?\n/).slice(0, 20).join('\n'));
const jaTemRest = /openbspPost[\s\S]{0,1200}?\/rest\/v1/.test(s);
if (jaTemRest) {
  s = s.split('/organizations_addresses?').join('/rest/v1/organizations_addresses?');
  console.log('=> corrigido em fetchConnectedAddress');
} else {
  const L = s.split(/\r?\n/);
  const i = L.findIndex((l) => l.includes('const base = (String(process.env.OPENBSP_BASE_URL'));
  if (i < 0) { console.log('base nao encontrada'); process.exit(1); }
  L[i] = "  let base = (String(process.env.OPENBSP_BASE_URL ?? '').trim() || '').replace(/\\/+$/, '');\n  if (!base.endsWith('/rest/v1')) base += '/rest/v1';";
  s = L.join('\n');
  console.log('=> base normalizada');
}
fs.writeFileSync(f, s);