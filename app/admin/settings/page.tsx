'use client';

// Configurações administrativas — status REAL dos subsistemas existentes.
// Mostra somente o que o backend expõe hoje (roteador de IA, fila, memória,
// sessão/papel). Nada é inventado: quando um subsistema está indisponível no
// ambiente, a tela mostra o motivo exato.

import AppNav from '@/components/AppNav';
import { useEffect, useState } from 'react';

interface RouterState {
  ok: boolean;
  authorized: boolean;
  configured: boolean;
  model: string | null;
  baseUrl: string | null;
  detail: string | null;
}

interface QueueState {
  ok: boolean;
  authorized: boolean;
  available: boolean;
  count: number | null;
  detail: string | null;
}

interface MemoryState {
  ok: boolean;
  authorized: boolean;
  available: boolean;
  count: number | null;
  detail: string | null;
}

interface SessionState {
  authorized: boolean;
  role: string | null;
  organizationId: string | null;
}

async function getJson(url: string): Promise<{ status: number; body: any }> {
  const r = await fetch(url);
  let body: any = null;
  try {
    body = await r.json();
  } catch {
    /* corpo não-JSON */
  }
  return { status: r.status, body };
}

export default function AdminSettingsPage() {
  const [router, setRouter] = useState<RouterState | null>(null);
  const [queue, setQueue] = useState<QueueState | null>(null);
  const [memory, setMemory] = useState<MemoryState | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [routerRes, queueRes, memoryRes, sessionRes] = await Promise.all([
        getJson('/api/admin/chat').catch(() => null),
        getJson('/api/admin/tasks').catch(() => null),
        getJson('/api/admin/memory').catch(() => null),
        getJson('/api/auth/session').catch(() => null),
      ]);

      if (cancelled) return;

      if (routerRes) {
        const b = routerRes.body ?? {};
        setRouter({
          ok: routerRes.status === 200,
          authorized: routerRes.status !== 401,
          configured: Boolean(b?.routerConfigured),
          model: b?.model ?? null,
          baseUrl: b?.baseUrl ?? null,
          detail: routerRes.status === 401 ? 'exige papel admin/owner' : null,
        });
      }
      if (queueRes) {
        const b = queueRes.body ?? {};
        setQueue({
          ok: queueRes.status === 200,
          authorized: queueRes.status !== 401,
          available: queueRes.status === 200,
          count: typeof b?.count === 'number' ? b.count : null,
          detail: queueRes.status === 503 ? b?.detail ?? 'fila indisponível' : queueRes.status === 401 ? 'exige papel admin/owner' : null,
        });
      }
      if (memoryRes) {
        const b = memoryRes.body ?? {};
        setMemory({
          ok: memoryRes.status === 200,
          authorized: memoryRes.status !== 401,
          available: memoryRes.status === 200,
          count: typeof b?.count === 'number' ? b.count : null,
          detail: memoryRes.status === 503 ? b?.detail ?? 'memória indisponível' : memoryRes.status === 401 ? 'exige papel admin/owner' : null,
        });
      }
      if (sessionRes) {
        const b = sessionRes.body ?? {};
        setSession({
          authorized: sessionRes.status === 200,
          role: b?.role ?? null,
          organizationId: b?.organizationId ?? null,
        });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <>
        <AppNav />
        <main className="min-h-screen p-4 sm:p-8 bg-[#05020A] text-gray-400 text-sm">
          Verificando configuração…
        </main>
      </>
    );
  }

  const card = (title: string, lines: Array<{ k: string; v: React.ReactNode }>, tone: 'ok' | 'warn' | 'bad' | 'muted') => {
    const toneCls =
      tone === 'ok'
        ? 'border-green-400/20'
        : tone === 'warn'
          ? 'border-amber-400/20'
          : tone === 'bad'
            ? 'border-red-400/20'
            : 'border-white/10';
    const dot =
      tone === 'ok' ? 'bg-green-400' : tone === 'warn' ? 'bg-amber-400' : tone === 'bad' ? 'bg-red-400' : 'bg-gray-500';
    return (
      <div className={`p-4 bg-[#0D0915] border ${toneCls} rounded-2xl`}>
        <div className="flex items-center gap-2 mb-3">
          <span className={`h-2 w-2 rounded-full ${dot}`} />
          <h2 className="text-sm font-semibold text-gray-200">{title}</h2>
        </div>
        <dl className="grid grid-cols-2 gap-y-1 text-xs">
          {lines.map((l, i) => (
            <div key={i} className="contents">
              <dt className="text-gray-500">{l.k}</dt>
              <dd className="text-gray-300 break-words">{l.v}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  };

  return (
    <>
      <AppNav />
      <main className="min-h-screen p-4 sm:p-8 bg-[#05020A]">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Configurações administrativas</h1>
          <p className="text-sm text-gray-500">
            Estado real dos subsistemas existentes. Somente o que o backend expõe — sem valores de
            segredo.
          </p>
        </div>

        {session !== null && !session.authorized && (
          <div className="mb-4 p-3 text-sm text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-lg">
            Faça login para ver a configuração administrativa.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 max-w-4xl">
          {router &&
            card(
              'Roteador de IA (OmniRouter)',
              [
                {
                  k: 'Status',
                  v: !router.authorized ? (
                    <span className="text-amber-400">exige admin</span>
                  ) : router.configured ? (
                    <span className="text-green-400">configurado</span>
                  ) : (
                    <span className="text-amber-400">não configurado</span>
                  ),
                },
                { k: 'Modelo', v: router.model ?? '—' },
                { k: 'Origem', v: router.baseUrl ?? '—' },
              ],
              router.authorized ? (router.configured ? 'ok' : 'warn') : 'muted',
            )}

          {queue &&
            card(
              'Fila de tarefas',
              [
                {
                  k: 'Status',
                  v: !queue.authorized ? (
                    <span className="text-amber-400">exige admin</span>
                  ) : queue.available ? (
                    <span className="text-green-400">disponível</span>
                  ) : (
                    <span className="text-amber-400">indisponível</span>
                  ),
                },
                { k: 'Tarefas', v: queue.count !== null ? String(queue.count) : '—' },
                { k: 'Observação', v: queue.detail ?? (queue.count !== null ? `contando ${queue.count} registro(s)` : 'ok') },
              ],
              queue.authorized ? (queue.available ? 'ok' : 'warn') : 'muted',
            )}

          {memory &&
            card(
              'Memória de agentes',
              [
                {
                  k: 'Status',
                  v: !memory.authorized ? (
                    <span className="text-amber-400">exige admin</span>
                  ) : memory.available ? (
                    <span className="text-green-400">disponível</span>
                  ) : (
                    <span className="text-amber-400">indisponível</span>
                  ),
                },
                { k: 'Registros', v: memory.count !== null ? String(memory.count) : '—' },
                { k: 'Observação', v: memory.detail ?? 'ok' },
              ],
              memory.authorized ? (memory.available ? 'ok' : 'warn') : 'muted',
            )}

          {session &&
            card(
              'Sessão e papel',
              [
                {
                  k: 'Autenticado',
                  v: session.authorized ? <span className="text-green-400">sim</span> : <span className="text-red-400">não</span>,
                },
                { k: 'Papel', v: session.role ?? '—' },
                { k: 'Organização', v: session.organizationId ? (
                  <span title={session.organizationId} className="truncate">{session.organizationId.slice(0, 12)}…</span>
                ) : '—' },
              ],
              session.authorized ? 'ok' : 'muted',
            )}
        </div>

        <p className="text-xs text-gray-600 mt-6 max-w-4xl">
          Se o roteador ou a fila estiverem &ldquo;indisponível&rdquo;, normalmente falta credencial no ambiente
          do servidor (ex.: chave do OmniRouter) ou a migration da fila ainda não foi aplicada.
          Nenhuma chave ou segredo é exibido nesta tela.
        </p>
      </main>
    </>
  );
}
