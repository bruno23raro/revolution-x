// POST /api/integrations/whatsapp-official/disconnect — desconecta o canal
// oficial do tenant (019). Soft-delete: linha fica como DISCONNECTED sem o
// token (re-conectar via /connect sobrescreve). Não toca no WhatsApp legado QR.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '../../../../../src/lib/auth';
import { getChannelDecrypted } from '../../../../../src/integrations/whatsapp';
import { createServiceRoleClient } from '../../../../../src/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = createServiceRoleClient();
  const channel = await getChannelDecrypted(client, user.organizationId);
  if (!channel) return NextResponse.json({ error: 'no_channel' }, { status: 404 });

  await client
    .from('whatsapp_channels')
    .update({
      status: 'DISCONNECTED',
      accessTokenEnc: null,
      lastError: 'desconectado_pelo_usuario',
      updatedAt: new Date().toISOString(),
    })
    .eq('organizationId', user.organizationId);

  console.info('[openbsp] canal desconectado', { org: user.organizationId });
  return NextResponse.json({ ok: true, status: 'DISCONNECTED' });
}
