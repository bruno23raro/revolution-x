import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== VERIFICAÇÃO DE DADOS DEMO ===\n');

  // Organização
  const org = await prisma.organization.findUnique({
    where: { id: '00000000-0000-0000-0000-000000000002' }
  });
  console.log('Org:', org?.name, org?.id);

  // Contatos
  const contacts = await prisma.contact.findMany({
    where: { organizationId: '00000000-0000-0000-0000-000000000002' }
  });
  console.log('Contacts:', contacts.length, '-', contacts.map(c => c.name).join(', '));

  // Lead status
  const joaoStatus = await prisma.contact.findUnique({
    where: { id: 'a6f1b153-8c51-4a20-8d2c-562bf6d99be2' }
  });
  console.log('João status:', joaoStatus?.status);

  // Leads
  const leads = await prisma.lead.findMany({
    where: { organizationId: '00000000-0000-0000-0000-000000000002' }
  });
  console.log('Leads:', leads.length);
  leads.forEach(l => console.log('  -', l.title, 'status:', l.status));

  // Deals
  const deals = await prisma.deal.findMany({
    where: { organizationId: '00000000-0000-0000-0000-000000000002' }
  });
  console.log('Deals:', deals.length, '- valor total:', deals.reduce((sum, d) => sum + Number(d.value), 0));

  // WhatsApp Channel
  const waChannels = await prisma.whatsappChannel.findMany({
    where: { organizationId: '00000000-0000-0000-0000-000000000002' }
  });
  console.log('WA Channels:', waChannels.length, '- status:', waChannels.map(c => c.status));

  // Count total entities
  const counts = await Promise.all([
    prisma.organization.count({ where: { id: '00000000-0000-0000-0000-000000000002' } }),
    prisma.contact.count({ where: { organizationId: '00000000-0000-0000-0000-000000000002' } }),
    prisma.lead.count({ where: { organizationId: '00000000-0000-0000-0000-000000000002' } }),
    prisma.deal.count({ where: { organizationId: '00000000-0000-0000-0000-000000000002' } }),
    prisma.campaign.count({ where: { organizationId: '00000000-0000-0000-0000-000000000002' } }),
    prisma.whatsappTemplate.count({ where: { organizationId: '00000000-0000-0000-0000-000000000002' } }),
    prisma.whatsappChannel.count({ where: { organizationId: '00000000-0000-0000-0000-000000000002' } }),
    prisma.post.count({ where: { organizationId: '00000000-0000-0000-0000-000000000002' } }),
  ]);

  console.log('\n=== RESUMO TOTAL ===');
  console.log('Organization:', counts[0]);
  console.log('Contacts:', counts[1]);
  console.log('Leads:', counts[2]);
  console.log('Deals:', counts[3]);
  console.log('Campaigns:', counts[4]);
  console.log('WA Templates:', counts[5]);
  console.log('WA Channels:', counts[6]);
  console.log('Posts:', counts[7]);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});