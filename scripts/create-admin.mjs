import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

if (fs.existsSync('.env.prod.local')) {
  for (const line of fs.readFileSync('.env.prod.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
if (!process.env.DATABASE_URL) { console.log('SEM DATABASE_URL'); process.exit(1); }

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
const blocks = [...schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)].map((m) => ({ name: m[1], body: m[2] }));
const pick = (name, re) => blocks.find((b) => re.test(b.body)) || blocks.find((b) => b.name === name);
const user = pick('User', /@@map\("users"\)/);
if (!user) { console.log('MODELO USER NAO ENCONTRADO'); process.exit(1); }

const fields = [...user.body.matchAll(/^\s*(\w+)\s+(\w+)/gm)].map((m) => m[1]);
const has = (re) => fields.find((f) => re.test(f));
const fEmail = has(/^email$/i), fPass = has(/password/i), fName = has(/^name$|fullname|displayname/i);
const fRole = has(/^role$/i), fVer = has(/verified/i);
if (!fEmail || !fPass) { console.log('CAMPOS NAO DETECTADOS: ' + fields.join(', ')); process.exit(1); }

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
let hash;
if (deps.bcryptjs) hash = await require('bcryptjs').hash(password, 10);
else if (deps.bcrypt) hash = await require('bcrypt').hash(password, 10);
else if (deps.argon2) hash = await require('argon2').hash(password);
else { console.log('SEM LIB DE HASH: ' + Object.keys(deps).filter((d) => /bcrypt|argon|scrypt/i.test(d)).join(', ')); process.exit(1); }

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const acc = (n) => prisma[n.charAt(0).toLowerCase() + n.slice(1)];

const data = { [fEmail]: email, [fPass]: hash };
if (fName) data[fName] = 'Admin';
if (fRole) data[fRole] = 'ADMIN';
if (fVer) data[fVer] = new Date();
const u = await acc(user.name).upsert({ where: { [fEmail]: email }, update: { [fPass]: hash }, create: data });
console.log('USER OK: ' + u[fEmail]);

const org = pick('Organization', /@@map\("organizations"\)/);
const mem = blocks.find((b) => /userId/i.test(b.body) && /organizationId/i.test(b.body));
if (org && mem) {
  const oFields = [...org.body.matchAll(/^\s*(\w+)\s+(\w+)/gm)].map((m) => m[1]);
  const slugF = oFields.find((n) => /^slug$/i.test(n)), nameF = oFields.find((n) => /^name$/i.test(n));
  let orgRow = slugF ? await acc(org.name).findFirst({ where: { [slugF]: 'revolutionx' } }) : null;
  if (!orgRow && nameF) orgRow = await acc(org.name).create({ data: { [nameF]: 'Revolution X', ...(slugF ? { [slugF]: 'revolutionx' } : {}) } });
  const mFields = [...mem.body.matchAll(/^\s*(\w+)\s+(\w+)/gm)].map((m) => m[1]);
  const mUser = mFields.find((n) => /^userId$/i.test(n)), mOrg = mFields.find((n) => /^organizationId$/i.test(n));
  const mRole = mFields.find((n) => /^role$/i.test(n));
  const exists = await acc(mem.name).findFirst({ where: { [mUser]: u.id, [mOrg]: orgRow.id } });
  if (!exists) await acc(mem.name).create({ data: { [mUser]: u.id, [mOrg]: orgRow.id, ...(mRole ? { [mRole]: 'OWNER' } : {}) } });
  console.log('ORG OK: ' + orgRow.id + ' | vinculo OWNER criado');
}
await prisma.$disconnect();
