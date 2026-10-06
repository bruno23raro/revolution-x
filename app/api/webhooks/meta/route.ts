import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { sanitizeWebhookPayload, processWhatsAppPayload } from '@/integrations/meta';
import { prisma } from '@/lib/prisma';

// Webhook Meta — verificação oficial + assinatura HMAC-SHA256
// META_APP_SECRET: NUNCA exposto no código/log
// META_WEBHOOK_VERIFY_TOKEN: usado exclusivamente para GET hub.verify_token

const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024; // 10 MB
const META_APP_SECRET = process.env.META_APP_SECRET;
const META_WEBHOOK_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN;

function timingSafeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function verifySignature(payload: string, signature: string): boolean {
  if (!META_APP_SECRET) return false;
  const expected = crypto
    .createHmac('sha256', META_APP_SECRET)
    .update(payload, 'utf8')
    .digest('hex');
  const sig = signature.startsWith('sha256=') ? signature.slice(7) : signature;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'));
}

function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// GET: webhook verification (Meta Developers Console)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token && challenge) {
    if (META_WEBHOOK_VERIFY_TOKEN && token === META_WEBHOOK_VERIFY_TOKEN) {
      return new NextResponse(challenge, { status: 200 });
    }
  }
  return NextResponse.json({ error: 'invalid_verification' }, { status: 400 });
}

// POST: receber eventos Meta
export async function POST(req: NextRequest) {
  // Limitar tamanho do body
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_SIZE) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
  }

  // Validar assinatura X-Hub-Signature-256
  const signature = req.headers.get('X-Hub-Signature-256');
  if (!signature || !META_APP_SECRET) {
    return NextResponse.json({ error: 'signature_missing' }, { status: 401 });
  }

  const payloadText = await req.text();
  if (!verifySignature(payloadText, signature)) {
    return NextResponse.json({ error: 'signature_invalid' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(payloadText);
  } catch {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  // Sanitizar antes de qualquer log/processamento
  const safe = sanitizeWebhookPayload(payload);

  // Idempotência: verificar se evento já foi processado
  const metaEventId = extractEventId(payload);
  if (metaEventId) {
    try {
      const supabase = getSupabase();
      const { data: existing } = await supabase
        .from('webhook_events')
        .select('event_id')
        .eq('meta_event_id', metaEventId)
        .maybeSingle();

      if (existing) {
        // Evento duplicado — evitar reprocessamento
        return NextResponse.json({ status: 'already_processed' }, { status: 200 });
      }
    } catch {
      // Idempotência falhou — processar mesmo assim
    }
  }

  // Processar evento
  const eventType = extractEventType(payload);

  // Persistir webhook_event (idempotência)
  try {
    if (metaEventId) {
      const supabase = getSupabase();
      await supabase.from('webhook_events').insert({
        meta_event_id: metaEventId,
        event_type: eventType,
        payload_hash: crypto.createHash('sha256').update(payloadText).digest('hex'),
        processed_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error('[meta-webhook] db insert error:', (err as Error).message);
  }

  // Processar mensagens WhatsApp → CRM
  try {
    const p = payload as { entry?: Array<{ changes?: Array<{ value?: { metadata?: { phone_number_id?: string } } }> }> };
    const phoneNumberId = p?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

    if (phoneNumberId) {
      // Resolver tenant via meta_integrations (Supabase — tabela não está no Prisma)
      let organizationId: string | null = null;
      try {
        const supabase = getSupabase();
        const { data: integration } = await supabase
          .from('meta_integrations')
          .select('organization_id')
          .eq('phone_number_id', phoneNumberId)
          .maybeSingle();
        organizationId = (integration as { organization_id?: string } | null)?.organization_id ?? null;
      } catch {
        // Lookup falhou — não persistir mensagens sem tenant
        organizationId = null;
      }

      if (organizationId) {
        await processWhatsAppPayload(payload, organizationId, prisma);
      } else {
        console.warn('[meta-webhook] tenant não identificado — phone_number_id:', phoneNumberId);
      }
    }
  } catch (err) {
    // Falha no processor não impede 200 (Meta re-tenta se não receber 200 rápido)
    console.error('[meta-webhook] processor error:', (err as Error).message);
  }

  return NextResponse.json({ status: 'accepted' }, { status: 200 });
}

function extractEventId(payload: unknown): string {
  const p = payload as Record<string, unknown>;
  if (typeof p.entry === 'object' && Array.isArray(p.entry) && p.entry.length > 0) {
    const entry = p.entry[0] as Record<string, unknown>;

    // WhatsApp Cloud API: priorizar ID da mensagem específica
    if (Array.isArray(entry.changes) && entry.changes.length > 0) {
      const change = entry.changes[0] as Record<string, unknown>;
      const value = change?.value as Record<string, unknown> | undefined;
      if (Array.isArray(value?.messages) && value.messages.length > 0) {
        const msg = value.messages[0] as Record<string, unknown>;
        if (typeof msg.id === 'string' && msg.id) return msg.id;
      }
    }

    // Instagram / Messenger messaging
    if (Array.isArray(entry.messaging) && entry.messaging.length > 0) {
      const msgs = entry.messaging as Array<Record<string, unknown>>;
      if (msgs[0] && typeof (msgs[0] as Record<string, unknown>).message === 'object') {
        const msgObj = (msgs[0] as Record<string, unknown>).message as Record<string, unknown>;
        if (msgObj.mid) return String(msgObj.mid);
      }
    }

    // Fallback: ID do evento ou da página (usar com cuidado)
    if (typeof entry.id === 'string') return entry.id;
  }
  return '';
}

function extractEventType(payload: unknown): string {
  const p = payload as Record<string, unknown>;
  if (typeof p.entry === 'object' && Array.isArray(p.entry) && p.entry.length > 0) {
    const entry = p.entry[0] as Record<string, unknown>;
    if (Array.isArray(entry.changes)) return 'feed_change';
    if (Array.isArray(entry.messaging)) return 'messaging';
    if (Array.isArray(entry.statuses)) return 'status';
  }
  return 'unknown';
}