'use client';

import AppShell from '@/components/AppShell';
import { useEffect, useState } from 'react';

const POLL_FALLBACK_MS = 8000;

type InboxMessage = {
  id: string;
  body: string;
  direction: string;
  status: string;
  received_at: string;
};

type Conversation = {
  id?: string;
  organization_id: string;
  from_number: string;
  to_number: string;
  messages: InboxMessage[];
  firstReceived: string;
  lastReceived: string;
  total: number;
};

function normalizeConversations(
  raw: Record<string, unknown> | Conversation[] | undefined,
): Conversation[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return Object.values(raw).map((conv) => {
    const c = conv as Record<string, unknown>;
    const messages = Array.isArray(c.messages)
      ? (c.messages as Array<Record<string, unknown>>).map((m) => ({
          id: String(m.id ?? ''),
          body: String(m.body ?? ''),
          direction: String(m.direction ?? 'inbound'),
          status: String(m.status ?? 'unknown'),
          received_at: String(m.received_at ?? m.receivedAt ?? ''),
        }))
      : [];
    return {
      id: typeof c.id === 'string' ? c.id : undefined,
      organization_id: String(c.organization_id ?? c.organizationId ?? ''),
      from_number: String(c.from_number ?? c.fromNumber ?? ''),
      to_number: String(c.to_number ?? c.toNumber ?? ''),
      messages,
      firstReceived: String(c.firstReceived ?? ''),
      lastReceived: String(c.lastReceived ?? ''),
      total: typeof c.total === 'number' ? c.total : messages.length,
    };
  });
}

function useConversations(orgId?: string) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sseError, setSSEError] = useState<string | null>(null);
  const [sseSupported, setSSESupported] = useState(false);

  useEffect(() => {
    if (!orgId) return;

    let mounted = true;
    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    async function fetchPoll() {
      try {
        const params = new URLSearchParams({ org: orgId! });
        const res = await fetch(`/api/whatsapp/conversas?${params.toString()}`, {
          cache: 'no-store',
        });
        if (!mounted) return;
        if (res.status === 401) {
          setSSEError('Não autorizado — faça login.');
          setLoading(false);
          return;
        }
        if (res.status === 409) {
          setSSEError('Conecte o WhatsApp para ver conversas.');
          setLoading(false);
          return;
        }
        if (!res.ok) {
          setSSEError('Erro ao carregar conversas');
          setLoading(false);
          return;
        }
        const data = (await res.json()) as { conversations?: Record<string, unknown> };
        setConversations(normalizeConversations(data.conversations));
        setSSEError(null);
        setLoading(false);
      } catch {
        if (!mounted) return;
        setSSEError('Erro ao carregar conversas');
        setLoading(false);
      }
    }

    function startPoll() {
      void fetchPoll();
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(() => {
        void fetchPoll();
      }, POLL_FALLBACK_MS);
    }

    function startSSE() {
      if (typeof EventSource === 'undefined') {
        setSSESupported(false);
        startPoll();
        return;
      }
      setSSESupported(true);
      const params = new URLSearchParams({ org: orgId!, sse: '1' });
      es = new EventSource(`/api/whatsapp/conversas?${params.toString()}`);

      es.onmessage = (ev) => {
        if (!mounted) return;
        try {
          const payload = JSON.parse(ev.data) as {
            type?: string;
            conversations?: Record<string, unknown>;
            error?: string;
          };
          if (payload.type === 'keep-alive') return;
          if (payload.type === 'error') {
            setSSEError(payload.error ?? 'Erro SSE');
            es?.close();
            startPoll();
            return;
          }
          if (payload.type === 'initial' || payload.type === 'new') {
            const next = normalizeConversations(payload.conversations);
            if (payload.type === 'initial' || next.length > 0) {
              setConversations((prev) => {
                if (payload.type === 'initial') return next;
                const map = new Map(prev.map((c) => [c.id ?? c.from_number, c]));
                for (const c of next) map.set(c.id ?? c.from_number, c);
                return Array.from(map.values());
              });
            }
            setLoading(false);
            setSSEError(null);
          }
        } catch {
          /* ignore malformed event */
        }
      };

      es.onerror = () => {
        if (!mounted) return;
        es?.close();
        es = null;
        setSSESupported(false);
        startPoll();
      };
    }

    startSSE();

    return () => {
      mounted = false;
      es?.close();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [orgId]);

  return { conversations, loading, sseError, sseSupported };
}

export default function Inbox() {
  const [orgId, setOrgId] = useState<string | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/session', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = (await res.json()) as {
          authenticated?: boolean;
          user?: { organizationId?: string };
        };
        setOrgId(data.authenticated === true ? data.user?.organizationId : undefined);
      } catch {
        setOrgId(undefined);
      }
    })();
  }, []);

  const { conversations, loading, sseError, sseSupported } = useConversations(orgId);

  if (loading) {
    return (
      <AppShell>
        <div className="p-4 sm:p-5 bg-[#0D0915] border border-white/10 rounded-2xl">
          <p className="text-sm text-gray-400">Carregando conversas...</p>
        </div>
      </AppShell>
    );
  }

  if (sseError && conversations.length === 0) {
    return (
      <AppShell>
        <div className="p-4 sm:p-5 bg-[#0D0915] border border-white/10 rounded-2xl">
          <p className="text-sm text-amber-300">{sseError}</p>
          <p className="text-sm text-gray-400 mt-1">
            Tentando polling alternativo. Atualize a página se persistir.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="min-h-screen p-4 sm:p-8 bg-[#05020A]">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">Inbox em Tempo Real</h1>
            <p className="text-sm text-gray-400">
              Conversas e mensagens via provedor OpenBSP
              {sseSupported ? ' (SSE)' : ' (polling)'}
            </p>
          </div>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {conversations.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhuma conversa encontrada.</p>
            ) : (
              conversations.map((conv, i) => (
                <div key={conv.id ?? `${conv.from_number}-${i}`} className="border-b border-white/10 pb-3 last:pb-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-300">
                      {conv.from_number} → {conv.to_number}
                    </span>
                    <span className="text-xs text-purple-400">
                      {conv.total} mensagem{conv.total !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="space-y-1 max-h-[150px] overflow-y-auto">
                    {conv.messages.slice(-20).map((msg) => (
                      <div key={msg.id} className="flex items-center gap-2 text-xs text-gray-300">
                        <span className="text-gray-500">{msg.direction}</span>
                        <span>{msg.body?.slice(0, 80) || '—'}</span>
                        <span>
                          {msg.received_at
                            ? new Date(msg.received_at).toLocaleTimeString()
                            : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {sseError && conversations.length > 0 && (
            <p className="mt-4 text-xs text-amber-300">{sseError}</p>
          )}
        </div>
      </main>
    </AppShell>
  );
}
