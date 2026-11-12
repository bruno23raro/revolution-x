/**
 * Seed de ambiente local de demonstração
 *
 * Cria dados fictícios para o modo demo sem login.
 * Executa apenas contra o stack local (DATABASE_URL localhost ou 127.0.0.1).
 * Recusa execução contra produção ou hosts remotos.
 *
 * Uso:
 *   npx tsx prisma/seed-demo.ts
 *   npm run seed:demo
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { DEMO_IDENTITIES, demoModeEnabled, isLocalDevelopmentStack } from '../src/lib/demoMode';

dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient({
  adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })),
  log: ['error', 'warn'],
});

// UUIDs demo fixos - DEVEM SER OS MESMOS DOS IDENTITY OFICIALIZADOS
// IMPORTANTE: Usar os IDs de DEMO_IDENTITIES do demoMode.ts para consistência
// com a verificação isDemoToken/isDemoToken/decodeDemoToken
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000002';
const DEMO_IDS = {
  CONTACT_JOAO: '11111111-1111-1111-1111-111111111111',
  CONTACT_MARIA: '22222222-2222-2222-2222-222222222222',
  PIPELINE_DEFAULT: '33333333-3333-3333-3333-333333333333',
  LEAD_1: '44444444-4444-4444-4444-444444444444',
  LEAD_2: '55555555-5555-5555-5555-555555555555',
  DEAL_1: '66666666-6666-6666-6666-666666666666',
  CAMPAIGN_DEMO: '77777777-7777-7777-7777-777777777777',
  CAMPAIGN_RECIPIENT: '88888888-8888-8888-8888-888888888888',
  MESSAGE_DEMO: '99999999-9999-9999-9999-999999999999',
  WHATSAPP_CHANNEL: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  WHATSAPP_TEMPLATE: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  POST_INSTAGRAM: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  POST_FACEBOOK: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
  AGENT_MEMORY: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
};

async function main() {
  // ========================================
  // Guardas de segurança ABSOLUTOS
  // ========================================
  if (!demoModeEnabled()) {
    console.error('[seed-demo] RX_DEMO_MODE não está habilitado. Abortando.');
    process.exit(1);
  }

  if (!isLocalDevelopmentStack()) {
    console.error('[seed-demo] DATABASE_URL não aponta para stack local. Abortando.');
    process.exit(1);
  }

  console.log('[seed-demo] Iniciando seed de demonstração...');
  console.log('[seed-demo] Usuário demo:', DEMO_IDENTITIES.EMAIL);
  console.log('[seed-demo] Organização demo:', DEMO_IDENTITIES.ORG_ID);

  // ========================================
  // 1. Organization (usando upsert com id fixo)
  // ========================================
  await prisma.organization.upsert({
    where: { id: DEMO_IDENTITIES.ORG_ID },
    update: { name: 'Organização Demo', status: 'active' },
    create: { id: DEMO_IDENTITIES.ORG_ID, name: 'Organização Demo', slug: 'demo-org', status: 'active' },
  });
  console.log('[seed-demo] Organização criada/atualizada');

  // ========================================
  // 1.5. Usuário Demo (ANTES do Member)
  // ========================================
  // IMPORTANTE: O usuário demo é necessário para que getAuthenticatedUser()
  // retorne dados válidos no modo demo. Sem este registro, retornaria null.
  // O passwordHash é um hash dummy - o usuário demo usa token JWT, não senha.
  await prisma.user.upsert({
    where: { id: DEMO_IDENTITIES.USER_ID },
    update: {
      email: DEMO_IDENTITIES.EMAIL,
      emailVerified: true,
      name: 'Demo User',
    },
    create: {
      id: DEMO_IDENTITIES.USER_ID,
      email: DEMO_IDENTITIES.EMAIL,
      emailVerified: true,
      name: 'Demo User',
      passwordHash: '$2a$12$demo_is_a_mock_user_password_hash_for_demo_only',
    },
  });
  console.log('[seed-demo] Usuário demo criado/atualizado');

  // ========================================
  // 2. Member (admin role via upsert)
  // ========================================
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: DEMO_IDENTITIES.ORG_ID, userId: DEMO_IDENTITIES.USER_ID } },
    update: { role: 'admin' },
    create: { organizationId: DEMO_IDENTITIES.ORG_ID, userId: DEMO_IDENTITIES.USER_ID, role: 'admin' },
  });
  console.log('[seed-demo] Membership admin criado');

  // ========================================
  // 3. Contatos fictícios
  // ========================================
  const contactJoao = await prisma.contact.upsert({
    where: { id: DEMO_IDS.CONTACT_JOAO },
    update: {},
    create: {
      id: DEMO_IDS.CONTACT_JOAO,
      organizationId: DEMO_IDENTITIES.ORG_ID,
      name: 'João Silva',
      email: 'joao@example.com',
      phone: '+5511999991111',
      waId: '5511999991111',
      consentMarketing: true,
    },
  });
  console.log('[seed-demo] Contato João Silva criado');

  const contactMaria = await prisma.contact.upsert({
    where: { id: DEMO_IDS.CONTACT_MARIA },
    update: {},
    create: {
      id: DEMO_IDS.CONTACT_MARIA,
      organizationId: DEMO_IDENTITIES.ORG_ID,
      name: 'Maria Oliveira',
      email: 'maria@example.com',
      phone: '+5511999992222',
      waId: '5511999992222',
      consentMarketing: true,
    },
  });
  console.log('[seed-demo] Contato Maria Oliveira criado');

  // ========================================
  // 4. Pipeline padrão
  // ========================================
  await prisma.pipeline.upsert({
    where: { id: DEMO_IDS.PIPELINE_DEFAULT },
    update: {},
    create: {
      id: DEMO_IDS.PIPELINE_DEFAULT,
      organizationId: DEMO_IDENTITIES.ORG_ID,
      name: 'Pipeline Padrão',
      stages: JSON.stringify([
        { id: 'prospecting', name: 'Prospecção', order: 1 },
        { id: 'qualified', name: 'Qualificado', order: 2 },
        { id: 'proposal', name: 'Proposta', order: 3 },
        { id: 'closed', name: 'Fechado', order: 4 },
      ]),
    },
  });
  console.log('[seed-demo] Pipeline padrão criado');

  // ========================================
  // 5. Leads
  // ========================================
  const lead1 = await prisma.lead.upsert({
    where: { id: DEMO_IDS.LEAD_1 },
    update: {},
    create: {
      id: DEMO_IDS.LEAD_1,
      organizationId: DEMO_IDENTITIES.ORG_ID,
      contactId: contactJoao.id,
      source: 'imported',
      status: 'new',
    },
  });

  const lead2 = await prisma.lead.upsert({
    where: { id: DEMO_IDS.LEAD_2 },
    update: {},
    create: {
      id: DEMO_IDS.LEAD_2,
      organizationId: DEMO_IDENTITIES.ORG_ID,
      contactId: contactMaria.id,
      source: 'organic',
      status: 'qualified',
    },
  });
  console.log('[seed-demo] Leads criados');

  // ========================================
  // 6. Deal (oportunidade)
  // ========================================
  await prisma.deal.upsert({
    where: { id: DEMO_IDS.DEAL_1 },
    update: {},
    create: {
      id: DEMO_IDS.DEAL_1,
      organizationId: DEMO_IDENTITIES.ORG_ID,
      leadId: lead1.id,
      contactId: contactJoao.id,
      title: 'Oportunidade Demo - João Silva',
      value: '15000.00' as any, // Decimal string - Prisma 7 aceita
      stage: 'proposal',
    },
  });
  console.log('[seed-demo] Deal criado');

  // ========================================
  // 7. Campanha (canal manual)
  // ========================================
  const campaign = await prisma.campaign.upsert({
    where: { id: DEMO_IDS.CAMPAIGN_DEMO },
    update: {},
    create: {
      id: DEMO_IDS.CAMPAIGN_DEMO,
      organizationId: DEMO_IDENTITIES.ORG_ID,
      userId: DEMO_IDENTITIES.USER_ID,
      title: 'Campanha Demo WhatsApp',
      channel: 'manual',
      status: 'draft',
      message: 'Mensagem teste do modo demo - não é enviada para números reais.',
      resultKind: 'manual',
      audienceJson: JSON.stringify({ contactIds: [contactJoao.id] }),
      totalCount: 1,
      progress: 0,
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
    },
  });
  console.log('[seed-demo] Campanha criada');

  // ========================================
  // 8. Recipiente da campanha
  // ========================================
  await prisma.campaignRecipient.upsert({
    where: { campaignId_contactId: { campaignId: campaign.id, contactId: contactJoao.id } },
    update: {},
    create: {
      campaignId: campaign.id,
      contactId: contactJoao.id,
      organizationId: DEMO_IDENTITIES.ORG_ID,
      status: 'pending',
    },
  });
  console.log('[seed-demo] Recipiente criado');

  // ========================================
  // 9. Mensagem WhatsApp simulada
  // ========================================
  await prisma.message.upsert({
    where: { id: DEMO_IDS.MESSAGE_DEMO },
    update: {},
    create: {
      id: DEMO_IDS.MESSAGE_DEMO,
      organizationId: DEMO_IDENTITIES.ORG_ID,
      contactId: contactJoao.id,
      body: 'Olá! Esta é uma mensagem de demonstração (modo demo).',
      direction: 'outbound',
      status: 'sent',
    },
  });
  console.log('[seed-demo] Mensagem WhatsApp demo criada');

  // ========================================
  // 10. Canal OpenBSP simulado
  // ========================================
  await prisma.whatsappChannel.upsert({
    where: { id: DEMO_IDS.WHATSAPP_CHANNEL },
    update: {},
    create: {
      id: DEMO_IDS.WHATSAPP_CHANNEL,
      organizationId: DEMO_IDENTITIES.ORG_ID,
      provider: 'openbsp',
      status: 'PENDING',
      verifyToken: `demo-verify-token-${Date.now()}`,
      callbackUrl: 'http://localhost:3000/api/integrations/openbsp/incoming',
      tierLimitPer24h: 250,
    },
  });
  console.log('[seed-demo] Canal OpenBSP criado');

  // ========================================
  // 11. Template WhatsApp
  // ========================================
  await prisma.whatsappTemplate.upsert({
    where: { organizationId_name_language: { organizationId: DEMO_IDENTITIES.ORG_ID, name: 'welcome_message', language: 'pt_BR' } },
    update: {},
    create: {
      id: DEMO_IDS.WHATSAPP_TEMPLATE,
      organizationId: DEMO_IDENTITIES.ORG_ID,
      name: 'welcome_message',
      language: 'pt_BR',
      category: 'UTILITY',
      status: 'APPROVED',
    },
  });
  console.log('[seed-demo] Template WhatsApp criado');

  // ========================================
  // 12. Posts simulados
  // ========================================
  await prisma.post.upsert({
    where: { id: DEMO_IDS.POST_INSTAGRAM },
    update: {},
    create: {
      id: DEMO_IDS.POST_INSTAGRAM,
      organizationId: DEMO_IDENTITIES.ORG_ID,
      title: 'Post Demo Instagram',
      body: 'Post de demonstração do Instagram. Não é publicado em conta real.',
      status: 'draft',
    },
  });

  await prisma.post.upsert({
    where: { id: DEMO_IDS.POST_FACEBOOK },
    update: {},
    create: {
      id: DEMO_IDS.POST_FACEBOOK,
      organizationId: DEMO_IDENTITIES.ORG_ID,
      title: 'Post Demo Facebook',
      body: 'Post de demonstração do Facebook. Não é publicado em conta real.',
      status: 'pending',
    },
  });
  console.log('[seed-demo] Posts criados');

  // ========================================
  // 13. Memória de assistente IA
  // ========================================
  await prisma.agentMemory.upsert({
    where: { organizationId_userId_kind_memoryKey: { organizationId: DEMO_IDENTITIES.ORG_ID, userId: DEMO_IDENTITIES.USER_ID, kind: 'system', memoryKey: 'welcome_message' } },
    update: {},
    create: {
      organizationId: DEMO_IDENTITIES.ORG_ID,
      userId: DEMO_IDENTITIES.USER_ID,
      kind: 'system',
      memoryKey: 'welcome_message',
      valueJson: {
        message: 'Bem-vindo ao modo demo! Aqui são exibidos dados fictícios para testes.',
        timestamp: new Date().toISOString(),
      },
    },
  });
  console.log('[seed-demo] Memória de assistente IA criada');

  // ========================================
  // SUCESSO
  // ========================================
  console.log('[seed-demo] ✓ Seed concluído com sucesso!');
  console.log('  - Acesse http://localhost:3000/dev para entrar no modo demo');
  console.log('  - Nenhuma informação real foi criada ou modificada.');
}

main()
  .catch((e) => {
    console.error('[seed-demo] Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });