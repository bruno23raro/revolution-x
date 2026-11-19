// Seed admin único para Revolution X (single admin, sem multi-tenant)
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL ?? 'postgresql://revx:yzcheGaWQbK51Y0IBnNDtpioqEwfS7Fj@localhost:5434/revolution_x';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@revolutionx.dev';
  const password = process.env.ADMIN_PASSWORD || 'SenhaForte123!';

  console.log(`🌱 Seed admin: ${email}`);

  const hash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: 'Admin',
      passwordHash: hash,
      emailVerified: true,
    },
    update: {
      passwordHash: hash,
      emailVerified: true,
      name: 'Admin',
    },
  });

  console.log(`✅ Admin criado/atualizado: ${user.id} (${user.email})`);

  // Criar organization padrão se não existir
  let org = await prisma.organization.findFirst({
    where: { slug: 'revolutionx' },
  });

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'Revolution X',
        slug: 'revolutionx',
        status: 'active',
      },
    });
    console.log(`✅ Organization criada: ${org.id}`);
  }

  // Criar membership admin
  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: user.id,
      },
    },
    create: {
      organizationId: org.id,
      userId: user.id,
      role: 'owner',
    },
    update: {
      role: 'owner',
    },
  });

  console.log(`✅ Membership admin criado/atualizado`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch(async (e) => {
  console.error('❌ Erro no seed:', e);
  await prisma.$disconnect();
  await pool.end();
  process.exit(1);
});