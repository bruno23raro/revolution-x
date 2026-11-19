// FASE 1 — Sincronizar template específico do OpenBSP.
//
//   POST /api/whatsapp/templates/[id]/sync → { ok, template }  (admin)
//
// Sincroniza os detalhes de um template específico do OpenBSP
// e atualiza o snapshot local via upsertTemplateRow.

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/middleware/rate-limit';
import { getChannelDecrypted } from '@/integrations/whatsapp/channelRepo';
import { openbspConfig, getTemplateStatus } from '@/integrations/whatsapp/openbsp/client';
import { upsertTemplateRow } from '@/integrations/whatsapp/channelRepo';

export const dynamic = 'force-dynamic';

async function requireAdmin(req: NextRequest) {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user) return null;
  if (user.role === 'admin' || user.role === 'owner') return user;
  return null;
}

export async function POST(req: NextRequest, context: { params: { id: string } }) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  // Rate limiting
  const rateResult = await rateLimit(req, 'admin', { windowMs: 60000, max: 10 });
  if (rateResult.limited) {
    return NextResponse.json(
      { ok: false, error: 'Rate limit excedido', rateLimit: { remaining: 0, resetIn: rateResult.resetIn } },
      { status: 429 }
    );
  }

  const templateId = context.params.id;
  if (!templateId) {
    return NextResponse.json({ ok: false, error: 'Template ID é obrigatório' }, { status: 400 });
  }

  const localTemplate = await prisma.whatsappTemplate.findFirst({
    where: {
      id: templateId,
      organizationId: user.organizationId,
    },
  });

  if (!localTemplate) {
    return NextResponse.json({ ok: false, error: 'Template não encontrado' }, { status: 404 });
  }

  const channel = await getChannelDecrypted(user.organizationId);
  if (!channel?.isOpenBSPConnected) {
    return NextResponse.json(
      { ok: false, error: 'channel_unavailable', detail: 'WhatsApp não conectado via OpenBSP' },
      { status: 409 },
    );
  }

  const cfg = openbspConfig();
  if (!cfg) {
    return NextResponse.json(
      { ok: false, error: 'openbsp_not_configured', detail: 'OpenBSP não configurado no servidor' },
      { status: 503 },
    );
  }

  const result = await getTemplateStatus(cfg, localTemplate.name, localTemplate.language);

  const response = NextResponse.json(
    { ok: result.ok, template: result.data, error: result.error, errorDetail: result.errorDetail },
    { status: result.ok ? 200 : 502 }
  );
  response.headers.set('X-RateLimit-Remaining', String(rateResult.remaining));

  if (result.ok && result.data) {
    await upsertTemplateRow({
      organizationId: user.organizationId,
      name: result.data.name,
      language: result.data.language,
      category: result.data.category,
      status: result.data.status,
      metaTemplateId: result.data.id,
      componentsJson: result.data.components,
      rejectionReason: result.data.rejection_reason ?? null,
    });

    await prisma.whatsappTemplate.update({
      where: { id: templateId, organizationId: user.organizationId },
      data: { lastCheckedAt: new Date(), updatedAt: new Date() },
    });
  }

  return response;
}