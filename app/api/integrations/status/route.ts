// app/api/integrations/status/route.ts
// GET /api/integrations/status — Get user's integrations status
// Retorna lista de integrações do usuário autenticado (não-sensível)
// Apenas conexões WhatsApp OpenBSP (sem Meta)

// RLS da 018 exige a GUC app.current_user_id, que só o Prisma define —
// o cliente anon/PostgREST sempre veria 0 linhas. Service role + filtro
// explícito por user_id (mesmo padrão de src/integrations/manual.ts).
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { isQueueUnavailable } from '@/lib/taskQueue';

export async function GET(req: NextRequest) {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const supabase = createServiceRoleClient();

    // Buscar canais WhatsApp OpenBSP via whatsapp_channels (migração 019)
    const { data: channelRows, error: channelError } = await supabase
      .from('whatsapp_channels')
      .select('*')
      .eq('organization_id', user.organizationId);

    if (channelError) {
      if (isQueueUnavailable(channelError)) {
        return NextResponse.json({ connected: false, integrations: [] }, { status: 200 });
      }
      console.error('[integrations/status] channelError:', channelError); return NextResponse.json({ error: 'internal_error', detail: JSON.stringify(channelError) }, { status: 500 });
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

    // Processar canais WhatsApp OpenBSP
    if (channelRows && channelRows.length > 0) {
      const channelIntegrations = channelRows.map((r: Record<string, unknown>) => {
        const provider = r.provider as string;
        const status = r.status as string;
        const phoneNumberId = r.phone_number_id as string | null;
        const wabaId = r.waba_id as string | null;
        const verifiedName = r.verified_name as string | null;
        const accessTokenEnc = r.accessTokenEnc as string | null;

        // Determinar modo e status baseado no provider e credenciais
        // Apenas OpenBSP — sem Meta
        let mode: string;
        let connStatus: string | null = null;
        let phoneNumber: string | null = null;

        if (provider === 'openbsp' && status === 'CONNECTED' && phoneNumberId) {
          mode = 'OFFICIAL';
          connStatus = 'CONNECTED';
          phoneNumber = (r.phone_number as string | null) ?? phoneNumberId;
        } else if (provider === 'openbsp' && status === 'PENDING') {
          mode = 'OFFICIAL';
          connStatus = 'PENDING';
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
      connected: integrations.some((i) => i.status === 'CONNECTED'),
      integrations,
    });
  } catch (e) { console.error('[status] FATAL:', e); return NextResponse.json({ error: 'internal_error', detail: String(((e as any)?.message) || e) }, { status: 500 });
  }
}





