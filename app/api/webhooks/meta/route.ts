import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { sanitizeWebhookPayload } from '@/integrations/meta/webhooks/handler';
import crypto2 from 'crypto';

// Webhook Meta — verificação oficial + assinatura HMAC-SHA256
// Nunca registrar access_token/app_secret/Authorization

const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024; // 10 MB
const META_WEBHOOK_SECRET = process.env.META_WEBHOOK_SECRET;

function timingSafeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = crypto2
    .createHmac('sha256', secret)
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
    if (META_WEBHOOK_SECRET && token === META_WEBHOOK_SECRET) {
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
  if (!signature || !META_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'signature_missing' }, { status: 401 });
  }

  const payloadText = await req.text();
  if (!verifySignature(payloadText, signature, META_WEBHOOK_SECRET)) {
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
        .select('id')
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

  // Processar evento (futuro: delegar para handler específico por tipo)
  const eventType = extractEventType(payload);
  try {
    if (metaEventId) {
      const supabase = getSupabase();
      await supabase.from('webhook_events').insert({
        meta_event_id: metaEventId,
        event_type: eventType,
        payload_hash: crypto2.createHash('sha256').update(payloadText).digest('hex'),
        processed_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error('[meta-webhook] db insert error:', err);
  }

  return NextResponse.json({ status: 'accepted' }, { status: 200 });
}

function extractEventId(payload: unknown): string {
  const p = payload as Record<string, unknown>;
  if (typeof p.entry === 'object' && Array.isArray(p.entry) && p.entry.length > 0) {
    const entry = p.entry[0] as Record<string, unknown>;
    if (typeof entry.id === 'string') return entry.id;
    if (typeof entry.messaging) {
      const msgs = entry.messaging as Array<Record<string, unknown>>;
      if (msgs[0] && typeof (msgs[0] as Record<string, unknown>).message === 'object') {
      const msgObj = (msgs[0] as Record<string, unknown>).message as Record<string, unknown>;
      if (msgObj.mid) return String(msgObj.mid);
    }
    }
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