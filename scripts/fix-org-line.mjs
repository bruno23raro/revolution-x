import fs from 'node:fs';
const f = 'src/integrations/whatsapp/openbsp/client.ts';
const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
const i = lines.findIndex((l) => l.includes('const org = orgEnv'));
if (i < 0) { console.log('linha do org nao encontrada'); process.exit(1); }
console.log('antes: ' + lines[i]);
lines[i] = "  const org = orgEnv ? '&organization_id=eq.' + orgEnv : '';";
fs.writeFileSync(f, lines.join('\n'));
console.log('depois: ' + lines[i]);