// FASE 17 — Rotas de campanhas e disparos (§1/§10).
//
// GET /api/campaigns            → lista da org (tenant-scoped) + contagens
// POST /api/campaigns           → cria rascunho (validação de payload via Zod)
//
// Segura por padrão: `organizationId` e `userId` NUNCA vêm do body
// (mass-assignment guard). Nenhum envio acontece na criação — a campanha
// nasce `draft` (§10).

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { campaignRepoReal } from '@/repositories/campaignRepoReal';
import { campaignCreateSchema } from '@/lib/validation/schemas';
import { withTenantContext } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

const CHANNELS = ['whatsapp', 'whatsapp_api', 'email', 'manual'] as const;

export async function GET(req: NextRequest) {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const items = await campaignRepoReal.list(user.organizationId);
  type Row = (typeof items)[number];
  type Counts = Awaited<ReturnType<typeof campaignRepoReal.recipientCounts>>;
  const withCounts: Array<Row & { counts: Counts }> = [];
  for (const c of items) {
    const counts = await campaignRepoReal.recipientCounts(user.organizationId, c.id);
    withCounts.push({ ...c, counts });
  }
  return NextResponse.json({ organizationId: user.organizationId, items: withCounts });
}

export async function POST(req: NextRequest) {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = campaignCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_payload', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // server-derived tenant and user - use UncheckedCreateInput for direct FKs
  const data: Prisma.CampaignUncheckedCreateInput = {
    userId: user.id,
    organizationId: user.organizationId,
    ...parsed.data,
    // Ensure Json fields are properly typed
    variables: parsed.data.variables as Prisma.InputJsonValue,
    audienceJson: parsed.data.audienceJson as Prisma.InputJsonValue,
  };

  const campaign = await withTenantContext(user.organizationId, async (tx) => {
    return tx.campaign.create({ data });
  });

  console.info('[campaigns] criada', { org: user.organizationId, id: (campaign as { id?: string }).id, channel: data.channel });

  return NextResponse.json({ campaign }, { status: 201 });
}