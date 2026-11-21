'use client';

import AppShell from '@/components/AppShell';
import { useEffect, useState } from 'react';

const POLL_FALLBACK_MS = 8000;
const KEEPALIVE_MS = 15000;

function useConversations(orgId?: string | undefined) {
  // Handle undefined orgId gracefully
  const [conversations, setConversations] = useState<
    Array<{
      organization_id: string;
      from_number: string;
      to_number: string;
      messages: Array<{
        id: string;
        body: string;
        direction: string;
        status: string;
        received_at: string;
      }>;
      firstReceived: string;
      lastReceived: string;
      total: number;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [sseError, setSSEError] = useState<string | null>(null);
  const [sseSupported, setSSESupported] = useState(false);

  useEffect(() => {
    if (!orgId) return;

    const accept = true; // simplified: assume SSE supported for now
    const headers: Record<string, string> = {};

    if (accept) {
      headers.Accept = 'text/event-stream';
      setSSESupported(true);
    }

    let mounted = true;

    async function load() {
      try {
        const org = orgId?.trim() ?? '';
        const params = new URLSearchParams();
        if (org) {
          params.set('org', org);
        }
        params.set('sse', '1');

        const res = await fetch(`/api/whatsapp/conversas?${params.toString()}`, {
          headers,
          cache: 'no-store',
        });

        if (!mounted) return;

        if (res.status === 401) {
          setSSEError('Não autorizado — faça login.');
          return;
        }

        if (!res.ok) {
          // Fall back to polling if SSE fails
          await fetchDataPoll();
          return;
        }

        const text = await res.text();
        const orgForSSE = orgId ?? '';
        const data = parseSSE(text, orgForSSE);
        setConversations(data.conversations);
        setLoading(false);
      } catch (e) {
        console.error('SSE error, falling back to poll:', e);
        await fetchDataPoll();
      }
    }

    async function fetchDataPoll() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (orgId) params.set('org', orgId);
        const res = await fetch(`/api/whatsapp/conversas?${params.toString()}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('Failed to fetch conversations');
        const { conversations, messages } = (await res.json()) as {
          conversations: any;
          messages: any;
        };
        // Group messages by conversation key
        const grouped = Object.values(conversations || {}).reduce(
          (acc: any, conv: any) => {
            const key = `${conv.organization_id}-${conv.from_number}`;
            if (!acc[key]) {
              acc[key] = {
                organization_id: conv.organization_id,
                from_number: conv.from_number,
                to_number: conv.to_number,
                messages: [],
                firstReceived: conv.firstReceived,
                lastReceived: conv.lastReceived,
                total: conv.total,
              };
            }
            // messages already included in conv.messages
            return acc;
          },
          {},
        );
        // Ensure all msg objects have received_at
        const msgs = (messages || []).map((m: any) => ({
          id: m.id || m.message_id,
          body: m.body,
          direction: m.direction || m.fromChannel || 'inbound',
          status: m.status,
          received_at: m.received_at,
        }));
        setConversations(msgs);
        setLoading(false);
      } catch (e) {
        setSSEError('Erro ao carregar conversas');
        setLoading(false);
      }
    }

    function parseSSE(text: string, orgId: string) {
      const conversationsMap: Record<string, any> = {};
      const messages: any[] = [];

      for (const line of text.split('\n')) {
        if (line.startsWith('data: ')) {
          const payload = line.slice('data: '.length).trim();
          if (!payload || payload === 'keep-alive') continue;
          try {
            const ev = JSON.parse(payload);
            if (ev.type === 'initial' || ev.type === 'new') {
              const evConversations = ev.conversations || {};
              const evMessages = ev.messages || [];

              // Group by organization_id + from_number
              for (const [key, conv] of Object.entries(evConversations as Record<string, any>)) {
                if (!conversationsMap[key]) {
                  conversationsMap[key] = {
                    organization_id: (conv as any).organization_id ?? orgId,
                    from_number: (conv as any).from_number ?? '',
                    to_number: (conv as any).to_number ?? '',
                    messages: [],
                    firstReceived: (conv as any).firstReceived ?? '',
                    lastReceived: (conv as any).lastReceived ?? '',
                    total: (conv as any).total ?? 0,
                  };
                }
                // Add messages
                for (const m of (evMessages || [])) {
                  const mk = `${conv.organization_id ?? orgId}-${conv.from_number ?? ''}`;
                  conversationsMap[mk].messages.push({
                    id: m.id || m.message_id,
                    body: m.body,
                    direction: m.direction ?? m.fromChannel ?? 'inbound',
                    status: m.status ?? 'received',
                    received_at: m.received_at,
                  });
                  messages.push({
                    id: m.id || m.message_id,
                    body: m.body,
                    direction: m.direction ?? m.fromChannel ?? 'inbound',
                    status: m.status ?? 'received',
                    received_at: m.received_at,
                  });
                }
                // Update totals/timestamps
                if (conv.total !== undefined) conversationsMap[key].total = conv.total;
                if (conv.firstReceived && (!conversationsMap[key].firstReceived ||
                  conv.firstReceived < conversationsMap[key].firstReceived)) {
                  conversationsMap[key].firstReceived = conv.firstReceived;
                }
                if (conv.lastReceived && (!conversationsMap[key].lastReceived ||
                  conv.lastReceived > conversationsMap[key].lastReceived)) {
                  conversationsMap[key].lastReceived = conv.lastReceived;
                }
              }
            }
          } catch (e) {
            // ignore parse errors in individual events
          }
        }
      }

      return {
        conversations: Object.values(conversationsMap),
        messages,
      };
    }

    // Initial load
    load();

    // Keep-alive / reconnect: re-fetch every 8s, but keep SSE stream alive
    const interval = setInterval(() => {
      if (!mounted) return;
      load();
    }, POLL_FALLBACK_MS);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [orgId]);

  return { conversations, loading, sseError, sseSupported };
}

interface Conversation {
  organization_id: string;
  from_number: string;
  to_number: string;
  messages: Array<{
    id: string;
    body: string;
    direction: string;
    status: string;
    received_at: string;
  }>;
  firstReceived: string;
  lastReceived: string;
  total: number;
}

export default function Inbox() {
  // Try to get org from session or meta
  const [orgId, setOrgId] = useState<string | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/session', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        // Session API returns { authenticated: false } without error/unauthorized keys
        // Check data.authenticated directly instead of checking for error/unauthorized which are undefined
        setOrgId(data.authenticated === true ? (data.user?.organizationId as string | undefined) : undefined);
      } catch {
        setOrgId(undefined);
      }
    })();
  }, []);

  const { conversations, loading, sseError, sseSupported } = useConversations(orgId);

  if (loading) {
    return (
      <div className="p-4 sm:p-5 bg-[#0D0915] border border-white/10 rounded-2xl">
        <p className="text-sm text-gray-400">Carregando conversas...</p>
      </div>
    );
  }

  if (sseError) {
    return (
      <div className="p-4 sm:p-5 bg-[#0D0915] border border-white/10 rounded-2xl">
        <p className="text-sm text-amber-300">{sseError}</p>
        <p className="text-sm text-gray-400 mt-1">
          Tentando polling alternativo. Atualize a página se persistir.
        </p>
      </div>
    );
  }

  if (!sseSupported && sseError) {
    // Fallback UI when SSE not supported
    return (
      <div className="p-4 sm:p-5 bg-[#0D0915] border border-white/10 rounded-2xl">
        <p className="text-sm text-gray-400">
          Modo polling ativo. SSE não suportado neste navegador.
        </p>
      </div>
    );
  }

  return (
    <AppShell>
      <main className="min-h-screen p-4 sm:p-8 bg-[#05020A]">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">
              Inbox em Tempo Real
            </h1>
            <p className="text-sm text-gray-400">
              Conversas e mensagens recebidas via WhatsApp Business API
            </p>
          </div>

          {sseSupported ? (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {conversations.length === 0 ? (
                <p className="text-sm text-gray-400">
                  Nenhuma conversa encontrada.
                </p>
              ) : (
                conversations.map((conv: any, i) => (
                  <div
                    key={i}
                    className="border-b border-white/10 pb-3 last:pb-0"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-300">
                        {conv.from_number} → {conv.to_number}
                      </span>
                      <span className="text-xs text-purple-400">
                        {conv.total} mensagem{conv.total !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="space-y-1 max-h-[150px] overflow-y-auto">
                      {conv.messages
                        .slice(-20)
                        .map((msg: any, mi) => (
                          <div
                            key={mi}
                            className="flex items-center gap-2 text-xs text-gray-300"
                          >
                            <span>{msg.body?.slice(0, 30) || '—'}</span>
                            <span>{new Date(msg.received_at).toLocaleTimeString()}</span>
                          </div>
                        ))}
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{conv.firstReceived}</span>
                      <span>{conv.lastReceived}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="bg-[#0D0915] border border-white/10 rounded-2xl p-4">
              <p className="text-sm text-gray-400">
                SSE não suportado. Atualize o navegador ou use modo polling.
              </p>
            </div>
          )}

          {!sseSupported && !sseError && (
            <div className="mt-4 p-3 bg-[#0D0915] border border-white/10 rounded-2xl text-sm text-gray-400">
              <strong>Modo Polling:</strong> Atualiza a cada 8s. SSE não disponível.
            </div>
          )}

          {loading && (
            <div className="mt-4 p-3 bg-[#0D0915] border border-white/10 rounded-2xl text-sm text-gray-400">
              <span className="animate-bounce">Carregando...</span>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}