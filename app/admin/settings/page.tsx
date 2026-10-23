'use client';

// Configurações administrativas — status REAL dos subsistemas existentes.
// Mostra somente o que o backend expõe hoje (roteador de IA, fila, memória,
// sessão/papel). Nada é inventado: quando um subsistema está indisponível no
// ambiente, a tela mostra o motivo exato.
//
// Configuração de IA: salva via API segura (AgentMemory no DB) — NUNCA
// no localStorage. A chave de API nunca retorna ao frontend.

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';

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

  // Configuração manual de IA (persistida no DB via API, NÃO no navegador)
  const [aiBaseUrl, setAiBaseUrl] = useState('');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [aiSaved, setAiSaved] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

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
          detail:
            queueRes.status === 503
              ? b?.detail ?? 'fila indisponível'
              : queueRes.status === 401
                ? 'exige papel admin/owner'
                : null,
        });
      }
      if (memoryRes) {
        const b = memoryRes.body ?? {};
        setMemory({
          ok: memoryRes.status === 200,
          authorized: memoryRes.status !== 401,
          available: memoryRes.status === 200,
          count: typeof b?.count === 'number' ? b.count : null,
          detail:
            memoryRes.status === 503
              ? b?.detail ?? 'memória indisponível'
              : memoryRes.status === 401
                ? 'exige papel admin/owner'
                : null,
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

  // Carregar configuração de IA do servidor (API segura — nunca do localStorage)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch('/api/admin/ai-config').catch(() => null);
      if (cancelled || !res) return;
      const b = await res.json().catch(() => null);
      if (b?.configured && b?.baseUrl) {
        setAiBaseUrl(b.baseUrl);
        setAiModel(b.model ?? '');
        // apiKey não é retornado — campo fica vazio por segurança
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveAiConfig = async () => {
    const base = aiBaseUrl.trim();
    const key = aiApiKey.trim();
    const model = aiModel.trim();
    setAiError(null);

    if (!base || !key) {
      setAiError('Base URL e API Key são obrigatórios.');
      return;
    }

    try {
      new URL(base);
    } catch {
      setAiError('Base URL precisa ser uma URL válida (ex: https://api.openai.com).');
      return;
    }

    setAiLoading(true);
    try {
      const res = await fetch('/api/admin/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: base, apiKey: key, model: model || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Falha ao salvar');
      setAiSaved(true);
      setAiApiKey(''); // limpar campo de senha após salvar
      setTimeout(() => setAiSaved(false), 3000);
      // Recarregar estado do roteador
      const r = await fetch('/api/admin/chat').catch(() => null);
      if (r?.ok) {
        const b = await r.json().catch(() => null);
        if (b) {
          setRouter((prev) =>
            prev
              ? { ...prev, configured: Boolean(b.routerConfigured), model: b.model, baseUrl: b.baseUrl }
              : prev,
          );
        }
      }
    } catch (err: any) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const clearAiConfig = async () => {
    setAiLoading(true);
    try {
      await fetch('/api/admin/ai-config', { method: 'DELETE' });
      setAiBaseUrl('');
      setAiApiKey('');
      setAiModel('');
      setAiSaved(false);
      // Recarregar estado do roteador
      const r = await fetch('/api/admin/chat').catch(() => null);
      if (r?.ok) {
        const b = await r.json().catch(() => null);
        if (b) {
          setRouter((prev) =>
            prev
              ? { ...prev, configured: Boolean(b.routerConfigured), model: b.model, baseUrl: b.baseUrl }
              : prev,
          );
        }
      }
    } catch {
      setAiError('Falha ao remover configuração.');
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <main className="min-h-screen p-4 sm:p-8 bg-[#05020A] text-gray-400 text-sm">
          Verificando configuração…
        </main>
      </AppShell>
    );
  }

  const card = (
    title: string,
    lines: Array<{ k: string; v: React.ReactNode }>,
    tone: 'ok' | 'warn' | 'bad' | 'muted',
  ) => {
    const toneCls =
      tone === 'ok'
        ? 'border-green-400/20'
        : tone === 'warn'
          ? 'border-amber-400/20'
          : tone === 'bad'
            ? 'border-red-400/20'
            : 'border-white/10';
    const dot =
      tone === 'ok'
        ? 'bg-green-400'
        : tone === 'warn'
          ? 'bg-amber-400'
          : tone === 'bad'
            ? 'bg-red-400'
            : 'bg-gray-500';
    return (
      <div className={`p-4 bg-[#0D0915] border ${toneCls} rounded-2xl`}>
        <div className="flex items-center gap-2 mb-3">
          <span className={`h-2 w-2 rounded-full ${dot}`} />
          <h2 className="text-sm font-semibold text-gray-200">{title}</h2>
        </div>
        <dl className="grid grid-cols-2 gap-y-1 text-xs">
          {lines.map((l, i) => (
            <div key={i} className="contents">
              <dt className="text-gray-300">{l.k}</dt>
              <dd className="text-gray-300 break-words">{l.v}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  };

  return (
    <AppShell>
      <main className="min-h-screen p-4 sm:p-8 bg-[#05020A]">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Configurações administrativas</h1>
          <p className="text-sm text-gray-300">
            Estado real dos subsistemas existentes. Somente o que o backend expõe — sem valores de
            segredo.
          </p>
        </div>

        {session !== null && !session.authorized && (
          <div className="mb-4 p-3 text-sm text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-lg">
            Faça login para ver a configuração administrativa.
            <p className="text-xs text-gray-400 mt-1">Painel visível apenas para administradores e owners.</p>
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
                {
                  k: 'Configuração',
                  v: router.configured ? (
                    <span className="text-gray-300">ativa no servidor</span>
                  ) : (
                    <a href="#ai-config" className="text-purple-400 hover:underline">
                      configurar abaixo ↓
                    </a>
                  ),
                },
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
                {
                  k: 'Observação',
                  v: queue.detail ?? (queue.count !== null ? `contando ${queue.count} registro(s)` : 'ok'),
                },
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
                  v: session.authorized ? (
                    <span className="text-green-400">sim</span>
                  ) : (
                    <span className="text-red-400">não</span>
                  ),
                },
                { k: 'Papel', v: session.role ?? '—' },
                {
                  k: 'Organização',
                  v: session.organizationId ? (
                    <span title={session.organizationId} className="truncate">
                      {session.organizationId.slice(0, 12)}…
                    </span>
                  ) : (
                    '—'
                  ),
                },
              ],
              session.authorized ? 'ok' : 'muted',
            )}
        </div>

        {/* Configuração manual de IA — salva no DB, nunca no navegador */}
        <div
          id="ai-config"
          className="mt-6 max-w-4xl p-4 bg-[#0D0915] border border-purple-500/20 rounded-2xl"
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="h-2 w-2 rounded-full bg-purple-400" />
            <h2 className="text-sm font-semibold text-gray-200">Configuração manual de IA</h2>
          </div>
          <p className="text-xs text-gray-300 mb-4">
            Salve uma chave de API manualmente. A configuração é armazenada de forma segura no
            banco de dados (RLS ativo) e usada pelo chat quando o roteador do servidor não está
            configurado. A chave <strong>nunca</strong> é retornada ao navegador.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label htmlFor="ai-base-url" className="block text-xs text-gray-300 mb-1">Base URL</label>
              <input
                id="ai-base-url"
                type="url"
                value={aiBaseUrl}
                onChange={(e) => setAiBaseUrl(e.target.value)}
                placeholder="https://api.openai.com"
                className="w-full px-3 py-2 text-sm bg-black/50 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label htmlFor="ai-api-key" className="block text-xs text-gray-300 mb-1">API Key</label>
              <input
                id="ai-api-key"
                type="password"
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2 text-sm bg-black/50 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                Campo limpo após salvar com sucesso.
              </p>
            </div>
            <div>
              <label htmlFor="ai-model" className="block text-xs text-gray-300 mb-1">Modelo</label>
              <input
                id="ai-model"
                type="text"
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                placeholder="gpt-4o (opcional)"
                className="w-full px-3 py-2 text-sm bg-black/50 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
          {aiError && <p className="mt-2 text-xs text-red-400">{aiError}</p>}
          <div className="mt-3 flex gap-2">
            <button
              onClick={saveAiConfig}
              disabled={aiLoading}
              className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
            >
              {aiSaved ? '✓ Salvo!' : aiLoading ? 'Salvando…' : 'Salvar configuração'}
            </button>
            <button
              onClick={clearAiConfig}
              disabled={aiLoading}
              className="px-4 py-2 text-sm text-gray-400 border border-white/10 rounded-lg hover:bg-white/5 focus:outline-none disabled:opacity-50"
            >
              Limpar
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            ⚠ Para ativação global no servidor, configure as variáveis de ambiente{' '}
            <code className="text-purple-300">OMNIROUTER_BASE_URL</code> e{' '}
            <code className="text-purple-300">OMNIROUTER_API_KEY</code> no Hostinger hpanel.
          </p>
        </div>

        <p className="text-xs text-gray-400 mt-6 max-w-4xl">
          Se o roteador ou a fila estiverem &ldquo;indisponível&rdquo;, normalmente falta credencial
          no ambiente do servidor (ex.: chave do OmniRouter) ou a migration da fila ainda não foi
          aplicada. Nenhuma chave ou segredo é exibido nesta tela.
        </p>
      </main>
    </AppShell>
  );
}
