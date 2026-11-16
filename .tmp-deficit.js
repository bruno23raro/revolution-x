const fs = require('fs');
const path = require('path');
const norm = (p) => p.split(path.sep).join('/');
const RE = /^\s*(?:it|test)(?:\.each\s*\([^)]*\))?\s*\(\s*(['"`])/;

function count(file) {
  let n = 0;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) if (RE.test(line)) n++;
  return n;
}

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

const mainFiles = [...walk('src'), ...walk('app'), ...walk('tests')];
const main = new Map();
for (const f of mainFiles) main.set(f, count(f));

const wts = fs.readdirSync('.claude/worktrees').filter((w) => fs.existsSync(path.join('.claude/worktrees', w, 'src')));
const best = new Map(); // rel -> {max, wt}
for (const w of wts) {
  const base = path.join('.claude/worktrees', w);
  for (const sub of ['src', 'app', 'tests']) {
    const d = path.join(base, sub);
    if (!fs.existsSync(d)) continue;
    for (const f of walk(d)) {
      const rel = f.slice(f.indexOf('/' + sub + '/') + 1);
      const c = count(f);
      const cur = best.get(rel);
      if (!cur || c > cur.max) best.set(rel, { max: c, wt: w });
    }
  }
}

const rows = [];
for (const [rel, b] of best) {
  const m = main.has(rel) ? main.get(rel) : 0;
  if (b.max > m) rows.push({ rel, main: m, best: b.max, d: b.max - m, wt: b.wt });
}

rows.sort((a, b) => b.d - a.d);
console.log('=== deficit de casos de teste (melhor worktree - principal) ===');
let tot = 0;
for (const r of rows) {
  tot += r.d;
  console.log(`  -${String(r.d).padStart(2)}  main=${String(r.main).padStart(2)} best=${String(r.best).padStart(2)}  ${r.rel}   [${r.wt}]`);
}
console.log('\nTOTAL DE CASOS AUSENTES:', tot);
console.log('total main:', [...main.values()].reduce((a, b) => a + b, 0));
console.log('total best-union:', [...best.values()].reduce((a, b) => a + b.max, 0));
