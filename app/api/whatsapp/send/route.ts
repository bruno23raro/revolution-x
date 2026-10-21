// FASE 1 — Disparo em massa via Cloud API oficial da Meta.
//
// POST /api/whatsapp/send
//   { recipients?: [{to, text?}], to?: string[], text?, template?: {name, variables, language}, delayMs? }
// → { ok, total, sent, failed, tracked, taskId?, results }
//
// O trabalho REAL (enviar) não depende da tabela de fila: se a fila estiver
// indisponível, o envio acontece e só o tracking é degradado (`tracked:false`),
// nunca o inverso.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  createTask,
  startTask,
  markStep,
  completeTask,
  TaskQueueUnavailableError,
} from '@/lib/taskQueue';
import { runMassSend, type Recipient, type MassSendOptions } from '@/integrations/meta/whatsappSender';
import { resolveTenantMetaAccess } from '@/integrations/meta/resolveAccess';

export const dynamic = 'force-dynamic';

const MAX_RECIPIENTS = 500;

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

  // MULTICONTAS — `account` (row id da meta_integrations) ancora o número de
  // WhatsApp; ausente → conta padrão (mais recente).
  const account = body.account ? String(body.account).trim() : undefined;

  const resolved = await resolveTenantMetaAccess(user.organizationId, {}, account);
  if (!resolved.ok) {
    if (resolved.reason === 'account_not_found') {
      return NextResponse.json(
        { ok: false, error: 'account_not_found', detail: `Conta Meta "${account}" não encontrada neste tenant.`, total: 0, sent: 0, failed: 0 },
        { status: 409 },
      );
    }
    const status = resolved.reason === 'not_connected' ? 409 : 503;
    return NextResponse.json({ error: resolved.reason, total: 0, sent: 0, failed: 0 }, { status });
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
      title: 'Disparo em massa WhatsApp',
      steps: stepNames,
      input: { count: recipients.length, hasTemplate: Boolean(opts.template) },
    });
    taskId = created.taskId;
    await startTask(prisma, scope, taskId);
    tracked = true;
    await markStep(prisma, scope, taskId, 0, 'done').catch(() => {});
  } catch (e) {
    if (e instanceof TaskQueueUnavailableError) tracked = false;
    else throw e;
  }

  // TRABALHO REAL.
  const result = await runMassSend(resolved.access, recipients, opts);

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
    { ok: true, total: result.total, sent: result.sent, failed: result.failed, tracked, taskId, results: result.results },
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
