const fs = require('fs');
const path = require('path');
const norm = (p) => p.split(path.sep).join('/');

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      walk(p, acc);
    } else if (e.name.endsWith('.test.ts')) acc.push(norm(p));
  }
  return acc;
}

const main = new Set([...walk('src'), ...walk('app')].map((p) => p.replace(/^(src|app)\//, '$1/')));

const wtRoot = '.claude/worktrees';
const perWt = {};
for (const w of fs.readdirSync(wtRoot)) {
  const base = path.join(wtRoot, w);
  if (!fs.existsSync(path.join(base, 'src'))) continue;
  const files = [];
  for (const sub of ['src', 'app', 'tests']) {
    if (fs.existsSync(path.join(base, sub))) {
      for (const f of walk(path.join(base, sub))) files.push(f.slice(f.indexOf('/' + sub + '/') + 1));
    }
  }
  perWt[w] = files;
}

const union = new Set();
for (const w of Object.keys(perWt)) for (const f of perWt[w]) union.add(f);

const missing = [...union].filter((f) => !main.has(f)).sort();
console.log('worktrees analisados:', Object.keys(perWt).length);
console.log('arquivos .test.ts na uniao dos worktrees:', union.size);
console.log('arquivos .test.ts na arvore principal (src+app):', main.size);
console.log('AUSENTES NA PRINCIPAL:', missing.length);
missing.forEach((m) => console.log('  ' + m));
