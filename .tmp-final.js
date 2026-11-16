const fs = require('fs');
const r = require('./.tmp-jest.json');
const RE = /^\s*(?:it|test)(?:\.each\s*\([^)]*\))?\s*\(\s*(['"`])/;

let collected = 0, fail = 0, pass = 0;
const dead = [];
for (const s of r.testResults) {
  const n = (s.assertionResults || []).length;
  collected += n;
  fail += (s.assertionResults || []).filter((a) => a.status === 'failed').length;
  pass += (s.assertionResults || []).filter((a) => a.status === 'passed').length;
  if (n === 0 && s.status === 'failed') dead.push(s.name.replace(/^.*Revolution[\\/]X[\\/]/, ''));
}

console.log('SUITES (arquivos) descobertas: ' + r.numTotalTestSuites);
console.log('CASOS coletados: ' + collected + '  (pass ' + pass + ' / fail ' + fail + ')');
console.log('SUITES mortas (0 casos): ' + dead.length);
dead.forEach((d) => console.log('  ' + d));

let never = 0;
console.log('\ncasos nunca coletados (suites mortas):');
for (const f of ['src/tests/jwt-forgery.test.ts', 'src/tests/middleware-guard.test.ts', 'src/tests/demo-mode.test.ts']) {
  let n = 0;
  for (const l of fs.readFileSync(f, 'utf8').split('\n')) if (RE.test(l)) n++;
  console.log('  ' + String(n).padStart(3) + '  ' + f);
  never += n;
}
console.log('  TOTAL: ' + never);
