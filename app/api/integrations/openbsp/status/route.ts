import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fetchConnectedAddress } from '@/integrations/whatsapp/openbsp/client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let canal: { verifyToken: string | null; status: string | null } | null = null;
  try {
    canal = await prisma.whatsappChannel.findUnique({
      where: { organizationId: user.organizationId },
      select: { verifyToken: true, status: true },
    });
  } catch {
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  const base = (process.env.OPENBSP_BASE_URL ?? '').trim();
  if (!base || !process.env.OPENBSP_PUBLISHABLE_KEY || !process.env.OPENBSP_API_KEY) {
    return NextResponse.json({ status: 'error', reason: 'openbsp_not_configured' });
  }

  if (!canal?.verifyToken) {
    return NextResponse.json({ status: 'pending', reason: 'aguardando_geracao_token' });
  }

  const r = await fetchConnectedAddress(canal.verifyToken, { timeoutMs: 10_000 });

  if (r.ok && r.data) {
    const endereco = r.data;

    // Reconcilia o canal local: sem isso o cartao fica DISCONNECTED para sempre.
    try {
      await prisma.whatsappChannel.update({
        where: { organizationId: user.organizationId },
        data: { status: 'CONNECTED' },
      });
    } catch {
      /* o status do provedor continua sendo a verdade */
    }

    return NextResponse.json({
      status: 'connected',
      wabaId: endereco.extra?.waba_id ?? null,
      phoneNumberId: endereco.address ?? null,
      displayName: endereco.extra?.verified_name ?? null,
      callback_url: endereco.extra?.callback_url ?? null,
    });
  }

  const detalhe = r.errorDetail ?? r.error ?? 'desconhecido';

  // Detalhe de provider nunca vira 'error': o link segue valido e o polling continua.
  if (canal.status === 'CONNECTED') {
    return NextResponse.json({ status: 'connected', reason: detalhe });
  }

  return NextResponse.json({ status: 'pending', reason: detalhe });
}