import fs from 'node:fs';
const f = 'src/lib/prisma.ts';
let L = fs.readFileSync(f, 'utf8').split(/\r?\n/);
const anchor = L.findIndex((l) => l.startsWith('export { Prisma };'));
if (anchor < 0) { console.log('anchor nao encontrado'); process.exit(1); }
L.splice(anchor + 1, 0, '', "// URL inerte usada quando DATABASE_URL nao existe (ex.: build sem env).", "const FALLBACK_DB_URL = 'postgresql://localhost:5432/postgres';");
const a = L.findIndex((l) => l.includes('const url = new URL(source);'));
if (a < 0) { console.log('url(source) nao encontrado'); process.exit(1); }
L[a] = '    const url = new URL(source || FALLBACK_DB_URL);';
const b = L.findIndex((l) => l.includes("const connectionString = process.env.DATABASE_URL ?? '';"));
if (b < 0) { console.log('connectionString nao encontrado'); process.exit(1); }
L[b] = '    const connectionString = process.env.DATABASE_URL ?? FALLBACK_DB_URL;';
fs.writeFileSync(f, L.join('\n'));
console.log('prisma blindado');
