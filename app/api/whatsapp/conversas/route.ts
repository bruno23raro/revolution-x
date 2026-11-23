// Inbox WhatsApp em tempo real — fonte: provedor OpenBSP (conversations + messages)
//
// GET /api/whatsapp/conversas?org=<appOrgId>&sse=1
//   - Queries no provedor com OPENBSP_ORG_ID + channel.phoneNumberId
//   - ?org= so conferência (divergente → 403); ausente → usa sessão
//   - Sem canal / phoneNumberId → 409

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { rateLimit } from '@/middleware/rate-limit';
import { getChannelDecrypted } from '@/integrations/whatsapp/channelRepo';
import {
  openbspConfig,
  listProviderConversations,
  listProviderMessages,
  type OpenbspMessageRow,
  type OpenbspConversationRow,
} from '@/integrations/whatsapp/openbsp/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ORG_BSP = () => String(process.env.OPENBSP_ORG_ID ?? '').trim();

function messageBody(content: Record<string, unknown> | null | undefined): string {
  if (!content || typeof content !== 'object') return '';
  if (typeof content.text === 'string') return content.text;
  const data = content.data;
  if (data && typeof data === 'object' && 'name' in data) {
    return `template:${String((data as { name?: unknown }).name ?? '')}`;
  }
  try {
    return JSON.stringify(content);
  } catch {
    return '';
  }
}

function messageDirection(msg: OpenbspMessageRow): 'inbound' | 'outbound' {
  if (msg.sender_address && msg.sender_address !== msg.organization_address) {
    return 'inbound';
  }
  return 'outbound';
}

function mapMessage(msg: OpenbspMessageRow) {
  return {
    id: msg.id,
    body: messageBody(msg.content),
    direction: messageDirection(msg),
    status: msg.status ? Object.keys(msg.status)[0] ?? 'unknown' : 'unknown',
    receivedAt: msg.timestamp || msg.created_at,
    received_at: msg.timestamp || msg.created_at,
    conversationId: msg.conversation_id,
    conversation_address: msg.conversation_address,
  };
}

function buildInboxPayload(
  conversations: OpenbspConversationRow[],
  messages: OpenbspMessageRow[],
  perConvLimit: number,
) {
  const byConv = new Map<string, ReturnType<typeof mapMessage>[]>();
  for (const msg of messages) {
    const list = byConv.get(msg.conversation_id) ?? [];
    list.push(mapMessage(msg));
    byConv.set(msg.conversation_id, list);
  }

  const conversationsMap: Record<
    string,
    {
      id: string;
      organizationId: string;
      organization_id: string;
      fromNumber: string;
      from_number: string;
      toNumber: string;
      to_number: string;
      messages: ReturnType<typeof mapMessage>[];
      firstReceived: string;
      lastReceived: string;
      total: number;
    }
  > = {};

  for (const conv of conversations) {
    const msgs = (byConv.get(conv.id) ?? [])
      .slice()
      .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
      .slice(-perConvLimit);
    const first = msgs[0]?.receivedAt ?? conv.created_at;
    const last = msgs[msgs.length - 1]?.receivedAt ?? conv.updated_at;
    conversationsMap[conv.id] = {
      id: conv.id,
      organizationId: conv.organization_id,
      organization_id: conv.organization_id,
      fromNumber: conv.address,
      from_number: conv.address,
      toNumber: conv.organization_address,
      to_number: conv.organization_address,
      messages: msgs,
      firstReceived: first,
      lastReceived: last,
      total: msgs.length,
    };
  }

  return {
    origem: 'provedor' as const,
    conversations: conversationsMap,
    messages: messages.slice(0, perConvLimit * 5).map(mapMessage),
  };
}

async function fetchInbox(
  orgBsp: string,
  phoneNumberId: string,
  limit: number,
  since?: string,
  signal?: AbortSignal,
) {
  const cfg = openbspConfig();
  if (!cfg) {
    return { ok: false as const, error: 'openbsp_not_configured' as const };
  }

  const [convRes, msgRes] = await Promise.all([
    listProviderConversations(cfg, orgBsp, phoneNumberId, { limit, since, signal }),
    listProviderMessages(cfg, orgBsp, phoneNumberId, { limit: limit * 20, since, signal }),
  ]);

  if (!convRes.ok) {
    return { ok: false as const, error: convRes.error ?? 'provider_error', detail: convRes.errorDetail };
  }
  if (!msgRes.ok) {
    return { ok: false as const, error: msgRes.error ?? 'provider_error', detail: msgRes.errorDetail };
  }

  return {
    ok: true as const,
    data: buildInboxPayload(convRes.data ?? [], msgRes.data ?? [], limit),
  };
}

export async function GET(req: NextRequest) {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const rateResult = await rateLimit(req, 'api', { windowMs: 60000, max: 60 });
  if (rateResult.limited) {
    const response = NextResponse.json(
      { ok: false, error: 'Rate limit excedido', rateLimit: { remaining: 0, resetIn: rateResult.resetIn } },
      { status: 429 },
    );
    response.headers.set('X-RateLimit-Remaining', '0');
    if (rateResult.resetIn > 0) response.headers.set('X-RateLimit-Reset', String(rateResult.resetIn));
    return response;
  }

  const searchParams = req.nextUrl.searchParams;
  const orgParam = searchParams.get('org');
  const sse = searchParams.get('sse') === '1';
  const since = searchParams.get('since') ?? undefined;
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 100);

  // ?org= so conferência (app tenant); divergente → 403
  if (orgParam && orgParam !== user.organizationId) {
    const response = NextResponse.json({ ok: false, error: 'Acesso negado' }, { status: 403 });
    response.headers.set('X-RateLimit-Remaining', String(rateResult.remaining));
    return response;
  }

  const orgBsp = ORG_BSP();
  if (!orgBsp) {
    return NextResponse.json({ ok: false, error: 'OPENBSP_ORG_ID ausente' }, { status: 503 });
  }

  const channel = await getChannelDecrypted(user.organizationId);
  if (!channel?.phoneNumberId || !channel.isOpenBSPConnected) {
    return NextResponse.json(
      { ok: false, error: 'canal_ausente', message: 'Conecte o WhatsApp antes de abrir o inbox' },
      { status: 409 },
    );
  }

  const phoneNumberId = channel.phoneNumberId;

  if (sse) {
    const encoder = new TextEncoder();
    let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const stream = new ReadableStream({
      async start(controller) {
        const cleanup = () => {
          closed = true;
          if (heartbeatTimer) clearTimeout(heartbeatTimer);
          if (pollTimer) clearTimeout(pollTimer);
          heartbeatTimer = null;
          pollTimer = null;
        };

        const safeEnqueue = (chunk: string) => {
          if (closed || req.signal.aborted) return;
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            cleanup();
          }
        };

        const scheduleHeartbeat = () => {
          if (closed || req.signal.aborted) return;
          heartbeatTimer = setTimeout(() => {
            safeEnqueue(`data: ${JSON.stringify({ type: 'keep-alive' })}\n\n`);
            scheduleHeartbeat();
          }, 15000);
        };

        const schedulePoll = () => {
          if (closed || req.signal.aborted) return;
          pollTimer = setTimeout(async () => {
            if (closed || req.signal.aborted) return;
            try {
              const sinceIso = new Date(Date.now() - 8000).toISOString();
              const update = await fetchInbox(orgBsp, phoneNumberId, limit, sinceIso, req.signal);
              if (update.ok) {
                const hasConv = Object.keys(update.data.conversations).length > 0;
                const hasMsg = update.data.messages.length > 0;
                if (hasConv || hasMsg) {
                  safeEnqueue(`data: ${JSON.stringify({ type: 'new', ...update.data })}\n\n`);
                }
              }
            } catch (e) {
              console.error('[conversas SSE] poll error:', e);
            } finally {
              schedulePoll();
            }
          }, 3000);
        };

        try {
          const initial = await fetchInbox(orgBsp, phoneNumberId, limit, undefined, req.signal);
          if (!initial.ok) {
            safeEnqueue(
              `data: ${JSON.stringify({ type: 'error', error: initial.error, detail: 'detail' in initial ? initial.detail : undefined })}\n\n`,
            );
          } else {
            safeEnqueue(`data: ${JSON.stringify({ type: 'initial', ...initial.data })}\n\n`);
          }
          scheduleHeartbeat();
          schedulePoll();
        } catch (e) {
          safeEnqueue(`data: ${JSON.stringify({ type: 'error', error: String(e) })}\n\n`);
          cleanup();
          try {
            controller.close();
          } catch {
            /* already closed */
          }
          return;
        }

        const onAbort = () => {
          cleanup();
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        };

        if (req.signal.aborted) {
          onAbort();
        } else {
          req.signal.addEventListener('abort', onAbort, { once: true });
        }
      },
      cancel() {
        closed = true;
        if (heartbeatTimer) clearTimeout(heartbeatTimer);
        if (pollTimer) clearTimeout(pollTimer);
      },
    });

    const response = new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        'X-RateLimit-Remaining': String(rateResult.remaining),
      },
    });
    if (rateResult.resetIn > 0) response.headers.set('X-RateLimit-Reset', String(rateResult.resetIn));
    return response;
  }

  const result = await fetchInbox(orgBsp, phoneNumberId, limit, since, req.signal);
  if (!result.ok) {
    const response = NextResponse.json(
      { ok: false, error: result.error, detail: 'detail' in result ? result.detail : undefined },
      { status: 502 },
    );
    response.headers.set('X-RateLimit-Remaining', String(rateResult.remaining));
    return response;
  }

  const response = NextResponse.json({ ok: true, ...result.data }, { status: 200 });
  response.headers.set('X-RateLimit-Remaining', String(rateResult.remaining));
  if (rateResult.resetIn > 0) response.headers.set('X-RateLimit-Reset', String(rateResult.resetIn));
  return response;
}
