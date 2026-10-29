// GET /api/integrations/openbsp/callback â€” pÃ³s-popup: o front chama depois do
// postMessage/verificaÃ§Ã£o. Confirma conexÃ£o por POLLING de
// `organizations_addresses` (plano OpenBSP) casando o verify_token do tenant,
// e grava as credenciais (access_token AES-GCM). Sem webhook de conta no MVP.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '../../../../../src/lib/auth';
import { fetchConnectedAddress, getChannelDecrypted, markChannelConnected } from '../../../../../src/integrations/whatsapp';
import { createServiceRoleClient } from '../../../../../src/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const client = createServiceRoleClient();

  const channel = await getChannelDecrypted(client, user.organizationId);
  if (channel?.status === 'CONNECTED') {
    return NextResponse.json({ connected: true, phoneNumber: channel.phoneNumber, verifiedName: channel.verifiedName });
  }
  if (!channel) return NextResponse.json({ error: 'no_pending_channel' }, { status: 404 });

  const hit = await fetchConnectedAddress(channel.verifyToken);
  if (!hit.ok || !hit.data?.extra?.access_token) {
    return NextResponse.json({ connected: false, reason: hit.errorDetail ?? 'aguardando_onboarding' });
  }
  await markChannelConnected(client, user.organizationId, {
    wabaId: hit.data.extra.waba_id ?? null,
    phoneNumberId: hit.data.address,
    phoneNumber: hit.data.extra.phone_number ?? null,
    verifiedName: hit.data.extra.verified_name ?? null,
    accessToken: hit.data.extra.access_token,
  });
  console.info('[openbsp] canal conectado', { org: user.organizationId, pnid: hit.data.address });
  return NextResponse.json({
    connected: true,
    phoneNumber: hit.data.extra.phone_number ?? null,
    verifiedName: hit.data.extra.verified_name ?? null,
  });
}
