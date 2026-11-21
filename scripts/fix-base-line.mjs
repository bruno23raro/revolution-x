import fs from 'node:fs';
const f = 'src/integrations/whatsapp/openbsp/client.ts';
const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
const i = lines.findIndex((l) => l.includes('const base = cfg.base'));
if (i < 0) { console.log('linha do base nao encontrada'); process.exit(1); }
console.log('antes: ' + lines[i]);
lines[i] = "  let base = cfg.base;\n  while (base.endsWith('/')) base = base.slice(0, -1);";
fs.writeFileSync(f, lines.join('\n'));
console.log('depois: ' + lines[i]);