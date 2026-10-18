import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { withTenantContext } from '@/lib/prisma';
import { prisma } from '@/lib/prisma';
import { sanitizeWebhookPayload, processWhatsAppPayload } from '@/integrations/meta';
import { maybeAutoReply } from '@/integrations/meta/chatbotAutoReply';
import { createServiceRoleClient } from '@/lib/supabase/server';

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

  // Idempotência: verificar se evento já foi processado (service_role para não depender de RLS)
  const metaEventId = extractEventId(payload);
  if (metaEventId) {
    try {
      const svc = createServiceRoleClient();
      const { data: existing } = await svc
        .from('webhook_events')
        .select('event_id')
        .eq('meta_event_id', metaEventId)
        .maybeSingle();

      if (existing) {
        // Evento duplicado — evitar reprocessamento
        return NextResponse.json({ status: 'already_processed' }, { status: 200 });
      }
    } catch (err) {
      // Idempotência falhou — processar mesmo assim (não bloquear o webhook)
      console.warn('[meta-webhook] idempotency check failed:', (err as Error).message);
    }
  }

  // Processar evento
  const eventType = extractEventType(payload);

  // Resolver tenant via meta_integrations (service_role — tabela sensível com tokens criptografados)
  const phoneNumberId = (payload as { entry?: Array<{ changes?: Array<{ value?: { metadata?: { phone_number_id?: string } } }> }> })
    ?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

  if (!phoneNumberId) {
    console.warn('[meta-webhook] phone_number_id missing from payload');
    return NextResponse.json({ status: 'accepted' }, { status: 200 });
  }

  let organizationId: string | null = null;
  try {
    const svc = createServiceRoleClient();
    const { data: integration } = await svc
      .from('meta_integrations')
      .select('organization_id')
      .eq('phone_number_id', phoneNumberId)
      .maybeSingle();
    organizationId = (integration as { organization_id?: string } | null)?.organization_id ?? null;
  } catch (err) {
    console.error('[meta-webhook] integration lookup failed:', (err as Error).message);
  }

  if (!organizationId) {
    console.warn('[meta-webhook] tenant não identificado — phone_number_id:', phoneNumberId);
    return NextResponse.json({ status: 'accepted' }, { status: 200 });
  }

  // Claim atômico de idempotência: INSERT ... ON CONFLICT (meta_event_id)
  // DO NOTHING RETURNING — exige índice único simples em meta_event_id
  // (migration 015). Se a fila ainda está em 015-absente, o claim lança
  // erro e a entrega segue (degradação honesta, nunca perda de evento).
  // Se o claim retorna vazio → evento já registrado por outra entrega →
  // duplicado, não reprocessamos. O fast-path acima (service_role) é
  // otimização; o claim é a garantia.
  try {
    const outcome = await withTenantContext(organizationId, async (tx) => {
      if (metaEventId) {
        try {
          const claimed = await tx.$queryRaw`
            INSERT INTO webhook_events (event_id, meta_event_id, event_type, payload_hash, processed_at)
            VALUES (gen_random_uuid(), ${metaEventId}, ${eventType}, sha256(${payloadText}::text), NOW())
            ON CONFLICT (meta_event_id) DO NOTHING
            RETURNING event_id
          ` as Array<{ event_id: string }>;
          if (claimed.length === 0) {
            return { kind: 'duplicate' as const };
          }
        } catch (claimErr) {
          // 015 ainda não aplicada / índice ausente → não bloquear entrega
          console.warn('[meta-webhook] claim de idempotência falhou, processando mesmo assim:', (claimErr as Error).message);
        }
      }

      const results = await processWhatsAppPayload(safe, organizationId, tx);
      return { kind: 'processed' as const, results };
    });

    if (outcome.kind === 'duplicate') {
      return NextResponse.json({ status: 'duplicate_skipped' }, { status: 200 });
    }

    const hasErrors = outcome.results.some((r) => !r.success);
    if (hasErrors) {
      const errors = outcome.results.filter((r) => r.error).map((r) => r.error);
      console.warn('[meta-webhook] partial processing errors:', errors);
    }

    // FASE 3 · slice 2 — Chatbot visual: resposta automática.
    // Lê a config do tenant (AgentMemory) e envia pela Cloud API oficial.
    // Nunca quebra o webhook: bot desligado, Meta não conectada ou falha
    // de envio → loga e segue devolvendo 200.
    for (const r of outcome.results) {
      if (!r.success || !r.waId) continue;
      try {
        const auto = await maybeAutoReply(
          organizationId,
          r.waId,
          r.text ?? '',
          { firstContact: r.firstContact === true },
          { client: prisma },
        );
        if (auto.replied) {
          console.log(`[meta-webhook] chatbot replied (source=${auto.source}) to ${r.waId}`);
        } else if (auto.skipReason === 'send_failed') {
          console.warn(
            '[meta-webhook] chatbot send failed:',
            auto.send?.error,
            auto.send?.errorDetail,
          );
        }
      } catch (e) {
        console.warn('[meta-webhook] chatbot auto-reply error:', (e as Error).message);
      }
    }

    return NextResponse.json({ status: 'accepted' }, { status: 200 });
  } catch (err) {
    // Falha no processor — logging sem expor dados sensíveis
    console.error('[meta-webhook] processor error:', (err as Error).message);
    // Meta espera 200 rápido; falhas internas são logadas, não retornam erro
    return NextResponse.json({ status: 'accepted' }, { status: 200 });
  }
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
