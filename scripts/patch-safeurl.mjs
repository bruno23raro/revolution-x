import fs from 'node:fs';
const f = 'src/lib/prisma.ts';
let L = fs.readFileSync(f, 'utf8').split(/\r?\n/);
const fb = L.findIndex((l) => l.includes('FALLBACK_DB_URL ='));
if (fb < 0) { console.log('fallback nao encontrado'); process.exit(1); }
L.splice(fb + 1, 0,
  '',
  'function safeDbUrl(raw?: string | null): URL {',
  "  const candidate = (raw ?? '').trim();",
  '  try {',
  '    return new URL(candidate || FALLBACK_DB_URL);',
  '  } catch {',
  '    return new URL(FALLBACK_DB_URL);',
  '  }',
  '}',
);
const a = L.findIndex((l) => l.includes('new URL(source || FALLBACK_DB_URL)'));
if (a < 0) { console.log('url(source) nao encontrado'); process.exit(1); }
L[a] = '    const url = safeDbUrl(source);';
const b = L.findIndex((l) => l.includes('const connectionString = process.env.DATABASE_URL'));
if (b < 0) { console.log('connectionString nao encontrado'); process.exit(1); }
if (L[b + 1] && L[b + 1].includes('new URL(connectionString)')) {
  L.splice(b, 2, '    const url = safeDbUrl(process.env.DATABASE_URL);');
} else {
  L[b] = '    const url = safeDbUrl(process.env.DATABASE_URL);';
}
fs.writeFileSync(f, L.join('\n'));
console.log('prisma blindado com try/catch');
