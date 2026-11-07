// app/api/integrations/status/route.ts
// GET /api/integrations/status — Get user's integrations status
// Retorna lista de integrações do usuário autenticado (não-sensível)
// Inclui conexões WhatsApp OpenBSP e Meta via whatsapp_channels + meta_integrations

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { isQueueUnavailable } from '@/lib/taskQueue';

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // RLS da 018 exige a GUC app.current_user_id, que so o Prisma define — o
    // cliente anon/PostgREST sempre veria 0 linhas. Service role + filtro
    // explicito por user_id (mesmo padrao de src/integrations/manual.ts).
    const supabase = createServiceRoleClient();

    // Buscar integrações Meta do tipo 'integrations' table
    const { data: metaRows, error: metaError } = await supabase
      .from('integrations')
      .select(
        'id, channel, mode, status, meta_account_id, meta_account_name, phone_number, waba_id, expires_at, created_at, updated_at, last_error, metadata'
      )
      .eq('user_id', user.id)
      .neq('status', 'DISCONNECTED')
      .order('created_at', { ascending: false });

    // Buscar canais WhatsApp (OpenBSP e Meta) via whatsapp_channels
    const { data: channelRows, error: channelError } = await supabase
      .from('whatsapp_channels')
      .select('*')
      .eq('organization_id', user.organizationId);

    if (metaError) {
      if (isQueueUnavailable(metaError)) {
        return NextResponse.json({ connected: false, integrations: [] }, { status: 200 });
      }
      return NextResponse.json({ error: 'internal_error' }, { status: 500 });
    }

    const integrations: Array<{
      id: string;
      channel: string;
      mode: string;
      status: string | null;
      metaAccountId: string | null;
      metaAccountName: string | null;
      phoneNumber: string | null;
      wabaId: string | null;
      tokenExpiresAt: string | null;
      createdAt: string | null;
      updatedAt: string | null;
      lastError: string | null;
      label: string | null;
    }> = [];

    // Processar integrações Meta
    if (metaRows && metaRows.length > 0) {
      const integrationsMeta = metaRows.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        channel: r.channel as string,
        mode: r.mode ?? 'OFFICIAL',
        status: r.status as string | null,
        metaAccountId: r.meta_account_id as string | null,
        metaAccountName: r.meta_account_name as string | null,
        phoneNumber: r.phone_number as string | null,
        wabaId: r.waba_id as string | null,
        tokenExpiresAt: r.expires_at as string | null,
        createdAt: r.created_at as string | null,
        updatedAt: r.updated_at as string | null,
        lastError: r.last_error as string | null,
        label: ((r.metadata as Record<string, unknown> | null)?.label as string | null) ?? null,
      }));
      integrations.push(...integrationsMeta);
    }

    // Processar canais WhatsApp (OpenBSP e Meta)
    if (channelRows && channelRows.length > 0) {
      const channelIntegrations = channelRows.map((r: Record<string, unknown>) => {
        const provider = r.provider as string;
        const status = r.status as string;
        const phoneNumberId = r.phone_number_id as string | null;
        const wabaId = r.waba_id as string | null;
        const verifiedName = r.verified_name as string | null;
        const accessTokenEnc = r.access_token_enc as string | null;

        // Determinar modo e status baseado no provider e credenciais
        let mode: string;
        let connStatus: string | null = null;
        let phoneNumber: string | null = null;

        if (provider === 'openbsp' && phoneNumberId) {
          // Conexão OpenBSP - reconhecida como API Oficial
          mode = 'OFFICIAL';
          connStatus = 'CONNECTED';
          phoneNumber = phoneNumberId;
        } else if (provider === 'openbsp' && !phoneNumberId && status === 'PENDING') {
          // OpenBSP em processo de onboarding
          mode = 'OFFICIAL';
          connStatus = 'PENDING';
        } else if (provider === 'meta_direct' || (provider === 'openbsp' && wabaId)) {
          // Conexão Meta (via wabaId)
          mode = 'OFFICIAL';
          connStatus = 'CONNECTED';
          phoneNumber = wabaId;
        } else if (provider === 'instagram') {
          // Instagram
          mode = 'OFFICIAL';
          connStatus = status;
        } else {
          mode = 'OFFICIAL';
          connStatus = 'DISCONNECTED';
        }

        return {
          id: r.id as string,
          channel: 'whatsapp',
          mode,
          status: connStatus,
          metaAccountId: null,
          metaAccountName: null,
          phoneNumber,
          wabaId,
          tokenExpiresAt: null,
          createdAt: r.created_at as string | null,
          updatedAt: r.updated_at as string | null,
          lastError: r.last_error as string | null,
          label: null,
        };
      });
      integrations.push(...channelIntegrations);
    }

    return NextResponse.json({
      connected: integrations.length > 0,
      integrations,
    });
  } catch {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}