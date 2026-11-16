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

function survey(root) {
  const files = [];
  for (const sub of ['src', 'app', 'tests']) {
    const d = path.join(root, sub);
    if (fs.existsSync(d)) files.push(...walk(d));
  }
  let cases = 0;
  for (const f of files) cases += count(f);
  return { files: files.length, cases };
}

console.log('raiz: ' + process.cwd());
const m = survey('.');
console.log(`PRINCIPAL   arquivos=${m.files}  casos=${m.cases}`);

for (const w of fs.readdirSync('.claude/worktrees')) {
  const base = path.join('.claude/worktrees', w);
  if (!fs.existsSync(path.join(base, 'src'))) continue;
  const s = survey(base);
  console.log(`${w.padEnd(22)} arquivos=${s.files}  casos=${s.cases}  delta_casos=${s.cases - m.cases}`);
}
