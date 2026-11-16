const fs = require('fs');
const WT = '.claude/worktrees/wf_87bae8b3-6af-2';
const RE = /^\s*(?:it|test)(?:\.each\s*\([^)]*\))?\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/;
const fix = (s) => Buffer.from(s, 'latin1').toString('utf8');

function titles(file, normalize) {
  const out = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(RE);
    if (m) out.push(normalize ? fix(m[2]).trim() : m[2].trim());
  }
  return out;
}

const rel = process.argv[2];
const main = titles(rel, false);
const wt = titles(WT + '/' + rel, true);
const setWt = new Set(wt);
const setMain = new Set(main);
console.log('main=' + main.length + ' worktree=' + wt.length);
const miss = main.filter((t) => !setWt.has(t));
const extra = wt.filter((t) => !setMain.has(t));
console.log('PRINCIPAL-SEM-PAR-NO-WORKTREE (' + miss.length + '):');
miss.forEach((t) => console.log('  - ' + t));
console.log('WORKTREE-SEM-PAR-NA-PRINCIPAL (' + extra.length + '):');
extra.forEach((t) => console.log('  + ' + t));
