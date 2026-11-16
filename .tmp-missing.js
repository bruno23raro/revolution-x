const fs = require('fs');
const WT = '.claude/worktrees/wf_7eb43e84-53c-2';
const RE = /^\s*(?:it|test)(?:\.each\s*\([^)]*\))?\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/;

function titles(file) {
  const out = [];
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(RE);
    if (m) out.push(m[2].trim());
  }
  return out;
}

const files = [
  'src/tests/tiktok-oauth-routes.test.ts',
  'src/tests/tiktok-accounts-route.test.ts',
  'src/tests/admin-routes.test.ts',
];

for (const rel of files) {
  const m = titles(rel);
  const w = titles(WT + '/' + rel);
  const sm = new Set(m), sw = new Set(w);
  const onlyW = w.filter((t) => !sm.has(t));
  console.log('\n### ' + rel + '  main=' + m.length + ' worktree=' + w.length);
  if (m.length === 0) {
    console.log('  ARQUIVO INTEIRO AUSENTE NA PRINCIPAL — ' + w.length + ' testes:');
    w.forEach((t) => console.log('    - ' + t));
  } else {
    console.log('  ausentes na principal:');
    onlyW.forEach((t) => console.log('    - ' + t));
  }
}
