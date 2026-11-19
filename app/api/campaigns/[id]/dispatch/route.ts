// FASE 17 — Disparo em lotes de campanha via OpenBSP
//
//   POST /api/campaigns/[id]/dispatch → { ok, sent, failed, remaining, progress }
//   Processa até batchSize destinatários pendentes, respeitando opt-out e tier limit.
//   Frontend faz polling até remaining === 0.

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { campaignRepoReal, type CampaignCounts } from '@/repositories/campaignRepoReal';
import { listMarketingContacts } from '@/repositories/contactImportRepo';
import { getChannelDecrypted, bumpSentWindow } from '@/integrations/whatsapp/channelRepo';
import { sendViaOpenbsp, templateContent, openbspConfig } from '@/integrations/whatsapp/openbsp/client';
import type { AudienceSpec } from '@/services/campaignService';
import { buildRecipientVars, buildRecipients, interpolateVars } from '@/services/campaignService';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  if (!isRecord(body)) body = {};

  const batchSize = Math.min(Math.max(Number(body.batchSize) || 10, 1), 50);

  const org = user.organizationId;
  const campaign = await campaignRepoReal.get(org, params.id);
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Só campanhas whatsapp_api usam OpenBSP
  if (campaign.channel !== 'whatsapp_api') {
    return NextResponse.json({ error: 'Canal não suportado para dispatch', channel: campaign.channel }, { status: 400 });
  }

  // Verificar canal conectado
  const channel = await getChannelDecrypted(org);
  if (!channel?.isOpenBSPConnected || !channel.phoneNumberId) {
    return NextResponse.json({ error: 'whatsapp_channel_not_connected' }, { status: 409 });
  }

  // Verificar tier limit (250/24h default)
  const tierLimit = channel.tierLimitPer24h ?? 250;
  const tierSent = channel.sentWindow24h ?? 0;
  if (tierSent >= tierLimit) {
    return NextResponse.json({
      error: 'tier_limit_reached',
      sent: tierSent,
      limit: tierLimit,
      hint: 'Limite de 24h do número atingido. Aguarde a janela virar.',
    }, { status: 429 });
  }

  // Replanejar destinatários pendentes
  const audience = (isRecord(campaign.audienceJson) ? campaign.audienceJson : {}) as AudienceSpec;
  const contacts = await listMarketingContacts(org);
  const { recipients, skipped: initialSkipped, reasons } = buildRecipients(contacts, audience, campaign.channel);

  // Filtrar apenas pendentes - usar pendingRecipients do repo
  const pendingRows = await campaignRepoReal.pendingRecipients(org, campaign.id, recipients.length);
  const pendingContactIds = pendingRows.map(r => r.contactId);
  const pendingContacts = contacts.filter(c => pendingContactIds.includes(c.id));

  let skipped = initialSkipped;

  if (pendingContacts.length === 0) {
    const counts = await campaignRepoReal.recipientCounts(org, campaign.id);
    return NextResponse.json({
      sent: 0,
      failed: 0,
      remaining: 0,
      progress: 100,
      skipped,
      skipReasons: reasons,
      counts,
    });
  }

  // Preparar payload
  let payload: { kind: 'text'; text: string } | { kind: 'template'; name: string; language: string; variables: string[] };
  try {
    const parsed = JSON.parse(campaign.message) as Record<string, unknown>;
    if (isRecord(parsed) && parsed.type === 'template' && typeof parsed.name === 'string') {
      payload = {
        kind: 'template',
        name: parsed.name,
        language: typeof parsed.language === 'string' ? parsed.language : 'pt_BR',
        variables: Array.isArray(parsed.variables) ? parsed.variables.map(String) : [],
      };
    } else {
      payload = { kind: 'text', text: campaign.message };
    }
  } catch {
    payload = { kind: 'text', text: campaign.message };
  }

  const cfg = openbspConfig();
  if (!cfg || !cfg.orgId) {
    return NextResponse.json({ error: 'openbsp_not_configured' }, { status: 503 });
  }

  const access = {
    phoneNumberId: channel.phoneNumberId,
    accessToken: channel.accessToken ?? undefined,
    wabaId: channel.wabaId ?? undefined,
  };

  let sent = 0;
  let failed = 0;
  const updates: Array<{
    contactId: string;
    status: 'sent' | 'failed';
    attempts: number;
    externalMessageId?: string | null;
    lastError?: string | null;
  }> = [];

  for (const contact of pendingContacts.slice(0, batchSize)) {
    // Verificar opt-out
    if (contact.optOut || !contact.consentMarketing) {
      updates.push({
        contactId: contact.id,
        status: 'failed',
        attempts: 0,
        lastError: 'opt_out',
      });
      skipped++;
      continue;
    }

    // Verificar tier limit em tempo real
    const currentTier = await getChannelDecrypted(org);
    if (currentTier && (currentTier.sentWindow24h ?? 0) >= (currentTier.tierLimitPer24h ?? 250)) {
      failed++;
      updates.push({
        contactId: contact.id,
        status: 'failed',
        attempts: 0,
        lastError: 'tier_limit_reached',
      });
      break;
    }

    const to = contact.waId ?? contact.phone ?? contact.id;
    const vars = { ...((isRecord(campaign.variables) ? campaign.variables : {}) as Record<string, unknown>), ...buildRecipientVars(contact) };
    let content: Record<string, unknown>;

    if (payload.kind === 'template') {
      interpolateVars(payload.name, vars, ''); // Usa template name para interpolar variáveis
      content = templateContent(payload.name, payload.language, payload.variables);
    } else {
      const { text } = interpolateVars(campaign.message, vars, '');
      content = { version: '1', type: 'text', kind: 'text', text };
    }

    try {
      const result = await sendViaOpenbsp(access, to.replace(/^\+/, ''), content, { orgId: cfg.orgId! });
      if (result.ok) {
        sent++;
        await prisma.message.create({
          data: {
            externalId: result.data?.id ?? crypto.randomUUID(),
            toContact: to,
            direction: 'outbound',
            body: JSON.stringify(content),
            status: 'sent',
            organizationId: org,
          },
        });
        await prisma.messageStatus.create({
          data: {
            messageId: result.data?.id ?? crypto.randomUUID(),
            status: 'sent',
            organizationId: org,
            timestamp: new Date(),
          },
        });
        updates.push({
          contactId: contact.id,
          status: 'sent',
          attempts: 1,
          externalMessageId: result.data?.id ?? null,
        });
        await bumpSentWindow(channel, 1);
      } else {
        failed++;
        await prisma.message.create({
          data: {
            externalId: crypto.randomUUID(),
            toContact: to,
            direction: 'outbound',
            body: JSON.stringify(content),
            status: 'failed',
            organizationId: org,
          },
        });
        await prisma.messageStatus.create({
          data: {
            messageId: crypto.randomUUID(),
            status: 'failed',
            organizationId: org,
            timestamp: new Date(),
            errorCode: result.error,
            payload: result as any,
          },
        });
        updates.push({
          contactId: contact.id,
          status: 'failed',
          attempts: 1,
          lastError: result.errorDetail ?? result.error ?? 'send_failed',
        });
      }
    } catch (e) {
      failed++;
      const err = e instanceof Error ? e : new Error(String(e));
      updates.push({
        contactId: contact.id,
        status: 'failed',
        attempts: 1,
        lastError: err.message,
      });
    }
  }

  // Persistir updates em batch
  if (updates.length > 0) {
    await campaignRepoReal.markRecipients(org, campaign.id, updates);
  }

  // Atualizar contagens da campanha
  const counts = await campaignRepoReal.recipientCounts(org, campaign.id);
  const totalProcessed = sent + failed;
  const progress = counts.total > 0 ? Math.min(100, Math.round(((counts.sent + counts.failed) / counts.total) * 100)) : 0;

  return NextResponse.json({
    ok: true,
    sent,
    failed,
    remaining: pendingContacts.length - totalProcessed,
    progress,
    skipped,
    skipReasons: reasons,
    counts,
    nextBatchReady: pendingContacts.length > totalProcessed,
  });
}