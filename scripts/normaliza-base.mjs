import fs from 'node:fs';
const f = 'src/integrations/whatsapp/openbsp/client.ts';
let s = fs.readFileSync(f, 'utf8');

const ini = s.indexOf('async function openbspPost');
const trecho = ini < 0 ? '' : s.slice(ini, ini + 1200);
console.log('--- openbspPost ---');
console.log(trecho.split(/\r?\n/).slice(0, 22).join('\n'));

const jaTemRest = /openbspPost[\s\S]{0,1200}?\/rest\/v1/.test(s);

if (jaTemRest) {
  console.log('\n=> openbspPost ja inclui /rest/v1: ajustando fetchConnectedAddress');
  s = s.split('/organizations_addresses?').join('/rest/v1/organizations_addresses?');
} else {
  console.log('\n=> openbspPost nao inclui /rest/v1: normalizando a base');
  const linhas = s.split(/\r?\n/);
  const i = linhas.findIndex((l) => l.includes('const base = (String(process.env.OPENBSP_BASE_URL'));
  if (i < 0) { console.log('linha da base nao encontrada'); process.exit(1); }
  linhas[i] = "  let base = (String(process.env.OPENBSP_BASE_URL ?? '').trim() || '').replace(/\\/+$/, '');\n  if (!base.endsWith('/rest/v1')) base += '/rest/v1';";
  s = linhas.join('\n');
}

fs.writeFileSync(f, s);
console.log('aplicado');