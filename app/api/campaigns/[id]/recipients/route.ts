// FASE 17 — GET /api/campaigns/[id]/recipients (§10).
//
// Resultados POR DESTINATÁRIO da fila: nome/telefone do contato + status
// real (pending|sent|failed|skipped), attempts, externalMessageId,
// lastError, sentAt. Paginado (limit ≤100, offset ≥0). Somente contatos
// da MESMA org (isolamento multi-tenant: o repositório filtra por
// organizationId server-derived; uma campanha de outra org → 404).
//
// NUNCA aceita organizationId/tenant do body/query: a org vem do usuário
// autenticado (401 sem sessão).

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { campaignRepoReal } from '@/repositories/campaignRepoReal';

function parseLimit(v: string | null): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return 50;
  return Math.min(100, Math.floor(n));
}
function parseOffset(v: string | null): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // A campanha deve pertencer à org do usuário (404 para outra org).
  const campaign = await campaignRepoReal.get(user.organizationId, params.id);
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  if (status && !['pending', 'sent', 'failed', 'skipped'].includes(status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }

  const { items, total } = await campaignRepoReal.listRecipients(user.organizationId, params.id, {
    status: status ?? undefined,
    limit: parseLimit(searchParams.get('limit')),
    offset: parseOffset(searchParams.get('offset')),
  });

  return NextResponse.json({
    campaignId: campaign.id,
    total,
    limit: Math.min(100, Math.max(1, parseLimit(searchParams.get('limit')))),
    offset: parseOffset(searchParams.get('offset')),
    items,
  });
}