import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { getChannelDecrypted } from '@/integrations/whatsapp/channelRepo';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const channel = await getChannelDecrypted(user.organizationId);
  if (!channel?.isOpenBSPConnected) {
    return NextResponse.json({ ok: true, accounts: [] });
  }

  return NextResponse.json({
    ok: true,
    accounts: [
      {
        id: channel.id,
        phoneNumberId: channel.phoneNumberId,
        phoneNumber: channel.phoneNumber,
        verifiedName: channel.verifiedName,
        status: channel.status,
      },
    ],
  });
}