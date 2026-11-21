import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const accounts = [
  { email: 'admin@revolutionx.dev', password: 'RevX!2026#Admin', name: 'Admin' },
  { email: 'brunoalmeida23111996@gmail.com', password: 'B23b23v1814*', name: 'Bruno Almeida' },
];

for (const a of accounts) {
  const hash = await bcrypt.hash(a.password, 12);
  const user = await prisma.user.upsert({
    where: { email: a.email },
    update: { passwordHash: hash, emailVerified: true, name: a.name },
    create: { email: a.email, name: a.name, passwordHash: hash, emailVerified: true },
  });
  console.log('USER OK ' + user.email + ' ' + user.id);
  let org = await prisma.organization.findFirst({ where: { slug: 'revolutionx' } });
  if (!org) org = await prisma.organization.create({ data: { name: 'Revolution X', slug: 'revolutionx', status: 'active' } });
  const mem = await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
    create: { organizationId: org.id, userId: user.id, role: 'owner' },
    update: { role: 'owner' },
  });
  console.log('MEMBER OK ' + mem.role + ' org=' + org.id);
}

console.log('TOTAL USERS: ' + (await prisma.user.count()));
await prisma.$disconnect();
await pool.end();
