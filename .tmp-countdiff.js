const fs = require('fs');
const path = require('path');
const norm = (p) => p.split(path.sep).join('/');
const RE = /^\s*(it|test)(\.each\s*\([^)]*\))?\s*\(/;

function countTests(file) {
  const src = fs.readFileSync(file, 'utf8');
  let n = 0;
  for (const line of src.split('\n')) if (RE.test(line)) n++;
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

const WT = '.claude/worktrees/wf_87bae8b3-6af-2';
const mainFiles = [...walk('src'), ...walk('app'), ...walk('tests')];
const rows = [];
let totalMain = 0, totalWt = 0;

for (const f of mainFiles) {
  const wtPath = path.join(WT, f);
  const m = countTests(f);
  totalMain += m;
  if (!fs.existsSync(wtPath)) {
    rows.push({ f, main: m, wt: null, d: null });
    continue;
  }
  const w = countTests(wtPath);
  totalWt += w;
  if (w !== m) rows.push({ f, main: m, wt: w, d: m - w });
}

// files that exist only in the worktree
for (const f of walk(path.join(WT, 'src')).concat(walk(path.join(WT, 'app')), walk(path.join(WT, 'tests')))) {
  const rel = f.slice(f.indexOf('/', f.indexOf('/') + 1) + 1);
  const relNorm = rel.slice(rel.indexOf('/') + 1);
  const candidates = [relNorm, rel];
  if (!candidates.some((c) => fs.existsSync(c))) {
    const w = countTests(f);
    totalWt += w;
    rows.push({ f: relNorm, main: 0, wt: w, d: -w, onlyWt: true });
  }
}

console.log('=== arquivos com contagem divergente (main - worktree) ===');
for (const r of rows.sort((a, b) => (a.d ?? 0) - (b.d ?? 0))) {
  if (r.onlyWt) console.log(`  SO-NO-WORKTREE  ${r.wt} testes  ${r.f}`);
  else if (r.wt === null) console.log(`  SO-NA-PRINCIPAL ${r.main} testes  ${r.f}`);
  else console.log(`  ${String(r.d).padStart(4)}  main=${String(r.main).padStart(3)} wt=${String(r.wt).padStart(3)}  ${r.f}`);
}
console.log('\nmain total:', totalMain, '| worktree total:', totalWt, '| delta:', totalWt - totalMain);
