import fs from 'node:fs';
import path from 'node:path';

const alvos = [];
(function anda(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) anda(p);
    else if (/\.tsx?$/.test(e.name)) {
      const t = fs.readFileSync(p, 'utf8');
      if (t.includes('new Redis(')) alvos.push(p);
    }
  }
})('.');

if (!alvos.length) { console.log('nenhum new Redis encontrado'); process.exit(0); }

const opts = '{ lazyConnect: true, retryStrategy: (t) => (t > 3 ? null : 1000) }';
for (const f of alvos) {
  let t = fs.readFileSync(f, 'utf8');
  if (t.includes('retryStrategy')) { console.log('ja tratado: ' + f); continue; }
  const antes = t;
  t = t.replace(/new Redis\(([^(){}]*)\)/g, (m, arg) => {
    if (arg.includes('{')) return m;
    const a = arg.trim();
    return a ? `new Redis(${a}, ${opts})` : `new Redis(${opts})`;
  });
  if (t !== antes) { fs.writeFileSync(f, t); console.log('ajustado: ' + f); }
  else console.log('padrao inesperado: ' + f);
}
