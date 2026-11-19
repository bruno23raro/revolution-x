// POST /api/integrations/whatsapp-official/disconnect — desconecta o canal
// oficial do tenant (019). Soft-delete: linha fica como DISCONNECTED sem o
// token (re-conectar via /connect sobrescreve). Não toca no WhatsApp legado QR.

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { getChannelDecrypted } from '@/integrations/whatsapp';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const channel = await getChannelDecrypted(user.organizationId);
  if (!channel) return NextResponse.json({ error: 'no_channel' }, { status: 404 });

  await prisma.whatsappChannel.update({
    where: { organizationId: user.organizationId },
    data: {
      status: 'DISCONNECTED',
      accessTokenEnc: null,
      lastError: 'desconectado_pelo_usuario',
      updatedAt: new Date(),
    },
  });

  console.info('[openbsp] canal desconectado', { org: user.organizationId });
  return NextResponse.json({ ok: true, status: 'DISCONNECTED' });
}
