const fs = require('fs');
const WT = '.claude/worktrees/wf_87bae8b3-6af-2';
const RE = /^\s*(?:it|test)(?:\.each\s*\([^)]*\))?\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/;

function titles(file) {
  const out = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(RE);
    if (m) out.push(m[2].trim());
  }
  return out;
}

const pairs = [
  'src/tests/fase1-chatbot-sender.test.ts',
  'app/api/whatsapp/accounts/route.test.ts',
];

for (const rel of pairs) {
  const main = titles(rel);
  const wt = titles(WT + '/' + rel);
  const setMain = new Set(main);
  const onlyWt = wt.filter((t) => !setMain.has(t));
  const setWt = new Set(wt);
  const onlyMain = main.filter((t) => !setWt.has(t));
  console.log('\n=== ' + rel + ' ===');
  console.log('main=' + main.length + ' worktree=' + wt.length);
  console.log('  SÓ NO WORKTREE (ausentes na principal):');
  onlyWt.forEach((t) => console.log('    - ' + t));
  console.log('  SÓ NA PRINCIPAL (novos):');
  onlyMain.forEach((t) => console.log('    + ' + t));
}
