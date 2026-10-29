// FASE 17 — Rota de ações de campanha (§10/§11/§12).
//
// GET  /api/campaigns/[id]        → detalhe + contagens reais
// POST /api/campaigns/[id]        → {action}: start | resume | pause |
//   cancel | mark_manual_complete | preview
//
// Regras duras:
//  * WhatsApp exige SELEÇÃO EXPLÍCITA de conta/número (§7/§11): nunca há
//    "primeira conta conectada" como default silencioso. O `accountId` pode
//    vir do body (operação) ou estar ancorado na campanha (escolha explícita
//    na criação) — mas sempre validado contra a meta_integrations do tenant.
//  * Canal `email` não está implementado no envio: 409 honesto
//    (`channel_not_available_yet`), sem métricas fictícias (§18).
//  * Canal `manual`: a RX NUNCA envia; o usuário confirma fora da plataforma
//    (§12) — o registro só vira `completed` pela confirmação dele.
//  * `preview` interpola até 3 amostras SEM NENHUM envio (§16).
//  * Tenant: 404 para campanha de outra org (isolamento multi-tenant, §16).

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '../../../../src/lib/auth';
import { campaignRepoReal } from '../../../../src/repositories/campaignRepoReal';
import { listMarketingContacts } from '../../../../src/repositories/contactImportRepo';
import {
  canTransition,
  type AudienceSpec,
  type CampaignStatus,
  buildRecipientVars,
  buildRecipients,
  interpolateVars,
} from '../../../../src/services/campaignService';
import { executeCampaignBatch, mergeCounts } from '../../../../src/services/campaignExecutor';
import { resolveTenantMetaAccess } from '../../../../src/integrations/meta/resolveAccess';
import { sendWhatsAppText } from '../../../../src/integrations/meta/whatsappSender';
import { getChannelDecrypted, buildOfficialSender, checkTier } from '../../../../src/integrations/whatsapp';
import { createServiceRoleClient } from '../../../../src/lib/supabase/server';

const MAX_ACTION_ACCOUNT = 64;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const campaign = await campaignRepoReal.get(user.organizationId, params.id);
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const counts = await campaignRepoReal.recipientCounts(user.organizationId, campaign.id);
  return NextResponse.json({ campaign, counts });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  if (!isRecord(body)) body = {};
  const action = typeof body.action === 'string' ? body.action : '';

  const campaign = await campaignRepoReal.get(user.organizationId, params.id);
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const org = user.organizationId;
  const from = campaign.status as CampaignStatus;

  switch (action) {
    case 'start':
    case 'resume':
      return await doStart(req, user, campaign, body, org, from);
    case 'pause': {
      if (!canTransition(from, 'paused')) {
        return NextResponse.json({ error: 'invalid_state', from, to: 'paused' }, { status: 409 });
      }
      await campaignRepoReal.setStatus(org, campaign.id, 'paused', {});
      return NextResponse.json({ ok: true, status: 'paused' });
    }
    case 'cancel': {
      if (!canTransition(from, 'canceled')) {
        return NextResponse.json({ error: 'invalid_state', from, to: 'canceled' }, { status: 409 });
      }
      const skipped = await campaignRepoReal.markPendingSkipped(org, campaign.id);
      const skippedCount = (campaign.skippedCount ?? 0) + skipped;
      await campaignRepoReal.setStatus(org, campaign.id, 'canceled', {
        skippedCount,
        completedAt: new Date(),
      });
      return NextResponse.json({ ok: true, status: 'canceled', skipped });
    }
    case 'mark_manual_complete': {
      // §12: só campanha MANUAL (resultKind='manual') e a RX NUNCA afirma
      // ter enviado — a nota registra que a confirmação foi do usuário.
      if (campaign.resultKind !== 'manual') {
        return NextResponse.json({ error: 'not_manual_campaign' }, { status: 400 });
      }
      if (!canTransition(from, 'completed')) {
        return NextResponse.json({ error: 'invalid_state', from, to: 'completed' }, { status: 409 });
      }
      const notes =
        'Completado manualmente pelo usuário (§12): a plataforma NÃO enviou mensagens.';
      await campaignRepoReal.setStatus(org, campaign.id, 'completed', {
        completedAt: new Date(),
        manualNotes: notes,
      });
      return NextResponse.json({ ok: true, status: 'completed', note: notes });
    }
    case 'preview': {
      // §16: amostras interpoladas (escapadas), ZERO envios.
      const audience = (isRecord(campaign.audienceJson) ? campaign.audienceJson : {}) as AudienceSpec;
      let samples: Array<{ contactId: string; text: string; missing: string[] }> = [];
      const pending = await campaignRepoReal.pendingRecipients(org, campaign.id, 3);
      if (pending.length > 0) {
        for (const p of pending) {
          const vars = { ...((isRecord(campaign.variables) ? campaign.variables : {}) as Record<string, unknown>), ...buildRecipientVars(p.contact) };
          const { text, missing } = interpolateVars(campaign.message, vars, '');
          samples.push({ contactId: p.contactId, text, missing });
        }
      } else {
        // Sem fila ainda: amostra a partir da audiência atual (sem persistir).
        const contacts = await listMarketingContacts(org);
        const { recipients } = buildRecipients(contacts, audience, campaign.channel);
        for (const r of recipients.slice(0, 3)) {
          const c = contacts.find((x) => x.id === r.id);
          if (!c) continue;
          const vars = { ...((isRecord(campaign.variables) ? campaign.variables : {}) as Record<string, unknown>), ...buildRecipientVars(c) };
          const { text, missing } = interpolateVars(campaign.message, vars, '');
          samples.push({ contactId: r.id, text, missing });
        }
      }
      return NextResponse.json({
        samples,
        note: 'Prévia somente: nenhuma mensagem foi enviada (§16).',
      });
    }
    default:
      return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
  }
}

// ── start / resume: replaneia a fila, valida a conta, executa UM lote ──────

async function doStart(
  _req: NextRequest,
  user: { id: string; organizationId: string },
  campaign: {
    id: string;
    organizationId: string;
    channel: string;
    status: string;
    message: string;
    variables: unknown;
    audienceJson: unknown;
    batchJson: unknown;
    accountId: string | null;
    resultKind: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    totalCount: number;
    sentCount: number;
    failedCount: number;
    skippedCount: number;
    progress: number;
  },
  body: Record<string, unknown>,
  org: string,
  from: CampaignStatus,
) {
  const allowed = ['draft', 'awaiting_validation', 'scheduled', 'queued', 'paused', 'failed'];
  if (!allowed.includes(from)) {
    return NextResponse.json({ error: 'invalid_state', from, hint: 'terminal' }, { status: 409 });
  }

  // ── Canal manual (§12): aguarda ação do usuário; a RX não envia ─────────
  if (campaign.channel === 'manual') {
    if (!canTransition(from, 'awaiting_validation') && from !== 'awaiting_validation') {
      return NextResponse.json({ error: 'invalid_state', from, to: 'awaiting_validation' }, { status: 409 });
    }
    if (from !== 'awaiting_validation') {
      await campaignRepoReal.setStatus(org, campaign.id, 'awaiting_validation', {});
    }
    return NextResponse.json({
      ok: true,
      status: 'awaiting_validation',
      note: 'Aguardando ação manual do usuário (§12): nenhuma mensagem será enviada pela plataforma.',
    });
  }

  // ── Canal email: envio não implementado → honesto (§18) ─────────────────
  if (campaign.channel === 'email') {
    return NextResponse.json(
      { error: 'channel_not_available_yet', channel: 'email' },
      { status: 409 },
    );
  }

  // ── Canal whatsapp_api: WhatsApp OFICIAL (019) — tier/template gates ────
  if (campaign.channel === 'whatsapp_api') {
    return await doStartOfficial(campaign, org, from);
  }

  // ── Canal whatsapp: seleção EXPLÍCITA de conta (§7/§11) ────────────────
  let accountId: string | null = null;
  if (typeof body.accountId === 'string' && body.accountId.trim()) {
    if (body.accountId.length > MAX_ACTION_ACCOUNT) {
      return NextResponse.json({ error: 'invalid_account_id' }, { status: 400 });
    }
    accountId = body.accountId.trim();
  } else if (typeof campaign.accountId === 'string' && campaign.accountId) {
    accountId = campaign.accountId; // ancorada na criação (escolha explícita)
  }
  if (!accountId) {
    return NextResponse.json(
      {
        error: 'account_selection_required',
        hint: 'Selecione a conta (número) que fará o envio (§11: nunca há default silencioso).',
      },
      { status: 409 },
    );
  }

  const resolved = await resolveTenantMetaAccess(org, {}, accountId);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: 'account_unavailable', reason: resolved.reason, accountId },
      { status: 409 },
    );
  }
  const access = resolved.access;

  // ── Replaneia a fila (audiência atual, respeitando histórico) ───────────
  const audience = (isRecord(campaign.audienceJson) ? campaign.audienceJson : {}) as AudienceSpec;
  const contacts = await listMarketingContacts(org);
  const { recipients, skipped, reasons } = buildRecipients(contacts, audience, campaign.channel);
  const planned = await campaignRepoReal.replacePendingRecipients(
    org,
    campaign.id,
    recipients.map((r) => r.id),
  );

  // ── Transições até 'running' (máquina de estados, §10) ──────────────────
  const path: CampaignStatus[] =
    from === 'paused' || from === 'queued' ? ['running'] : ['queued', 'running'];
  for (let i = 0; i < path.length; i++) {
    const prev = i === 0 ? from : path[i - 1];
    if (!canTransition(prev, path[i])) {
      return NextResponse.json({ error: 'invalid_state', from: prev, to: path[i] }, { status: 409 });
    }
  }
  if (path[0] === 'queued') {
    await campaignRepoReal.setStatus(org, campaign.id, 'queued', {
      startedAt: campaign.startedAt ?? new Date(),
    });
  }

  // ── Executa UM lote (fila persistente: o resto continua pendente) ──────
  const sender = async (cid: string, to: string, text: string) => {
    const r = await sendWhatsAppText(access, to, text);
    if (r.ok) return { ok: true, externalMessageId: r.messageId };
    return { ok: false, error: r.errorDetail ? `${r.error}: ${r.errorDetail}` : r.error ?? 'send_failed' };
  };
  const withPlan = { ...campaign, totalCount: campaign.totalCount + planned.planned };
  const result = await executeCampaignBatch({ campaign: withPlan, sender });

  // ── Contagens acumuladas REAIS + progresso (Int 0–100) ──────────────────
  const merged = mergeCounts(withPlan, { sent: result.sent, failed: result.failed });
  const progress =
    merged.totalCount > 0
      ? Math.min(100, Math.round(((merged.sentCount + merged.failedCount) / merged.totalCount) * 100))
      : 0;

  const terminal = result.nextStatus === 'completed' || result.nextStatus === 'completed_partial';
  // 'running' é sempre o estado intermediário válido antes de um terminal
  // (máquina de estados §10) — persiste as contagens reais do lote.
  await campaignRepoReal.setStatus(org, campaign.id, 'running', {
    ...merged,
    progress,
    startedAt: campaign.startedAt ?? new Date(),
  });
  if (terminal && canTransition('running', result.nextStatus)) {
    await campaignRepoReal.setStatus(org, campaign.id, result.nextStatus, {
      ...merged,
      progress,
      completedAt: new Date(),
    });
  }

  const fresh = await campaignRepoReal.get(org, campaign.id);
  console.info('[campaigns] lote executado', {
    org,
    id: campaign.id,
    accountId,
    sent: result.sent,
    failed: result.failed,
    remaining: result.remaining,
  });

  return NextResponse.json({
    ok: true,
    status: terminal ? result.nextStatus : 'running',
    batch: { sent: result.sent, failed: result.failed, remaining: result.remaining },
    planned: planned.planned,
    skipped,
    skipReasons: reasons,
    // Seleção honesta do número (§11): o usuário vê QUAL conta enviou.
    account: { accountId, phoneNumberId: access.phoneNumberId },
    campaign: fresh,
  });
}

// ── whatsapp_api: SAME state machine + executor; o sender vem da factory
// oficial (tier 250/24h, gate template APPROVED, dual-path) em vez da conta
// Meta legado. `campaign.message` = texto livre OU JSON
// {"type":"template","name":...,"language":...} (variáveis = linhas do texto
// interpolado pelo executor).

async function doStartOfficial(
  campaign: {
    id: string;
    organizationId: string;
    channel: string;
    status: string;
    message: string;
    accountId: string | null;
    variables: unknown;
    audienceJson: unknown;
    batchJson: unknown;
    resultKind: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    totalCount: number;
    sentCount: number;
    failedCount: number;
    skippedCount: number;
    progress: number;
  },
  org: string,
  from: CampaignStatus,
) {
  const client = createServiceRoleClient();
  const channel = await getChannelDecrypted(client, org);
  if (!channel || channel.status !== 'CONNECTED' || !channel.phoneNumberId) {
    return NextResponse.json(
      { error: 'whatsapp_channel_not_connected', hint: 'Conecte o WhatsApp oficial em /integracoes.' },
      { status: 409 },
    );
  }
  const tier = checkTier(channel);
  if (!tier.allowed) {
    return NextResponse.json(
      { error: 'tier_limit_reached', sent: tier.sent, limit: tier.limit, hint: 'Limite de 24h do número atingido (auto-pause do tier Meta).' },
      { status: 429 },
    );
  }

  // Payload: template JSON ou texto livre (janela 24h — fora dela a Meta
  // devolve 131047 por destinatário, registrado em lastError).
  let payload: import('../../../../src/integrations/whatsapp').DispatchPayload = { kind: 'text', text: campaign.message };
  let expectedCategory: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION' | undefined;
  try {
    const parsed = JSON.parse(campaign.message) as Record<string, unknown>;
    if (isRecord(parsed) && parsed.type === 'template' && typeof parsed.name === 'string') {
      payload = {
        kind: 'template',
        name: parsed.name,
        language: typeof parsed.language === 'string' ? parsed.language : 'pt_BR',
        variables: Array.isArray(parsed.variables) ? parsed.variables.map(String) : [],
      };
      const CATS = new Set(['MARKETING', 'UTILITY', 'AUTHENTICATION']);
      expectedCategory = CATS.has(String(parsed.category))
        ? (parsed.category as typeof expectedCategory)
        : undefined;
    }
  } catch {
    /* texto livre */
  }

  // Replaneia a fila (audiência atual, mesmos gates de opt-in de 017).
  const audience = (isRecord(campaign.audienceJson) ? campaign.audienceJson : {}) as AudienceSpec;
  const contacts = await listMarketingContacts(org);
  const { recipients, skipped, reasons } = buildRecipients(contacts, audience, campaign.channel);
  const planned = await campaignRepoReal.replacePendingRecipients(
    org,
    campaign.id,
    recipients.map((r) => r.id),
  );

  const path: CampaignStatus[] =
    from === 'paused' || from === 'queued' ? ['running'] : ['queued', 'running'];
  for (let i = 0; i < path.length; i++) {
    const prev = i === 0 ? from : path[i - 1];
    if (!canTransition(prev, path[i])) {
      return NextResponse.json({ error: 'invalid_state', from: prev, to: path[i] }, { status: 409 });
    }
  }
  if (path[0] === 'queued') {
    await campaignRepoReal.setStatus(org, campaign.id, 'queued', { startedAt: campaign.startedAt ?? new Date() });
  }

  const sender = buildOfficialSender({ channel, client, payload, expectedCategory });
  const withPlan = { ...campaign, totalCount: campaign.totalCount + planned.planned };
  const result = await executeCampaignBatch({ campaign: withPlan, sender });

  const merged = mergeCounts(withPlan, { sent: result.sent, failed: result.failed });
  const progress =
    merged.totalCount > 0
      ? Math.min(100, Math.round(((merged.sentCount + merged.failedCount) / merged.totalCount) * 100))
      : 0;

  // Auto-pause do tier (gate 5): lote parou por limite de 24h → campanha
  // volta a 'paused' com nota honesta (nunca segue queimando retry).
  if (sender.lastResult.tierBlocked) {
    await campaignRepoReal.setStatus(org, campaign.id, 'running', { ...merged, progress });
    if (canTransition('running', 'paused')) {
      await campaignRepoReal.setStatus(org, campaign.id, 'paused', {
        ...merged,
        progress,
        errorText: `tier_limit_reached (${tier.sent}/${tier.limit} em 24h) — retomada automática quando a janela virar.`,
      });
    }
  } else {
    await campaignRepoReal.setStatus(org, campaign.id, 'running', { ...merged, progress, startedAt: campaign.startedAt ?? new Date() });
    const terminal = result.nextStatus === 'completed' || result.nextStatus === 'completed_partial';
    if (terminal && canTransition('running', result.nextStatus)) {
      await campaignRepoReal.setStatus(org, campaign.id, result.nextStatus, { ...merged, progress, completedAt: new Date() });
    }
  }

  const fresh = await campaignRepoReal.get(org, campaign.id);
  console.info('[campaigns] lote oficial executado', {
    org,
    id: campaign.id,
    via: 'whatsapp_api',
    sent: result.sent,
    failed: result.failed,
    remaining: result.remaining,
    tier: sender.lastResult,
  });

  return NextResponse.json({
    ok: true,
    status: sender.lastResult.tierBlocked ? 'paused' : fresh?.status ?? 'running',
    batch: { sent: result.sent, failed: result.failed, remaining: result.remaining },
    planned: planned.planned,
    skipped,
    skipReasons: reasons,
    tier: { sent: tier.sent + sender.lastResult.sentInRun, limit: tier.limit, nearLimit: sender.lastResult.nearLimit },
    alert80: sender.lastResult.nearLimit,
    account: { phoneNumberId: channel.phoneNumberId, verifiedName: channel.verifiedName },
    campaign: fresh,
  });
}
