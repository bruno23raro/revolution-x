// DISPARO em massa via OpenBSP (sem dependência Meta)
//
// POST /api/whatsapp/send
//   { recipients?: [{to, text?}], to?: string[], text?, template?: {name, variables, language}, delayMs?, account? }
// → { ok, total, sent, failed, tracked, taskId?, results }
//
//
// PROVIDER-OPENBSP: Resolve contas apenas de whatsapp_channels (provider='openb').
// Sem dependência Meta/Graph API. Usa headers api-key + apikey do OpenBSP.
//
// O trabalho REAL (enviar) não depende da tabela de fila: se a fila estiver
// indisponível, o envio acontece e só o tracking é degradado (`tracked:false`),
// nunca o inverso.

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  createTask,
  startTask,
  markStep,
  completeTask,
  TaskQueueUnavailableError,
} from '@/lib/taskQueue';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendViaOpenBSP, sendTemplateViaOpenBSP, sendMassViaOpenBSP, type Recipient, type MassSendOptions } from '@/integrations/openbsp/send';

// Removido import decryptToken - OpenBSP usa token limpo

export const dynamic = 'force-dynamic';

const MAX_RECIPIENTS = 500;

// Tipo para resolução de conta OpenBSP
type Provider = 'openbsp';

interface ResolvedAccount {
  ok: true;
  provider: Provider;
  accessToken: string;      // OpenBSP: token limpo para headers
  phoneNumberId: string;    // phoneNumberId da whatsapp_channels
  row: Record<string, unknown>;
}

interface ResolveFailure {
  ok: false;
  reason: 'not_connected' | 'no_token' | 'account_not_found';
}

/**
 * Resolve uma conta OpenBSP (whatsapp_channels).
 * Apenas OpenBSP - sem busca Meta.
 */
async function resolveTenantOpenBSPAccess(
  organizationId: string,
  accountId?: string,
): Promise<ResolvedAccount | ResolveFailure> {
  const service = createServiceRoleClient();

  // Buscar apenas whatsapp_channels com provider='openbsp'
  // Tabelas 019 usam PascalCase (organizationId, wabaId, etc.)
  let q = service
    .from('whatsapp_channels')
    .select('id, provider, status, wabaId, phoneNumberId, phoneNumber, verifiedName, accessTokenEnc, lastError, tierLimitPer24h, sentWindow24h, windowStartedAt')
    .eq('organizationId', organizationId)
    .eq('provider', 'openbsp')
    .neq('status', 'DISCONNECTED');

  if (accountId) q = q.eq('id', accountId);
  const { data: channelData, error: channelError } = await q.limit(1).maybeSingle();

  if (channelError || !channelData) {
    return { ok: false, reason: accountId ? 'account_not_found' : 'not_connected' };
  }

  const channel = channelData as Record<string, unknown>;

  // OpenBSP: o accessToken já vem no formato adequado para headers diretos
  // (não é cifrado como Meta - o OpenBSP armazena o token plaintext ou codificado base64)
  const accessToken = channel.accessTokenEnc as string || '';

  return {
    ok: true,
    provider: 'openbsp',
    accessToken: accessToken, // Token OpenBSP direto nos headers
    phoneNumberId: channel.phoneNumberId as string || '',
    row: channel,
  };
}

export async function POST(req: NextRequest) {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, any>;
  try {
    body = (await req.json()) as Record<string, any>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const recipients: Recipient[] = normalizeRecipients(body);
  if (recipients.length === 0) {
    return NextResponse.json({ error: 'recipients vazios' }, { status: 400 });
  }
  if (recipients.length > MAX_RECIPIENTS) {
    return NextResponse.json(
      { error: `limite de ${MAX_RECIPIENTS} destinatários por disparo` },
      { status: 400 },
    );
  }

  // MULTICONTAS — `account` (row id) ancora a conta específica
  const account = body.account ? String(body.account).trim() : undefined;

  // RESOLVER CONTA OPENBSP (sem Meta)
  const resolved = await resolveTenantOpenBSPAccess(user.organizationId, account);
  if (!resolved.ok) {
    const status = resolved.reason === 'not_connected' || resolved.reason === 'account_not_found' ? 409 : 503;
    const detail = resolved.reason === 'account_not_found' && account
      ? `Conta "${account}" não encontrada`
      : 'Conta OpenBSP não conectada';
    return NextResponse.json(
      { ok: false, error: resolved.reason, detail, total: 0, sent: 0, failed: 0 },
      { status },
    );
  }

  const opts: MassSendOptions = {
    delayMs: typeof body.delayMs === 'number' ? Math.max(0, Math.min(body.delayMs, 60000)) : 0,
    template: body.template?.name
      ? {
          name: String(body.template.name),
          variables: Array.isArray(body.template.variables) ? body.template.variables.map((v: unknown) => String(v)) : [],
          language: body.template.language ? String(body.template.language) : undefined,
        }
      : undefined,
  };

  const scope = { organizationId: user.organizationId, userId: user.id };
  const stepNames = ['resolver', `enviar ${recipients.length}`, 'concluir'];

  // Tracking best-effort: a fila não pode bloquear o trabalho real.
  let taskId: string | null = null;
  let tracked = false;
  try {
    const created = await createTask(prisma, scope, {
      title: 'Disparo em massa WhatsApp OpenBSP',
      steps: stepNames,
      input: { count: recipients.length, hasTemplate: Boolean(opts.template), provider: resolved.provider },
    });
    taskId = created.taskId;
    await startTask(prisma, scope, taskId);
    tracked = true;
    await markStep(prisma, scope, taskId, 0, 'done').catch(() => {});
  } catch (e) {
    if (e instanceof TaskQueueUnavailableError) tracked = false;
    else throw e;
  }

  // TRABALHO REAL - OPENBSP
  let result: { total: number; sent: number; failed: number; results: unknown[] };

  // Semp usar OpenBSP - esta é a única provider
  result = await sendMassViaOpenBSP(resolved, recipients, opts);

  if (tracked && taskId) {
    try {
      await markStep(prisma, scope, taskId, 1, 'done', { sent: result.sent, failed: result.failed });
      await completeTask(prisma, scope, taskId, {
        result: { total: result.total, sent: result.sent, failed: result.failed },
      });
    } catch (e) {
      if (!(e instanceof TaskQueueUnavailableError)) throw e;
    }
  }

  return NextResponse.json(
    { ok: true, total: result.total, sent: result.sent, failed: result.failed, tracked, taskId, results: result.results, provider: resolved.provider },
    { status: 200 },
  );
}

function normalizeRecipients(body: Record<string, any>): Recipient[] {
  const out: Recipient[] = [];
  if (Array.isArray(body.recipients)) {
    for (const r of body.recipients) {
      const to = r?.to != null ? String(r.to).trim() : '';
      if (to) out.push({ to, text: r?.text != null ? String(r.text) : undefined });
    }
  } else if (Array.isArray(body.to)) {
    const text = body.text != null ? String(body.text) : undefined;
    for (const t of body.to) {
      const to = t != null ? String(t).trim() : '';
      if (to) out.push({ to, text });
    }
  }
  // dedup por número
  const seen = new Set<string>();
  return out.filter((r) => (seen.has(r.to) ? false : (seen.add(r.to), true)));
}