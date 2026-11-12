// Webhook do WhatsApp OFICIAL — é a META que chama este endpoint
// (callback_url gravado no onboarding token; OpenBSP não armazena mensagens).
//
// GET  → verificação padrão Cloud API: hub.mode=subscribe + hub.challenge.
//        Ecoamos o challenge SOMENTE se hub.verify_token bater (tempo
//        constante) com o verify_token do tenant (?org=). Senão 403
//        silencioso — sem existir/não-existir de org.
// POST → payload Cloud API normal (`entry[].changes[].value`), roteado por
//        phone_number_id → whatsapp_channels → tenant. Idempotência por wamid
//        + hash SHA-256 em webhook_events (015). Ack 200 sempre após validar
//        (Meta reenvia em erro; processamento duplicado é o pior cenário).

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma, withTenantContext } from '../../../../../src/lib/prisma';
import { getChannelByPhoneNumberId } from '../../../../../src/integrations/whatsapp';
import { processWhatsAppPayload } from '../../../../../src/integrations/meta/whatsappProcessor';
import { createServiceRoleClient } from '../../../../../src/lib/supabase/server';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function constantTimeEq(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mode = sp.get('hub.mode') ?? '';
  const token = sp.get('hub.verify_token') ?? '';
  const challenge = sp.get('hub.challenge') ?? '';
  const org = sp.get('org') ?? '';
  if (mode !== 'subscribe' || !UUID_RE.test(org) || !token || !challenge) {
    return new NextResponse(null, { status: 403 });
  }
  let verifyToken: string | null = null;
  try {
    const ch = await prisma.whatsappChannel.findUnique({ where: { organizationId: org }, select: { verifyToken: true } });
    verifyToken = ch?.verifyToken ?? null;
  } catch {
    return new NextResponse(null, { status: 403 });
  }
  if (!verifyToken || !constantTimeEq(verifyToken, token)) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
}

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  const sig = signature.startsWith('sha256=') ? signature.slice(7) : signature;
  return timingSafeEq(expected, sig);
}

function timingSafeEq(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

export async function POST(req: NextRequest) {
  let raw = '';
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ ok: true }); // ack: corpo ilegível não é reenviável
  }

  // Assinatura HMAC-SHA256 (X-Hub-Signature-256) — fail-closed, mesmo padrão do webhook Meta.
  // META_APP_SECRET lido por requisição: não fixa o valor em tempo de módulo, e o
  // segredo não é exposto em log. Payload sem assinatura válida é rejeitado com 401.
  const signature = req.headers.get('X-Hub-Signature-256');
  const secret = process.env.META_APP_SECRET;
  if (!signature || !secret) {
    return NextResponse.json({ error: 'signature_missing' }, { status: 401 });
  }
  if (!verifySignature(raw, signature, secret)) {
    return NextResponse.json({ error: 'signature_invalid' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ ok: true });
  }

  // phone_number_id → tenant (defesa: ignora silenciosamente números alheios).
  let phoneNumberId = '';
  try {
    const entry = (body as { entry?: Array<{ changes?: Array<{ value?: { metadata?: { phone_number_id?: string } } }> }> }).entry;
    phoneNumberId = entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id ?? '';
  } catch {
    phoneNumberId = '';
  }
  if (!phoneNumberId) return NextResponse.json({ ok: true });

  let channel: Awaited<ReturnType<typeof getChannelByPhoneNumberId>> = null;
  try {
    channel = await getChannelByPhoneNumberId(createServiceRoleClient(), phoneNumberId);
  } catch {
    return NextResponse.json({ error: 'db_error' }, { status: 500 }); // retry Meta
  }
  if (!channel || channel.status !== 'CONNECTED') return NextResponse.json({ ok: true });
  const org = channel.organizationId;

  // Idempotência (gate 4): hash do payload + wamid em webhook_events (015).
  const payloadHash = crypto.createHash('sha256').update(raw).digest('hex');
  let wamid = '';
  try {
    wamid =
      (
        body as { entry?: Array<{ changes?: Array<{ value?: { messages?: Array<{ id?: string }> } }> }> }
      ).entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id ?? '';
  } catch {
    wamid = '';
  }
  try {
    const dup = await prisma.webhookEvent.findFirst({
      where: { openbspEventId: wamid || null },
      select: { eventId: true },
    });
    if (dup) return NextResponse.json({ ok: true, duplicated: true });
  } catch {
    /* melhor esforço: segue, o processor é idempotente por wamid (externalId) */
  }

  // CORREÇÃO: Toda a operação dentro de withTenantContext usa tx transacional
  // para preservar isolamento de tenant (RLS context)
  try {
    await withTenantContext(org, async (tx) => {
      await processWhatsAppPayload(body, org, tx);

      // Idempotência: registrar evento dentro da transação para preservar isolamento de tenant
      // (corrigido: anteriormente usava prisma global, quebrando o contexto tx)
      await tx.webhookEvent.create({
        data: {
          metaEventId: wamid || payloadHash,
          openbspEventId: wamid || null,
          eventType: 'whatsapp_api_inbound',
          payloadHash,
          processedAt: new Date(),
        },
      });
    });
  } catch (e) {
    console.error('[openbsp] process falhou', { org, err: String((e as Error)?.message ?? e) });
    return NextResponse.json({ error: 'process_failed' }, { status: 500 }); // retry Meta
  }
  return NextResponse.json({ ok: true });
}