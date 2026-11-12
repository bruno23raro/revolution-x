// POST /api/integrations/send-campaign/{channel}
// Envia uma campanha de mensagens para contatos selecionados
//
// Body: { campaignId, recipients?: string[], segment?: string, template?: {...} }
// Retorna: { ok, taskId, total, sent, pending, results }

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendMassViaOpenBSP } from '@/integrations/openbsp/send';

export const dynamic = 'force-dynamic';

type Channel = 'whatsapp';

interface CampaignSendRequest {
  campaignId: string;
  recipients?: string[];  // IDs de contatos ou telefones
  segment?: string;       // Segmento de contatos
  templateName?: string;
  templateVariables?: Record<string, string>;
  scheduleAt?: string;    // ISO date para envio agendado
}

interface CampaignRecord {
  id: string;
  organization_id: string;
  name: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  template_name?: string;
  template_variables?: Record<string, any>;
  recipients_count: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  scheduled_at?: string;
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const channel = url.searchParams.get('channel') || url.pathname.split('/').pop();

  if (channel !== 'whatsapp') {
    return NextResponse.json({
      error: 'Channel não suportado para campanhas',
      supported: ['whatsapp']
    }, { status: 400 });
  }

  const body: CampaignSendRequest = await req.json().catch(() => ({ campaignId: '' }));

  if (!body.campaignId) {
    return NextResponse.json({ error: 'campaignId é obrigatório' }, { status: 400 });
  }

  // Buscar campanha
  const service = createServiceRoleClient();
  const { data: campaign, error: campErr } = await service
    .from('campaigns')
    .select('*')
    .eq('id', body.campaignId)
    .eq('organization_id', user.organizationId)
    .single();

  if (campErr || !campaign) {
    return NextResponse.json({
      error: 'Campanha não encontrada',
      campaignId: body.campaignId
    }, { status: 404 });
  }

  const camp = campaign as CampaignRecord;

  // Verificar se já foi enviada
  if (camp.status === 'sent') {
    return NextResponse.json({
      error: 'Campanha já foi enviada',
      status: camp.status
    }, { status: 409 });
  }

  // Buscar contatos destinatários
  let recipients: string[] = [];

  if (body.recipients && body.recipients.length > 0) {
    recipients = body.recipients;
  } else if (body.segment) {
    // Buscar contatos pelo segmento
    const { data: segContacts, error: segErr } = await service
      .from('crm_contacts_subsegments')
      .select('contact_id, contact:contacts(phone)')
      .eq('organization_id', user.organizationId)
      .eq('segment', body.segment);

    if (!segErr && segContacts) {
      recipients = segContacts
        .map((s: any) => s.contact?.phone || s.contact?.[0]?.phone)
        .filter(Boolean);
    }
  } else {
    // Buscar todos contatos da organização
    const { data: allContacts, error: allErr } = await service
      .from('crm_contacts')
      .select('phone_number')
      .eq('organization_id', user.organizationId);

    if (!allErr && allContacts) {
      recipients = allContacts.map((c: any) => c.phone_number).filter(Boolean);
    }
  }

  if (recipients.length === 0) {
    return NextResponse.json({
      error: 'Nenhum destinatário encontrado',
      segment: body.segment,
      campaignId: body.campaignId
    }, { status: 404 });
  }

  // Atualizar status da campanha para 'sending'
  await service
    .from('campaigns')
    .update({ status: 'sending', sent_count: 0, failed_count: 0 })
    .eq('id', body.campaignId);

  // Preparar template - OpenBSP usa array de strings para variáveis
  const templateVars = body.templateVariables || camp.template_variables || {};
  const variablesArray = Array.isArray(templateVars)
    ? templateVars
    : Object.values(templateVars as Record<string, unknown>).filter(v => v !== undefined && v !== null);
  const template = {
    name: body.templateName || camp.template_name || 'default',
    variables: variablesArray.map(v => String(v)),
    language: body.templateVariables?.language || 'pt_BR',
  };

  try {
    // Enviar via OpenBSP
    const result = await sendMassViaOpenBSP(
      { organizationId: user.organizationId },
      recipients.map(phone => ({ to: phone })),
      { template }
    );

    // Atualizar status da campanha
    await service
      .from('campaigns')
      .update({
        status: result.failed > 0 ? 'failed' : 'sent',
        sent_count: result.sent,
        failed_count: result.failed,
        last_sent_at: new Date().toISOString(),
      })
      .eq('id', body.campaignId);

    return NextResponse.json({
      ok: true,
      campaignId: body.campaignId,
      channel,
      total: result.total,
      sent: result.sent,
      failed: result.failed,
      results: result.results,
    }, { status: 200 });

  } catch (e) {
    console.error('[send-campaign] Erro:', e);

    // Atualizar status para failed
    await service
      .from('campaigns')
      .update({
        status: 'failed',
        failed_count: recipients.length,
        error_message: e instanceof Error ? e.message : 'Unknown error'
      })
      .eq('id', body.campaignId);

    return NextResponse.json({
      error: 'Falha ao enviar campanha',
      detail: e instanceof Error ? e.message : 'Unknown error',
      campaignId: body.campaignId,
      sent: 0,
      failed: recipients.length,
    }, { status: 500 });
  }
}

// GET para buscar status de campanha
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const campaignId = url.searchParams.get('campaignId');

  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId é obrigatório' }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { data: campaign, error } = await service
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('organization_id', user.organizationId)
    .single();

  if (error || !campaign) {
    return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    total: campaign.recipients_count,
    sent: campaign.sent_count,
    failed: campaign.failed_count,
    createdAt: campaign.created_at,
    scheduledAt: campaign.scheduled_at,
    template: campaign.template_name,
  }, { status: 200 });
}