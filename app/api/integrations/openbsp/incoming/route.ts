// Webhook do WhatsApp OFICIAL â€” Ã© a META que chama este endpoint
// (callback_url gravado no onboarding token; OpenBSP nÃ£o armazena mensagens).
//
// GET  â†’ verificaÃ§Ã£o padrÃ£o Cloud API: hub.mode=subscribe + hub.challenge.
//        Ecoamos o challenge SOMENTE se hub.verify_token bater (tempo
//        constante) com o verify_token do tenant (?org=). SenÃ£o 403
//        silencioso â€” sem existir/nÃ£o-existir de org.
// POST â†’ payload Cloud API normal (`entry[].changes[].value`), roteado por
//        phone_number_id â†’ whatsapp_channels â†’ tenant. IdempotÃªncia por wamid
//        + hash SHA-256 em webhook_events (015). Ack 200 sempre apÃ³s validar
//        (Meta reenvia em erro; processamento duplicado Ã© o pior cenÃ¡rio).

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

export async function POST(req: NextRequest) {
  let raw = '';
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ ok: true }); // ack: corpo ilegÃ­vel nÃ£o Ã© reenviÃ¡vel
  }
  let body: Record<string, unknown>;
  try {
    body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ ok: true });
  }

  // phone_number_id â†’ tenant (defesa: ignora silenciosamente nÃºmeros alheios).
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

  // IdempotÃªncia (gate 4): hash do payload + wamid em webhook_events (015).
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
      where: { organizationId: org, payloadHash },
      select: { id: true },
    });
    if (dup) return NextResponse.json({ ok: true, duplicated: true });
  } catch {
    /* melhor esforÃ§o: segue, o processor Ã© idempotente por wamid (externalId) */
  }

  try {
    await withTenantContext(org, (tx) => processWhatsAppPayload(body, org, tx));
  } catch (e) {
    console.error('[openbsp] process falhou', { org, err: String((e as Error)?.message ?? e) });
    return NextResponse.json({ error: 'process_failed' }, { status: 500 }); // retry Meta
  }

  try {
    await prisma.webhookEvent.create({
      data: { organizationId: org, metaEventId: wamid || null, eventType: 'whatsapp_api_inbound', payloadHash, processedAt: new Date() },
    });
  } catch {
    /* ack mesmo se o log de idempotÃªncia nÃ£o gravar */
  }
  return NextResponse.json({ ok: true });
}
