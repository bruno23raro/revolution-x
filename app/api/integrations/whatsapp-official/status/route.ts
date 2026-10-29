// GET /api/integrations/whatsapp-official/status — estado do canal OFICIAL
// para o card em /integracoes (nunca expõe tokens; só identificadores).

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '../../../../../src/lib/auth';
import { getChannelDecrypted, checkTier } from '../../../../../src/integrations/whatsapp';
import { createServiceRoleClient } from '../../../../../src/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const channel = await getChannelDecrypted(createServiceRoleClient(), user.organizationId);
  if (!channel || channel.status === 'PENDING') {
    return NextResponse.json({ connected: false, status: channel?.status ?? 'NONE' });
  }
  const tier = checkTier(channel);
  return NextResponse.json({
    connected: channel.status === 'CONNECTED',
    status: channel.status,
    provider: channel.provider,
    phoneNumber: channel.phoneNumber,
    verifiedName: channel.verifiedName,
    tier: { sent: tier.sent, limit: tier.limit, nearLimit: tier.nearLimit },
  });
}
