// FASE 5.2 — Inbox WhatsApp em tempo real (SSE + fallback polling)
//
// GET /api/whatsapp/conversas?org=<orgId>&sse=1
//   Retorna conversas agrupadas + mensagens + SSE stream de novas mensagens
//   Query params:
//     - org: organizationId (obrigatório, valida contra session do usuário)
//     - sse: '1' para habilitar Server-Sent Events (stream)
//     - since: timestamp ISO para buscar mensagens mais recentes (polling)
//     - limit: max mensagens por conversa (default 50)

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/middleware/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limiting - 60 req/min por usuário
  const rateResult = await rateLimit(req, 'api', { windowMs: 60000, max: 60 });
  if (rateResult.limited) {
    const response = NextResponse.json(
      { ok: false, error: 'Rate limit excedido', rateLimit: { remaining: 0, resetIn: rateResult.resetIn } },
      { status: 429 }
    );
    response.headers.set('X-RateLimit-Remaining', '0');
    if (rateResult.resetIn > 0) response.headers.set('X-RateLimit-Reset', String(rateResult.resetIn));
    return response;
  }

  const searchParams = req.nextUrl.searchParams;
  const orgParam = searchParams.get('org');
  const sse = searchParams.get('sse') === '1';
  const since = searchParams.get('since');
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  // Validação de org — IDOR protection
  if (!orgParam) {
    const response = NextResponse.json({ ok: false, error: 'org query param obrigatório' }, { status: 400 });
    response.headers.set('X-RateLimit-Remaining', String(rateResult.remaining));
    return response;
  }

  if (orgParam !== user.organizationId) {
    const response = NextResponse.json({ ok: false, error: 'Acesso negado' }, { status: 403 });
    response.headers.set('X-RateLimit-Remaining', String(rateResult.remaining));
    return response;
  }

  const organizationId = orgParam;

  // Helper para buscar conversas e mensagens via raw query (tabela inbound_messages criada via migration 031)
  async function fetchConversations(sinceDate?: Date) {
    const sinceClause = sinceDate
      ? `AND im."received_at" > $2`
      : '';

    const query = `
      SELECT
        im.id,
        im.message_id,
        im.from_number,
        im.to_number,
        im.type,
        im.payload,
        im.received_at,
        im.organization_id
      FROM inbound_messages im
      WHERE im.organization_id = $1 ${sinceClause}
      ORDER BY im.received_at DESC
      LIMIT $${sinceDate ? 3 : 2}
    `;

    const params: any[] = [organizationId];
    if (sinceDate) params.push(sinceDate);
    params.push(limit * 20); // buffer para agrupar

    const messages = await prisma.$queryRawUnsafe(query, ...params) as Array<{
      id: string;
      message_id: string;
      from_number: string;
      to_number: string | null;
      type: string;
      payload: any;
      received_at: Date;
      organization_id: string;
    }>;

    // Agrupar por conversa (from_number + to_number + organizationId)
    const conversationsMap = new Map<
      string,
      {
        organizationId: string;
        fromNumber: string;
        toNumber: string;
        messages: Array<{
          id: string;
          body: string;
          direction: string;
          status: string;
          receivedAt: string;
        }>;
        firstReceived: string;
        lastReceived: string;
        total: number;
      }
    >();

    for (const msg of messages) {
      const from = msg.from_number;
      const to = msg.to_number || '';
      const key = `${organizationId}-${from}-${to}`;

      if (!conversationsMap.has(key)) {
        conversationsMap.set(key, {
          organizationId,
          fromNumber: from,
          toNumber: to,
          messages: [],
          firstReceived: msg.received_at.toISOString(),
          lastReceived: msg.received_at.toISOString(),
          total: 0,
        });
      }

      const conv = conversationsMap.get(key)!;
      conv.messages.push({
        id: msg.id,
        body: typeof msg.payload === 'object' && msg.payload !== null && 'text' in msg.payload
          ? String((msg.payload as Record<string, unknown>).text)
          : JSON.stringify(msg.payload),
        direction: 'inbound',
        status: 'received',
        receivedAt: msg.received_at.toISOString(),
      });

      if (msg.received_at < new Date(conv.firstReceived)) {
        conv.firstReceived = msg.received_at.toISOString();
      }
      if (msg.received_at > new Date(conv.lastReceived)) {
        conv.lastReceived = msg.received_at.toISOString();
      }
      conv.total += 1;
    }

    // Limitar mensagens por conversa
    for (const conv of conversationsMap.values()) {
      conv.messages = conv.messages.slice(0, limit);
    }

    return {
      conversations: Object.fromEntries(conversationsMap),
      messages: messages.slice(0, limit * 5).map(m => ({
        id: m.id,
        body: typeof m.payload === 'object' && m.payload !== null && 'text' in m.payload
          ? String((m.payload as Record<string, unknown>).text)
          : JSON.stringify(m.payload),
        direction: 'inbound',
        status: 'received',
        receivedAt: m.received_at.toISOString(),
      })),
    };
  }

  // SSE Response
  if (sse) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let isClosed = false;

        // Send initial data
        const initial = await fetchConversations();
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'initial', ...initial })}\n\n`));

        // Keep-alive interval
        const keepAlive = setInterval(() => {
          if (isClosed) return;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'keep-alive' })}\n\n`));
        }, 15000);

        // Poll for new messages every 3 seconds
        const pollInterval = setInterval(async () => {
          if (isClosed) return;
          try {
            const sinceDate = new Date(Date.now() - 5000); // last 5 seconds
            const update = await fetchConversations(sinceDate);
            if (Object.keys(update.conversations).length > 0 || update.messages.length > 0) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'new', ...update })}\n\n`));
            }
          } catch (e) {
            console.error('[conversas SSE] poll error:', e);
          }
        }, 3000);

        // Cleanup on close
        req.signal.addEventListener('abort', () => {
          isClosed = true;
          clearInterval(keepAlive);
          clearInterval(pollInterval);
          controller.close();
        });
      },
    });

    const response = new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'X-RateLimit-Remaining': String(rateResult.remaining),
      },
    });

    if (rateResult.resetIn > 0) response.headers.set('X-RateLimit-Reset', String(rateResult.resetIn));
    return response;
  }

  // JSON Response (fallback polling)
  const data = await fetchConversations(since ? new Date(since) : undefined);

  const response = NextResponse.json(
    { ok: true, ...data },
    { status: 200 }
  );
  response.headers.set('X-RateLimit-Remaining', String(rateResult.remaining));
  if (rateResult.resetIn > 0) response.headers.set('X-RateLimit-Reset', String(rateResult.resetIn));
  return response;
}