// Webhook OpenBSP — verificação oficial + assinatura HMAC-SHA256 (T40)
//
// Contratos (docs/RX_OPENBSP_CONTRACT_SUMMARY.md):
//  * GET  /api/webhooks/openbsp?hub.verify_token=...&hub.challenge=... — valida token, devolve challenge
//  * POST /api/webhooks/openbsp
//    - Header `X-Openbsp-Signature-256: sha256=<hex>` sobre o RAW body (NÃO parsear antes)
//    - Idempotência por `event_id` (unique index em webhook_events.openbsp_event_id)
//    - Responde 200 rápido; processamento assíncrono com retry/backoff + DLQ
//    - Payload desconhecido: loga e ignora (nunca 500)

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceRoleClient } from '@/lib/supabase/server';

const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024; // 10 MB
const OPENBSP_WEBHOOK_SECRET = process.env.OPENBSP_WEBHOOK_SECRET;
const OPENBSP_WEBHOOK_VERIFY_TOKEN = process.env.OPENBSP_WEBHOOK_VERIFY_TOKEN;

function timingSafeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function verifySignature(rawBody: string, signature: string): boolean {
  if (!OPENBSP_WEBHOOK_SECRET) return false;
  const expected = crypto
    .createHmac('sha256', OPENBSP_WEBHOOK_SECRET)
    .update(rawBody, 'utf8')
    .digest('hex');
  const sig = signature.startsWith('sha256=') ? signature.slice(7) : signature;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'));
}

// GET: webhook verification (OpenBSP Console)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (token && challenge) {
    if (OPENBSP_WEBHOOK_VERIFY_TOKEN && token === OPENBSP_WEBHOOK_VERIFY_TOKEN) {
      return new NextResponse(challenge, { status: 200 });
    }
  }
  return NextResponse.json({ error: 'invalid_verification' }, { status: 400 });
}

// POST: receber eventos OpenBSP
export async function POST(req: NextRequest) {
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_SIZE) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
  }

  // Validar assinatura X-Openbsp-Signature-256 sobre RAW body
  const signature = req.headers.get('X-Openbsp-Signature-256');
  if (!signature || !OPENBSP_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'signature_missing' }, { status: 401 });
  }

  const rawBody = await req.text();
  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'signature_invalid' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  // Idempotência por openbsp_event_id
  const openbspEventId = extractEventId(payload);
  if (openbspEventId) {
    const svc = createServiceRoleClient();
    try {
      const { data: existing } = await svc
        .from('webhook_events')
        .select('event_id')
        .eq('openbsp_event_id', openbspEventId)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ status: 'already_processed' }, { status: 200 });
      }
    } catch (err) {
      console.warn('[openbsp-webhook] idempotency check failed:', (err as Error).message);
    }
  }

  // Resolver tenant via phone_number_id no payload
  const phoneNumberId = (payload as { entry?: Array<{ changes?: Array<{ value?: { metadata?: { phone_number_id?: string } } }> }> })
    ?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

  if (!phoneNumberId) {
    console.warn('[openbsp-webhook] phone_number_id missing from payload');
    return NextResponse.json({ status: 'accepted' }, { status: 200 });
  }

  let organizationId: string | null = null;
  try {
    const svc = createServiceRoleClient();
    const { data: integration } = await svc
      .from('integrations')
      .select('user_id')
      .eq('external_account_label', phoneNumberId)
      .eq('connection_mode', 'official')
      .maybeSingle();
    organizationId = (integration as { user_id?: string } | null)?.user_id ?? null;
  } catch (err) {
    console.error('[openbsp-webhook] integration lookup failed:', (err as Error).message);
  }

  if (!organizationId) {
    console.warn('[openbsp-webhook] tenant nao identificado — phone_number_id:', phoneNumberId);
    return NextResponse.json({ status: 'accepted' }, { status: 200 });
  }

  // Claim atômico de idempotência (unique index openbsp_event_id)
  try {
    const outcome = await processWithRetry(organizationId, phoneNumberId, rawBody, payload, openbspEventId);
    if (outcome.kind === 'duplicate') {
      return NextResponse.json({ status: 'duplicate_skipped' }, { status: 200 });
    }
    return NextResponse.json({ status: 'accepted' }, { status: 200 });
  } catch (err) {
    console.error('[openbsp-webhook] processor error:', (err as Error).message);
    // Meta/OpenBSP espera 200 rápido; falhas internas são logadas, não retornam erro
    return NextResponse.json({ status: 'accepted' }, { status: 200 });
  }
}

async function processWithRetry(
  organizationId: string,
  phoneNumberId: string,
  rawBody: string,
  payload: unknown,
  openbspEventId: string | null,
): Promise<{ kind: 'processed' | 'duplicate' | 'dlq' }> {
  const svc = createServiceRoleClient();
  const maxAttempts = 5;
  const baseDelayMs = 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // claim único
      if (openbspEventId) {
        const claimed = await svc.$queryRaw`
          INSERT INTO webhook_events (event_id, openbsp_event_id, event_type, payload_hash, processed_at)
          VALUES (gen_random_uuid(), ${openbspEventId}, 'openbsp_webhook', sha256(${rawBody}::text), NOW())
          ON CONFLICT (openbsp_event_id) DO NOTHING
          RETURNING event_id
        ` as Array<{ event_id: string }>;
        if (claimed.length === 0) {
          return { kind: 'duplicate' };
        }
      }

      await processOpenBspPayload(payload, organizationId, phoneNumberId, svc);
      return { kind: 'processed' };
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));

      if (attempt < maxAttempts) {
        const delay = baseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 500);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      // DLQ — última tentativa falhou
      await logToDeadLetter(svc, {
        organization_id: organizationId,
        phone_number_id: phoneNumberId,
        raw_body: rawBody.slice(0, 5000),
        event_type: 'openbsp_webhook',
        error: err.message,
        attempt,
      });
      return { kind: 'dlq' };
    }
  }

  return { kind: 'dlq' };
}

async function processOpenBspPayload(
  payload: unknown,
  organizationId: string,
  phoneNumberId: string,
  client: ReturnType<typeof createServiceRoleClient>,
) {
  const eventType = extractEventType(payload);
  console.log('[openbsp-webhook] processing', { eventType, organizationId, phoneNumberId });

  switch (eventType) {
    case 'messages':
    case 'message':
      await handleIncomingMessage(payload, organizationId, phoneNumberId, client);
      break;
    case 'statuses':
    case 'message_status':
      await handleStatusUpdate(payload, organizationId, phoneNumberId, client);
      break;
    case 'template_status':
    case 'template_status_update':
      await handleTemplateStatus(payload, organizationId, client);
      break;
    default:
      // T40.5 — payload desconhecido: loga e ignora sem 500
      console.warn('[openbsp-webhook] unknown event type ignored:', eventType);
  }
}

async function handleIncomingMessage(
  payload: unknown,
  organizationId: string,
  phoneNumberId: string,
  client: ReturnType<typeof createServiceRoleClient>,
) {
  const messages = (payload as { entry?: Array<{ changes?: Array<{ value?: { messages?: unknown[] } }> }> })
    ?.entry?.[0]?.changes?.[0]?.value?.messages;

  if (!Array.isArray(messages) || messages.length === 0) return;

  for (const msg of messages) {
    const m = msg as Record<string, unknown>;
    const from = (m.from as string) ?? '';
    const type = (m.type as string) ?? 'unknown';
    const id = (m.id as string) ?? '';

    await client.from('inbound_messages').insert({
      organization_id: organizationId,
      phone_number_id: phoneNumberId,
      message_id: id,
      from_number: from,
      type,
      payload: m,
      received_at: new Date().toISOString(),
    });

    // Auto-reply via chatbot (reuso do módulo existente)
    try {
      const { maybeAutoReply } = await import('@/integrations/meta/chatbotAutoReply');
      const { prisma } = await import('@/lib/prisma');
      const auto = await maybeAutoReply(
        organizationId,
        from,
        type === 'text' ? (m.text as { body?: string } | undefined)?.body ?? '' : '',
        { firstContact: true },
        { client: prisma },
      );
      if (auto.replied) {
        console.log('[openbsp-webhook] chatbot replied to', from);
      }
    } catch (e) {
      console.warn('[openbsp-webhook] chatbot auto-reply failed:', (e as Error).message);
    }
  }
}

async function handleStatusUpdate(
  payload: unknown,
  organizationId: string,
  phoneNumberId: string,
  client: ReturnType<typeof createServiceRoleClient>,
) {
  const statuses = (payload as { entry?: Array<{ changes?: Array<{ value?: { statuses?: unknown[] } }> }> })
    ?.entry?.[0]?.changes?.[0]?.value?.statuses;

  if (!Array.isArray(statuses)) return;

  for (const st of statuses) {
    const s = st as Record<string, unknown>;
    await client.from('message_status').insert({
      organization_id: organizationId,
      phone_number_id: phoneNumberId,
      message_id: (s.id as string) ?? '',
      status: (s.status as string) ?? 'unknown',
      timestamp: s.timestamp ? new Date(parseInt(s.timestamp as string) * 1000).toISOString() : new Date().toISOString(),
      error_code: (s.errors as Array<{ code: string }> | undefined)?.[0]?.code ?? null,
      payload: s,
    });
  }
}

async function handleTemplateStatus(
  payload: unknown,
  organizationId: string,
  client: ReturnType<typeof createServiceRoleClient>,
) {
  const template = (payload as { entry?: Array<{ changes?: Array<{ value?: { template_status?: unknown } }> }> })
    ?.entry?.[0]?.changes?.[0]?.value?.template_status;

  if (!template) return;

  const t = template as Record<string, unknown>;
  await client.from('template_status').insert({
    organization_id: organizationId,
    template_name: (t.name as string) ?? '',
    language: (t.language as string) ?? '',
    status: (t.status as string) ?? 'unknown',
    category: (t.category as string) ?? null,
    rejection_reason: (t.rejection_reason as string) ?? null,
    received_at: new Date().toISOString(),
    payload: t,
  });
}

function extractEventId(payload: unknown): string | null {
  const p = payload as Record<string, unknown>;
  if (typeof p.entry === 'object' && Array.isArray(p.entry) && p.entry.length > 0) {
    const entry = p.entry[0] as Record<string, unknown>;
    if (Array.isArray(entry.changes) && entry.changes.length > 0) {
      const change = entry.changes[0] as Record<string, unknown>;
      const value = change?.value as Record<string, unknown> | undefined;
      if (Array.isArray(value?.messages) && value.messages.length > 0) {
        const msg = value.messages[0] as Record<string, unknown>;
        if (typeof msg.id === 'string' && msg.id) return msg.id;
      }
      if (Array.isArray(value?.statuses) && value.statuses.length > 0) {
        const st = value.statuses[0] as Record<string, unknown>;
        if (typeof st.id === 'string' && st.id) return st.id;
      }
    }
    if (typeof entry.id === 'string') return entry.id;
  }
  return null;
}

function extractEventType(payload: unknown): string {
  const p = payload as Record<string, unknown>;
  if (typeof p.entry === 'object' && Array.isArray(p.entry) && p.entry.length > 0) {
    const entry = p.entry[0] as Record<string, unknown>;
    if (Array.isArray(entry.changes)) {
      const change = entry.changes[0] as Record<string, unknown>;
      const field = change.field as string | undefined;
      if (field) return field;
      const value = change?.value as Record<string, unknown> | undefined;
      if (value?.messages) return 'messages';
      if (value?.statuses) return 'statuses';
      if (value?.template_status) return 'template_status';
    }
    if (Array.isArray(entry.messaging)) return 'messaging';
    if (Array.isArray(entry.statuses)) return 'status';
  }
  return 'unknown';
}

async function logToDeadLetter(
  client: ReturnType<typeof createServiceRoleClient>,
  data: {
    organization_id: string;
    phone_number_id: string;
    raw_body: string;
    event_type: string;
    error: string;
    attempt: number;
  },
) {
  try {
    await client.from('webhook_dead_letter').insert({
      organization_id: data.organization_id,
      phone_number_id: data.phone_number_id,
      event_type: data.event_type,
      raw_body: data.raw_body,
      error: data.error,
      attempt: data.attempt,
      created_at: new Date().toISOString(),
    });
    console.error('[openbsp-webhook] DLQ:', { org: data.organization_id, phone: data.phone_number_id, attempt: data.attempt, error: data.error });
  } catch (e) {
    console.error('[openbsp-webhook] DLQ insert failed:', (e as Error).message);
  }
}