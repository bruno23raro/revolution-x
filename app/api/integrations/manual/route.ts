// app/api/integrations/manual/route.ts
// GET /api/integrations/manual — lista contas MANUAis do usuário (sem tokens).

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { listManualAccounts, MANUAL_WHATSAPP_MAX } from '@/integrations/manual';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const accounts = await listManualAccounts(user.id);
    const whatsappUsed = accounts.filter((a) => a.channel === 'whatsapp').length;
    return NextResponse.json({
      accounts,
      limits: { whatsapp: { used: whatsappUsed, max: MANUAL_WHATSAPP_MAX } },
    });
  } catch {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
