// Deterministic seed for local development and CI
// Creates: 2 organizations, 3 users per org with different roles, contacts, pipeline per org

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL ?? 'postgresql://revx:yzcheGaWQbK51Y0IBnNDtpioqEwfS7Fj@localhost:5432/revolution_x';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  const BCRYPT_COST = 12;
  const passwordHash = await bcrypt.hash('SenhaForte123!', BCRYPT_COST);

  console.log('🌱 Starting deterministic seed...');

  // Clean existing data (idempotent)
  await prisma.campaignRecipient.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.whatsappTemplate.deleteMany();
  await prisma.whatsappChannel.deleteMany();
  await prisma.integrationEvent.deleteMany();
  await prisma.metaIntegration.deleteMany();
  await prisma.webhookEvent.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.pipeline.deleteMany();
  await prisma.adminAlert.deleteMany();
  await prisma.agentMemory.deleteMany();
  await prisma.taskEvent.deleteMany();
  await prisma.taskStep.deleteMany();
  await prisma.task.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.plan.deleteMany();

  console.log('🧹 Cleaned existing data');

  // 1. Create Plans
  const freePlan = await prisma.plan.create({
    data: {
      name: 'Free',
      priceMonthly: 0,
      limitsJson: { contacts: 100, campaigns: 10, messages: 500 },
      featuresJson: { whatsapp: true, email: false, ai: false },
    },
  });

  const proPlan = await prisma.plan.create({
    data: {
      name: 'Pro',
      priceMonthly: 99,
      limitsJson: { contacts: 10000, campaigns: 100, messages: 50000 },
      featuresJson: { whatsapp: true, email: true, ai: true },
    },
  });

  console.log('📋 Plans created');

  // 2. Create Organizations
  const org1 = await prisma.organization.create({
    data: {
      name: 'Acme Corp',
      slug: 'acme-corp',
      status: 'active',
      planId: proPlan.id,
    },
  });

  const org2 = await prisma.organization.create({
    data: {
      name: 'Globex Inc',
      slug: 'globex-inc',
      status: 'active',
      planId: freePlan.id,
    },
  });

  console.log('🏢 Organizations created');

  // 3. Create Users per organization
  const org1Users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'owner@acme.test',
        name: 'Alice Owner',
        passwordHash: await bcrypt.hash('SenhaForte123!', 12),
        emailVerified: true,
        organizationMembers: {
          create: { organizationId: org1.id, role: 'owner' },
        },
      },
    }),
    prisma.user.create({
      data: {
        email: 'admin@acme.test',
        name: 'Bob Admin',
        passwordHash: await bcrypt.hash('SenhaForte123!', 12),
        emailVerified: true,
        organizationMembers: {
          create: { organizationId: org1.id, role: 'admin' },
        },
      },
    }),
    prisma.user.create({
      data: {
        email: 'member@acme.test',
        name: 'Carol Member',
        passwordHash: await bcrypt.hash('SenhaForte123!', 12),
        emailVerified: true,
        organizationMembers: {
          create: { organizationId: org1.id, role: 'member' },
        },
      },
    }),
  ]);

  const org2Users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'owner@globex.test',
        name: 'Dave Owner',
        passwordHash: await bcrypt.hash('SenhaForte123!', 12),
        emailVerified: true,
        organizationMembers: {
          create: { organizationId: org2.id, role: 'owner' },
        },
      },
    }),
    prisma.user.create({
      data: {
        email: 'admin@globex.test',
        name: 'Eve Admin',
        passwordHash: await bcrypt.hash('SenhaForte123!', 12),
        emailVerified: true,
        organizationMembers: {
          create: { organizationId: org2.id, role: 'admin' },
        },
      },
    }),
    prisma.user.create({
      data: {
        email: 'viewer@globex.test',
        name: 'Frank Viewer',
        passwordHash: await bcrypt.hash('SenhaForte123!', 12),
        emailVerified: true,
        organizationMembers: {
          create: { organizationId: org2.id, role: 'viewer' },
        },
      },
    }),
  ]);

  console.log('👥 Users created with roles');

  // 4. Create Contacts per organization
  await Promise.all(
    org1Users.map(async (user, i) => {
      await prisma.contact.create({
        data: {
          organizationId: org1.id,
          email: `contact${i + 1}@acme.test`,
          name: `Contact ${i + 1} Acme`,
          phone: `+551199999000${i}`,
          company: 'Acme Corp',
          source: 'seed',
          tags: ['seed', 'acme'],
        },
      });
    }),
  );

  await Promise.all(
    org2Users.map(async (user, i) => {
      await prisma.contact.create({
        data: {
          organizationId: org2.id,
          email: `contact${i + 1}@globex.test`,
          name: `Contact ${i + 1} Globex`,
          phone: `+551188888000${i}`,
          company: 'Globex Inc',
          source: 'seed',
          tags: ['seed', 'globex'],
        },
      });
    }),
  );

  console.log('📇 Contacts created');

  // 5. Create Pipeline per organization
  await prisma.pipeline.create({
    data: {
      organizationId: org1.id,
      name: 'Vendas Acme',
      stages: ['prospecting', 'proposal', 'negotiation', 'won', 'lost'],
    },
  });

  await prisma.pipeline.create({
    data: {
      organizationId: org2.id,
      name: 'Vendas Globex',
      stages: ['prospecting', 'qualification', 'proposal', 'negotiation', 'won', 'lost'],
    },
  });

  console.log('📊 Pipelines created');

  // 6. Create a Deal per organization
  const pipeline1 = await prisma.pipeline.findFirst({ where: { organizationId: org1.id } });
  const pipeline2 = await prisma.pipeline.findFirst({ where: { organizationId: org2.id } });

  if (pipeline1) {
    await prisma.deal.create({
      data: {
        organizationId: org1.id,
        title: 'Deal Inicial Acme',
        value: 50000,
        stage: 'proposal',
        pipelineId: pipeline1.id,
      },
    });
  }

  if (pipeline2) {
    await prisma.deal.create({
      data: {
        organizationId: org2.id,
        title: 'Deal Inicial Globex',
        value: 25000,
        stage: 'prospecting',
        pipelineId: pipeline2.id,
      },
    });
  }

  console.log('🤝 Deals created');

  console.log('✅ Seed completed successfully!');
  console.log(`
📊 Summary:
- 2 Organizations (Acme Corp, Globex Inc)
- 6 Users (3 per org: owner/admin/member/viewer)
- 6 Contacts (3 per org)
- 2 Pipelines (1 per org)
- 2 Deals (1 per org)
- All passwords: SenhaForte123! (bcrypt cost 12)
  `);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });