// DISPARO em massa via OpenBSP (sem dependência Meta)
//
// POST /api/whatsapp/send
//   { recipients?: [{to, text?}], to?: string[], text?, template?: {name, variables, language}, delayMs?, account? }
// → { ok, total, sent, failed, tracked, taskId?, results }
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
import { whatsappSendSchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';

const MAX_RECIPIENTS = 500;

type Provider = 'openbsp';

interface ResolvedAccount {
  ok: true;
  provider: Provider;
  accessToken: string;
  phoneNumberId: string;
  row: Record<string, unknown>;
}

interface ResolveFailure {
  ok: false;
  reason: 'not_connected' | 'no_token' | 'account_not_found';
}

async function resolveTenantOpenBSPAccess(
  organizationId: string,
  accountId?: string,
): Promise<ResolvedAccount | ResolveFailure> {
  const service = createServiceRoleClient();

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
  const accessToken = channel.accessTokenEnc as string || '';

  return {
    ok: true,
    provider: 'openbsp',
    accessToken: accessToken,
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

  // Validate with Zod schema
  const parsed = whatsappSendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_payload', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const recipients: Recipient[] = normalizeRecipients({
    to: parsed.data.to,
    recipients: parsed.data.recipients,
    text: parsed.data.text,
  });
  if (recipients.length === 0) {
    return NextResponse.json({ error: 'recipients vazios' }, { status: 400 });
  }
  if (recipients.length > MAX_RECIPIENTS) {
    return NextResponse.json(
      { error: `limite de ${MAX_RECIPIENTS} destinatários por disparo` },
      { status: 400 },
    );
  }

  const account = parsed.data.account;

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
    delayMs: parsed.data.delayMs ?? 0,
    template: parsed.data.template?.name
      ? {
          name: parsed.data.template.name,
          variables: parsed.data.template.variables ?? [],
          language: parsed.data.template.language,
        }
      : undefined,
  };

  const scope = { organizationId: user.organizationId, userId: user.id };
  const stepNames = ['resolver', `enviar ${recipients.length}`, 'concluir'];

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

  let result: { total: number; sent: number; failed: number; results: unknown[] };

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

function normalizeRecipients(data: { to?: string[]; recipients?: Array<{ to: string; text?: string }>; text?: string }): Recipient[] {
  const out: Recipient[] = [];
  if (Array.isArray(data.recipients)) {
    for (const r of data.recipients) {
      const to = r?.to != null ? String(r.to).trim() : '';
      if (to) out.push({ to, text: r?.text != null ? String(r.text) : undefined });
    }
  } else if (Array.isArray(data.to)) {
    const text = data.text != null ? String(data.text) : undefined;
    for (const t of data.to) {
      const to = t != null ? String(t).trim() : '';
      if (to) out.push({ to, text });
    }
  }
  const seen = new Set<string>();
  return out.filter((r) => (seen.has(r.to) ? false : (seen.add(r.to), true)));
}