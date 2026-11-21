// POST /api/whatsapp/templates/[id]/test — envia teste do template via OpenBSP.
// Só templates APPROVED pela Meta podem ser disparados.

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/middleware/rate-limit';
import { getChannelDecrypted } from '@/integrations/whatsapp/channelRepo';
import { sendTemplateViaOpenBSP } from '@/integrations/openbsp/send';

export const dynamic = 'force-dynamic';

const ORG_BSP = (process.env.OPENBSP_ORG_ID ?? '').trim();

export async function POST(req: NextRequest, context: { params: { id: string } }) {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin' && user.role !== 'owner') {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const rateResult = await rateLimit(req, 'api', { windowMs: 60000, max: 10 });
  if (rateResult.limited) {
    return NextResponse.json({ ok: false, error: 'Rate limit excedido' }, { status: 429 });
  }

  const templateId = context.params.id;
  const template = await prisma.whatsappTemplate.findFirst({
    where: { id: templateId, organizationId: user.organizationId },
  });

  if (!template) {
    return NextResponse.json({ ok: false, error: 'Template não encontrado' }, { status: 404 });
  }

  if (template.status !== 'APPROVED') {
    return NextResponse.json(
      {
        ok: false,
        error: 'Template não aprovado',
        detail: `Status atual: ${template.status}. Aguardando aprovação da Meta.`,
      },
      { status: 400 },
    );
  }

  let body: { to: string; variables?: string[]; language?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 });
  }

  const to = (body.to ?? '').replace(/\D/g, '');
  if (to.length < 10) {
    return NextResponse.json({ ok: false, error: 'Destinatário inválido' }, { status: 400 });
  }

  const channel = await getChannelDecrypted(user.organizationId);
  if (!channel?.isOpenBSPConnected) {
    return NextResponse.json(
      { ok: false, error: 'channel_unavailable', detail: 'WhatsApp não conectado via OpenBSP' },
      { status: 409 },
    );
  }

  const r = await sendTemplateViaOpenBSP(
    channel,
    to,
    template.name,
    body.language ?? template.language,
    body.variables ?? [],
  );

  if (!r.ok) {
    return NextResponse.json(
      { ok: false, error: r.error ?? 'send_failed', details: r.details ?? null },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, messageId: r.messageId ?? null });
}