import fs from 'node:fs';
import path from 'node:path';
const dir = '.github/workflows';
let n = 0;
for (const f of fs.readdirSync(dir)) {
  const p = path.join(dir, f);
  const t = fs.readFileSync(p, 'utf8');
  const out = t.replace(/node-version:\s*['"]?20['"]?/g, 'node-version: 22');
  if (out !== t) { fs.writeFileSync(p, out); n++; console.log('ajustado: ' + f); }
}
if (n === 0) console.log('nenhum workflow com node-version 20');
