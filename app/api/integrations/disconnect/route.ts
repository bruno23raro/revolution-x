// app/api/integrations/disconnect/route.ts
// POST /api/integrations/disconnect — desconecta o canal WhatsApp (OpenBSP).
// Sem Meta: o estado vive em whatsapp_channels e o soft delete é status DISCONNECTED.

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { integrationId?: string; channel?: string; revokeToken?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { integrationId, channel } = body;

  if (!integrationId && !channel) {
    return NextResponse.json({ error: 'integrationId ou channel obrigatório' }, { status: 400 });
  }

  try {
    const supabase = createServiceRoleClient();

    let query = supabase
      .from('whatsapp_channels')
      .select('id, provider, status, phone_number_id')
      .eq('organization_id', user.organizationId);

    if (integrationId) {
      query = query.eq('id', integrationId);
    }

    const { data: channels, error: fetchError } = await query;

    if (fetchError) {
      console.error('[integrations-disconnect] fetch error:', fetchError);
      return NextResponse.json({ error: 'internal_error', detail: JSON.stringify(fetchError) }, { status: 500 });
    }

    if (!channels || channels.length === 0) {
      return NextResponse.json({ error: 'Integração não encontrada' }, { status: 404 });
    }

    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const ch of channels) {
      const { error: updateError } = await supabase
        .from('whatsapp_channels')
        .update({
          status: 'DISCONNECTED',
          access_token_enc: null,
          last_error: 'Desconectado pelo usuário',
          updated_at: new Date().toISOString(),
        })
        .eq('id', ch.id)
        .eq('organization_id', user.organizationId);

      if (updateError) {
        console.error('[integrations-disconnect] db error:', updateError);
        results.push({ id: ch.id, success: false, error: 'db_error' });
      } else {
        results.push({ id: ch.id, success: true });
      }
    }

    return NextResponse.json({ disconnected: true, results });
  } catch (e) {
    console.error('[integrations-disconnect] FATAL:', e);
    return NextResponse.json({ error: 'internal_error', detail: String((e && (e as Error).message) || e) }, { status: 500 });
  }
}
