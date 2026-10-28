// app/api/integrations/status/route.ts
// GET /api/integrations/status — Get user's integrations status
// Retorna lista de integrações do usuário autenticado (não-sensível)

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { isQueueUnavailable } from '@/lib/taskQueue';

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = await createClient();

    const { data: rows, error } = await supabase
      .from('integrations')
      .select(
        'id, channel, status, meta_account_id, meta_account_name, phone_number, waba_id, expires_at, created_at, updated_at, last_error'
      )
      .eq('user_id', user.id)
      .neq('status', 'DISCONNECTED')
      .order('created_at', { ascending: false });

    if (error) {
      if (isQueueUnavailable(error)) {
        return NextResponse.json({ connected: false, integrations: [] }, { status: 200 });
      }
      return NextResponse.json({ error: 'internal_error' }, { status: 500 });
    }

    const integrations = (rows ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      channel: r.channel,
      status: r.status,
      metaAccountId: r.meta_account_id,
      metaAccountName: r.meta_account_name,
      phoneNumber: r.phone_number,
      wabaId: r.waba_id,
      tokenExpiresAt: r.expires_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      lastError: r.last_error,
    }));

    return NextResponse.json({
      connected: integrations.length > 0,
      integrations,
    });
  } catch {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}