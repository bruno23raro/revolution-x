// DISPARO em massa via Cloud API da Meta OU OpenBSP
//
// POST /api/whatsapp/send
//   { recipients?: [{to, text?}], to?: string[], text?, template?: {name, variables, language}, delayMs?, account? }
// → { ok, total, sent, failed, tracked, taskId?, results }
//
// O trabalho REAL (enviar) não depende da tabela de fila: se a fila estiver
// indisponível, o envio acontece e só o tracking é degradado (`tracked:false`),
// nunca o inverso.
//
// PROVIDER-AGNOSTIC: Resolve contas tanto de meta_integrations (provider='whatsapp'|'facebook')
// quanto de whatsapp_channels (provider='openbsp'). O parâmetro `account` é o row id da conta.
//

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
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendViaOpenBSP, sendTemplateViaOpenBSP } from '@/integrations/openbsp/send';
import { decryptToken } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

const MAX_RECIPIENTS = 500;

// Tipos para resolution de conta provider-agnostic
type Provider = 'whatsapp' | 'facebook' | 'openbsp';

interface ResolvedAccount {
  ok: true;
  provider: Provider;
  accessToken: string;      // Para Meta (decrypt) ou OpenBSP (plaintext decodificado)
  phoneNumberId: string;    // Para OpenBSP: phoneNumberId da whatsapp_channels
  row: Record<string, unknown>;
}

interface ResolveFailure {
  ok: false;
  reason: 'not_connected' | 'no_token' | 'decrypt_failed' | 'account_not_found';
}

/**
 * Resolve a conta do tenant de forma provider-agnostic.
 * Pesquisa primero meta_integrations (provider: whatsapp/facebook), depois whatsapp_channels (provider: openbsp).
 * `accountId` é o row id da conta (da tabela correspondente).
 */
async function resolveTenantWhatsAppAccess(
  organizationId: string,
  accountId?: string,
): Promise<ResolvedAccount | ResolveFailure> {
  const service = createServiceRoleClient();

  // PASSO 1: Tentar resolver como conta Meta (meta_integrations)
  // provider IN ('whatsapp', 'facebook')
  let q = service
    .from('meta_integrations')
    .select('id, provider, phone_number_id, whatsapp_business_account_id, meta_app_id, encrypted_access_token, token_expires_at, status')
    .eq('organization_id', organizationId)
    .in('provider', ['whatsapp', 'facebook'])
    .neq('status', 'DISCONNECTED')
    .order('connected_at', { ascending: false });

  if (accountId) q = q.eq('id', accountId);
  const { data: metaData, error: metaError } = await q.limit(1).maybeSingle();

  if (metaError && metaError.code !== 'PGRST116') { // Não é "not found", é erro real
    return { ok: false, reason: 'no_token' };
  }

  if (metaData && !metaError) {
    const row = metaData as Record<string, unknown>;
    const encryptedToken = row.encrypted_access_token as string | null;
    if (!encryptedToken) return { ok: false, reason: 'no_token' };

    try {
      const accessToken = await decryptToken(encryptedToken);
      return {
        ok: true,
        provider: row.provider as 'whatsapp' | 'facebook',
        accessToken,
        phoneNumberId: row.phone_number_id as string || '',
        row,
      };
    } catch {
      return { ok: false, reason: 'decrypt_failed' };
    }
  }

  // PASSO 2: Tentar resolver como Canal OpenBSP (whatsapp_channels)
  // provider = 'openbsp'
  // NOTA: PostgREST (Supabase REST API) retorna colunas em snake_case
  q = service
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

  // Para OpenBSP, o accessToken já está no formato que podemos usar diretamente
  // (o token não é cifrado como Meta — é o access_token do OpenBSP)
  const accessToken = channel.accessTokenEnc as string || '';

  return {
    ok: true,
    provider: 'openbsp',
    accessToken: accessToken, // OpenBSP usa o token diretamente nos headers
    phoneNumberId: channel.phoneNumberId as string || '',
    row: channel,
  };
}

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

  // MULTICONTAS — `account` (row id) ancora a conta específica
  const account = body.account ? String(body.account).trim() : undefined;

  // RESOLVER CONTA PROVIDER-AGNOSTIC
  const resolved = await resolveTenantWhatsAppAccess(user.organizationId, account);
  if (!resolved.ok) {
    const status = resolved.reason === 'not_connected' || resolved.reason === 'account_not_found' ? 409 : 503;
    const detail = resolved.reason === 'account_not_found' && account
      ? `Conta "${account}" não encontrada`
      : resolved.reason === 'no_token'
        ? 'Token não encontrado na conta'
        : resolved.reason === 'decrypt_failed'
          ? 'Falha ao descriptografar token'
          : 'Conta não conectada';
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
      title: 'Disparo em massa WhatsApp',
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

  // TRABALHO REAL - PROVIDER-AGNOSTIC
  let result: { total: number; sent: number; failed: number; results: unknown[] };

  if (resolved.provider === 'openbsp') {
    // ENVIAR VIA OPENBSP
    result = await sendMassViaOpenBSP(resolved, recipients, opts);
  } else {
    // ENVIAR VIA META (já existente - runMassSend)
    // Para Meta, precisamos do access no formato que runMassSend espera
    const metaAccess = {
      accessToken: resolved.accessToken,
      phoneNumberId: resolved.phoneNumberId as string,
      wabaId: (resolved.row as Record<string, unknown>).whatsapp_business_account_id as string | undefined,
    };
    result = await runMassSend(metaAccess, recipients, opts);
  }

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

/**
 * Envia em massa via OpenBSP (POST direto na tabela messages via Supabase REST).
 */
async function sendMassViaOpenBSP(
  resolved: ResolvedAccount,
  recipients: Recipient[],
  opts: MassSendOptions,
): Promise<{ total: number; sent: number; failed: number; results: unknown[] }> {
  const results: unknown[] = [];
  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    try {
      let res;
      if (opts.template) {
        res = await sendTemplateViaOpenBSP(
          resolved.row as any,
          recipient.to,
          opts.template!.name,
          opts.template!.language || 'pt_BR',
          opts.template!.variables ?? [],
        );
      } else {
        res = await sendViaOpenBSP(resolved.row as any, recipient.to, recipient.text || '');
      }

      if (res.ok) {
        sent++;
        results.push({ to: recipient.to, ok: true, messageId: res.messageId });
      } else {
        failed++;
        results.push({ to: recipient.to, ok: false, error: res.error });
      }
    } catch (e) {
      failed++;
      results.push({ to: recipient.to, ok: false, error: e instanceof Error ? e.message : 'Erro desconhecido' });
    }

    // Aplicar delay entre mensagens se configurado
    const delayMs = opts.delayMs ?? 0;
    if (delayMs > 0 && recipients.indexOf(recipient) < recipients.length - 1) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  // Atualizar contador de janela 24h no canal (OpenBSP)
  if (resolved.provider === 'openbsp') {
    const channel = resolved.row as Record<string, unknown>;
    const currentSent = (channel.sentWindow24h as number) || 0;
    const tierLimit = (channel.tierLimitPer24h as number) || 250;

    if (currentSent + sent >= tierLimit) {
      // Marcar como limite atingido
      const service = createServiceRoleClient();
      await service
        .from('whatsapp_channels')
        .update({ lastError: `Limite de ${tierLimit} mensagens/24h atingido` })
        .eq('id', resolved.row.id);
    } else {
      const service = createServiceRoleClient();
      await service
        .from('whatsapp_channels')
        .update({ sentWindow24h: currentSent + sent, updatedAt: new Date().toISOString() })
        .eq('id', resolved.row.id);
    }
  }

  return { total: recipients.length, sent, failed, results };
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