const fs = require('fs');
const o = require('./.tmp-fail.json');

const files = [...new Set(o.map((x) => x.f))];

function authImports(file) {
  const dir = file.includes('\\') ? file.slice(0, file.lastIndexOf('\\')) : '.';
  // find the route the test imports
  let txt = '';
  try { txt = fs.readFileSync(file, 'utf8'); } catch { return { err: 'unreadable' }; }
  const imp = [...txt.matchAll(/import\s*\{[^}]*\}\s*from\s*['"]([^'"]*\/route)['"]/g)].map((m) => m[1]);
  const mockBlock = txt.match(/jest\.mock\(['"]@\/lib\/auth['"],\s*\(\)\s*=>\s*\(\{([\s\S]*?)\}\)/);
  const mocked = mockBlock ? [...mockBlock[1].matchAll(/(\w+)\s*:/g)].map((m) => m[1]) : [];
  const routes = imp.map((spec) => {
    // resolve relative spec from test file location
    const parts = (dir.replace(/\\/g, '/') + '/' + spec).split('/');
    const out = [];
    for (const p of parts) {
      if (p === '.' || p === '') continue;
      if (p === '..') out.pop();
      else out.push(p);
    }
    const p = out.join('/') + '.ts';
    if (!fs.existsSync(p)) return { spec, path: p, exists: false };
    const rt = fs.readFileSync(p, 'utf8');
    const a = rt.match(/\{([^}]*)\}\s*from\s*['"]@\/lib\/auth['"]/);
    return { spec, path: p, exists: true, uses: a ? a[1].split(',').map((s) => s.trim().split(/\s+as\s+/).pop()).filter(Boolean) : [] };
  });
  return { mocked, routes };
}

console.log('ARQUIVO DE TESTE  |  mocka  |  rota usa  |  veredito');
console.log('-'.repeat(110));
for (const f of files) {
  const r = authImports(f);
  if (r.err) { console.log(f + '  ERRO'); continue; }
  for (const rt of r.routes) {
    if (!rt.exists) { console.log(f + '\n    rota NAO ENCONTRADA: ' + rt.path); continue; }
    const missing = (rt.uses || []).filter((u) => !r.mocked.includes(u));
    const verdict = missing.length ? 'MOCK FALTA: ' + missing.join(', ') : 'ok';
    console.log(f + '\n    mocka=[' + r.mocked.join(',') + ']  rota=' + rt.path + '\n    usa=[' + (rt.uses || []).join(',') + ']  -> ' + verdict);
  }
}
