import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getChannelDecrypted } from '@/integrations/whatsapp/channelRepo';
import { openbspConfig, getTemplateStatus } from '@/integrations/whatsapp/openbsp/client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin' && user.role !== 'owner') {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
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
    return NextResponse.json({ ok: false, error: 'openbsp_not_configured' }, { status: 503 });
  }

  const locais = await prisma.whatsappTemplate.findMany({
    where: { organizationId: user.organizationId, status: { in: ['PENDING', 'APPROVED', 'REJECTED'] } },
    select: { id: true, name: true, language: true, status: true },
    take: 50,
  });

  let atualizados = 0;

  for (const t of locais) {
    const r = await getTemplateStatus(cfg, t.name, t.language);
    if (!r.ok || !r.data) continue;

    const d = r.data as unknown as Record<string, unknown>;
    const status = typeof d.status === 'string' ? d.status.toUpperCase() : null;
    if (!status || status === t.status) continue;

    const motivo =
      typeof d.rejection_reason === 'string'
        ? d.rejection_reason
        : typeof d.reason === 'string'
          ? d.reason
          : null;

    try {
      await prisma.whatsappTemplate.update({
        where: { id: t.id },
        data: {
          status,
          rejectionReason: status === 'REJECTED' ? motivo : null,
          lastCheckedAt: new Date(),
        },
      });
      atualizados += 1;
    } catch {
      /* segue os outros */
    }
  }

  return NextResponse.json({ ok: true, verificados: locais.length, atualizados });
}