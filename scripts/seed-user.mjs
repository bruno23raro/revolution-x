import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const cs = process.env.DATABASE_URL;
if (!cs) { console.error('DATABASE_URL ausente'); process.exit(1); }
const pool = new Pool({ connectionString: cs });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const EMAIL = 'brunoalmeida23111996@gmail.com';
const PASSWORD = 'B23b23v1814*';
const NAME = 'Bruno Almeida';

const passwordHash = await bcrypt.hash(PASSWORD, 12);
const plan = await prisma.plan.findFirst({ orderBy: { createdAt: 'asc' } });

const user = await prisma.user.upsert({
  where: { email: EMAIL },
  update: { passwordHash, emailVerified: true, name: NAME },
  create: { email: EMAIL, name: NAME, passwordHash, emailVerified: true },
});

let member = await prisma.organizationMember.findFirst({ where: { userId: user.id } });
if (!member) {
  const org = await prisma.organization.create({
    data: {
      name: 'Revolution X',
      slug: `revolution-x-${Date.now()}`,
      status: 'active',
      ...(plan ? { planId: plan.id } : {}),
    },
  });
  member = await prisma.organizationMember.create({
    data: { organizationId: org.id, userId: user.id, role: 'owner' },
  });
}

console.log(`ok user=${user.id} org=${member.organizationId} role=${member.role}`);
await pool.end();