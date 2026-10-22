'use client';

// FASE AGENT â€” Phase 2: Centro Administrativo (UI).
// Chat administrativo via SSE + painel de tarefas com progresso REAL.
// Funciona mesmo sem IA: o backend responde com mensagem informativa clara.
// Sem simulaÃ§Ã£o: quando a fila nÃ£o existe no ambiente, mostra o motivo exato.

import { useCallback, useEffect, useRef, useState } from 'react';
import AppShell from '@/components/AppShell';

// ------------------------------------------------------------------
// Tipos (espelho dos contratos das rotas /api/admin/*)
// ------------------------------------------------------------------
interface RouterStatus {
  routerConfigured: boolean;
  model: string | null;
  baseUrl: string | null;
}

type TaskStatus =
  | 'queued'
  | 'running'
  | 'waiting_human'
  | 'completed'
  | 'failed'
  | 'canceled';

interface TaskItem {
  id: string;
  title: string;
  status: TaskStatus;
  progress: number;
  modelUsed: string | null;
  errorText: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface TaskDetail extends TaskItem {
  waitingReason: string | null;
  steps: Array<{ seq: number; name: string; status: string }>;
  events: Array<{ type: string; payload: unknown; at: string }>;
}

interface ChatMessageView {
  role: 'user' | 'assistant' | 'system';
  text: string;
  model?: string;
  usage?: Record<string, unknown>;
  error?: string;
}

interface StreamNote {
  taskId?: string;
  progress?: number;
  step?: string;
  warning?: string;
  total?: number;
}

// ------------------------------------------------------------------
// SSE reader (fetch + ReadableStream â€” EventSource nÃ£o suporta POST)
// ------------------------------------------------------------------
async function streamChat(
  message: string,
  onEvent: (ev: Record<string, unknown>) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch('/api/admin/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
    signal,
  });
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => null);
    onEvent({
      type: 'error',
      code: 'http',
      detail: (err as { error?: string })?.error ?? `HTTP ${res.status}`,
    });
    onEvent({ type: 'done', ok: false });
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      for (const line of chunk.split('\n')) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        try {
          onEvent(JSON.parse(t.slice(5).trim()));
        } catch {
          /* linha parcial/malformada: nÃ£o inventa dado */
        }
      }
    }
  }
}

// ------------------------------------------------------------------
// PÃ¡gina
// ------------------------------------------------------------------
const OPEN_STATUSES: TaskStatus[] = ['queued', 'running', 'waiting_human'];

const statusColor: Record<TaskStatus, string> = {
  queued: 'text-yellow-400',
  running: 'text-sky-400',
  waiting_human: 'text-amber-400',
  completed: 'text-green-400',
  failed: 'text-red-400',
  canceled: 'text-gray-500',
};

const statusLabel: Record<TaskStatus, string> = {
  queued: 'na fila',
  running: 'em execuÃ§Ã£o',
  waiting_human: 'aguardando humano',
  completed: 'concluÃ­da',
  failed: 'falhou',
  canceled: 'cancelada',
};

export default function AdminChatPage() {
  const [router, setRouter] = useState<RouterStatus | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [tasksNote, setTasksNote] = useState<string | null>(null);
  const [selected, setSelected] = useState<TaskDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<StreamNote>({});
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Estado do roteador (rotas GET retornam apenas scheme/host, sem segredos)
  useEffect(() => {
    fetch('/api/admin/chat')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setRouter(d))
      .catch(() => setRouter(null));
  }, []);

  // Fila: progresso real, auto-refresh a cada 5s (somente tarefas abertas)
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch('/api/admin/tasks?limit=100')
        .then(async (r) => {
          if (cancelled) return;
          if (r.status === 401) {
            setTasksNote('Acesso negado: esta pÃ¡gina exige papel admin/owner.');
            return;
          }
          if (r.status === 503) {
            const d = await r.json().catch(() => null);
            setTasksNote(
              d?.detail ??
                'Fila persistente indisponÃ­vel neste ambiente (migration 014 pendente).',
            );
            setTasks([]);
            return;
          }
          const d = await r.json();
          setTasks(
            Array.isArray(d?.items)
              ? (d.items as TaskItem[]).filter((t) =>
                  OPEN_STATUSES.includes(t.status),
                )
              : [],
          );
          setTasksNote(null);
        })
        .catch(() => {
          if (!cancelled) setTasksNote('Falha ao carregar a fila de tarefas.');
        });
    };
    load();
    const t = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const openTask = useCallback(async (id: string) => {
    const r = await fetch(`/api/admin/tasks/${id}`).catch(() => null);
    if (!r) return;
    if (r.status === 503) {
      const d = await r.json().catch(() => null);
      setTasksNote(d?.detail ?? 'Fila persistente indisponÃ­vel neste ambiente.');
      return;
    }
    if (!r.ok) return;
    const d = await r.json();
    if (d?.id) setSelected(d as TaskDetail);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setBusy(true);
    setNote({});
    setMessages((m) => [...m, { role: 'user', text }, { role: 'assistant', text: 'â³ processandoâ€¦' }]);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamChat(text, (ev) => {
        const t = ev.type as string;
        if (t === 'message') {
          setMessages((m) => {
            const copy = m.slice();
            const last = copy.length - 1;
            if (last >= 0 && copy[last].role === 'assistant' && copy[last].text.startsWith('â³')) {
              copy[last] = {
                role: 'assistant',
                text: String(ev.text ?? ''),
                model: ev.model ? String(ev.model) : undefined,
                usage: (ev.usage as Record<string, unknown> | undefined) ?? undefined,
              };
            } else {
              copy.push({
                role: 'assistant',
                text: String(ev.text ?? ''),
                model: ev.model ? String(ev.model) : undefined,
              });
            }
            return copy;
          });
        } else if (t === 'error') {
          const detail = String(ev.detail ?? ev.code ?? 'erro desconhecido');
          setMessages((m) => {
            const copy = m.slice();
            const last = copy.length - 1;
            if (last >= 0 && copy[last].role === 'assistant' && copy[last].text.startsWith('â³')) {
              copy[last] = { role: 'assistant', text: '', error: detail };
            } else {
              copy.push({ role: 'assistant', text: '', error: detail });
            }
            return copy;
          });
        } else if (t === 'warning') {
          setNote((s) => ({ ...s, warning: String(ev.detail ?? ev.code ?? '') }));
        } else if (t === 'task') {
          setNote((s) => ({
            ...s,
            taskId: ev.taskId as string | undefined,
            progress: 0,
            total: Array.isArray(ev.steps) ? ev.steps.length : undefined,
          }));
        } else if (t === 'progress') {
          setNote((s) => ({
            ...s,
            progress: Number(ev.pct ?? 0),
            total: ev.total != null ? Number(ev.total) : s.total,
          }));
        } else if (t === 'step') {
          setNote((s) => ({ ...s, step: String(ev.step ?? '') }));
        } else if (t === 'usage') {
          setMessages((m) => {
            const last = m.length - 1;
            if (last < 0 || m[last].role !== 'assistant' || m[last].error) return m;
            const copy = m.slice();
            copy[last] = { ...copy[last], usage: ev.usage as Record<string, unknown> };
            return copy;
          });
        }
      }, controller.signal);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: 'system',
          text: '',
          error: `Falha de rede: ${e instanceof Error ? e.message : String(e)}`,
        },
      ]);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const act = async (id: string, action: 'cancel' | 'resume') => {
    const r = await fetch(`/api/admin/tasks/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    }).catch(() => null);
    if (!r || r.status === 409 || r.status === 503) return;
    await openTask(id);
  };

  // Chat SEMPRE habilitado â€” o backend responde com mensagem informativa quando IA nÃ£o estÃ¡ configurada
  const chatDisabled = busy || !input.trim();

  return (
    <AppShell>
      <main className="min-h-screen p-4 sm:p-8 bg-[#05020A]">
        {/* CabeÃ§alho */}
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-6 max-w-6xl">
          <h1 className="text-2xl font-bold text-white">Centro Administrativo</h1>
          <p className="text-sm text-gray-500">
            {router === null ? (
              'verificando configuraÃ§Ã£oâ€¦'
            ) : router.routerConfigured ? (
              <>
                IA ativa Â· <span className="text-purple-400">{router.model}</span>
              </>
            ) : (
              <span className="text-amber-400">IA nÃ£o configurada â€” respostas informativas ativas</span>
            )}
          </p>
        </div>

        {/* Aviso quando IA nÃ£o estÃ¡ configurada */}
        {router !== null && !router.routerConfigured && (
          <div className="mb-4 max-w-6xl p-3 text-sm text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-lg">
            O mÃ³dulo de IA (OmniRouter) nÃ£o estÃ¡ configurado. As mensagens serÃ£o respondidas com
            informaÃ§Ãµes operacionais sobre o estado do sistema. Para habilitar IA real, defina{' '}
            <code className="text-purple-300">OMNIROUTER_BASE_URL</code> e{' '}
            <code className="text-purple-300">OMNIROUTER_API_KEY</code> no ambiente do servidor, ou
            configure uma chave manual em <a href="/admin/settings" className="underline">ConfiguraÃ§Ãµes</a>.
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_380px] max-w-6xl">
          {/* ---------------- Chat ---------------- */}
          <section className="p-4 sm:p-6 bg-[#0D0915] border border-white/10 rounded-2xl flex flex-col min-h-[480px]">
            <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
              Chat administrativo
            </h2>
            <div className="flex-1 overflow-y-auto max-h-[46vh] space-y-3 pr-1">
              {messages.length === 0 && (
                <p className="text-sm text-gray-500">
                  Descreva em linguagem natural o que vocÃª precisa (ex: &ldquo;liste os leads abertos&rdquo;,
                  &ldquo;o que mudou nesta fila?&rdquo;). O sistema responde com informaÃ§Ãµes reais sobre o
                  estado atual.
                </p>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`whitespace-pre-wrap text-sm rounded-lg p-3 ${
                    m.role === 'user'
                      ? 'ml-8 bg-purple-600/20 border border-purple-500/20 text-white'
                      : m.error
                        ? 'mr-8 bg-red-400/10 border border-red-400/20 text-red-300'
                        : 'mr-8 bg-white/5 border border-white/10 text-gray-200'
                  }`}
                >
                  {m.error ? `âš  ${m.error}` : m.text}
                  {m.model && <span className="block mt-1 text-xs text-gray-500">via {m.model}</span>}
                  {m.usage && (
                    <span className="block mt-1 text-xs text-gray-500">
                      tokens: {JSON.stringify(m.usage)}
                    </span>
                  )}
                </div>
              ))}
              {busy && note.progress !== undefined && (
                <div className="mr-8">
                  <div className="text-xs text-gray-400 mb-1">
                    progresso real {note.progress}%
                    {note.total != null ? ` (${note.progress >= 100 ? 'concluÃ­do' : 'em andamento'})` : ''}
                    {note.step ? ` Â· etapa: ${note.step}` : ''}
                    {note.taskId ? ` Â· tarefa ${note.taskId.slice(0, 8)}â€¦` : ''}
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 transition-all"
                      style={{ width: `${Math.min(note.progress, 100)}%` }}
                    />
                  </div>
                </div>
              )}
              {note.warning && (
                <div className="mr-8 text-xs text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded p-2">
                  {note.warning}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            <div className="mt-4 flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={2}
                placeholder="Descreva a tarefa em linguagem naturalâ€¦"
                className="flex-1 resize-none text-sm bg-white/5 border border-white/10 rounded-lg p-3 text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50"
              />
              <button
                onClick={() => void send()}
                disabled={chatDisabled}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-purple-600 text-white disabled:opacity-40 hover:bg-purple-700"
              >
                {busy ? 'â€¦' : 'Enviar'}
              </button>
            </div>
          </section>

          {/* ---------------- Tarefas (progresso real) ---------------- */}
          <section className="p-4 sm:p-6 bg-[#0D0915] border border-white/10 rounded-2xl">
            <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
              Tarefas abertas
            </h2>
            {tasksNote && <p className="text-xs text-amber-300 mb-2">{tasksNote}</p>}
            {tasks.length === 0 && !tasksNote && (
              <p className="text-sm text-gray-500">Nenhuma tarefa em andamento.</p>
            )}
            <ul className="space-y-3">
              {tasks.map((t) => (
                <li key={t.id} className="p-3 bg-white/5 border border-white/10 rounded-lg text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => void openTask(t.id)}
                      className="text-gray-200 hover:text-purple-300 text-left truncate flex-1"
                      title="ver detalhes"
                    >
                      {t.title}
                    </button>
                    <span
                      className={`text-xs font-medium shrink-0 ${statusColor[t.status] ?? 'text-gray-400'}`}
                    >
                      {statusLabel[t.status] ?? t.status}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${t.status === 'failed' ? 'bg-red-500' : 'bg-purple-500'}`}
                      style={{ width: `${Math.min(t.progress, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                    <span>
                      {t.progress}% real
                      {t.modelUsed ? ` Â· ${t.modelUsed}` : ''}
                    </span>
                    {t.status === 'waiting_human' && (
                      <button
                        onClick={() => void act(t.id, 'resume')}
                        className="text-purple-400 hover:underline"
                      >
                        retomar â†’
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {selected && (
              <div className="mt-4 p-3 bg-white/5 border border-white/10 rounded-lg text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-300 truncate">{selected.title}</span>
                  <span className={`text-xs shrink-0 ${statusColor[selected.status] ?? ''}`}>
                    {statusLabel[selected.status] ?? selected.status}
                  </span>
                </div>
                {selected.waitingReason && (
                  <p className="text-xs text-amber-300 mt-1">aguardando: {selected.waitingReason}</p>
                )}
                {selected.errorText && (
                  <p className="text-xs text-red-400 mt-1">{selected.errorText}</p>
                )}
                {selected.steps.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {selected.steps.map((s) => (
                      <li key={s.seq} className="flex items-center gap-2 text-xs text-gray-400">
                        <span
                          className={
                            s.status === 'done'
                              ? 'text-green-400'
                              : s.status === 'running'
                                ? 'text-sky-400'
                                : s.status === 'failed'
                                  ? 'text-red-400'
                                  : 'text-gray-600'
                          }
                        >
                          {s.status === 'done'
                            ? 'âœ”'
                            : s.status === 'running'
                              ? 'â–¶'
                              : s.status === 'failed'
                                ? 'âœ–'
                                : 'â—‹'}
                        </span>
                        {s.name}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-3 mt-3">
                  <button
                    onClick={() => void act(selected.id, 'cancel')}
                    className="text-xs text-red-400 hover:underline"
                  >
                    cancelar
                  </button>
                  {selected.status === 'waiting_human' && (
                    <button
                      onClick={() => void act(selected.id, 'resume')}
                      className="text-xs text-purple-400 hover:underline"
                    >
                      retomar
                    </button>
                  )}
                  <button
                    onClick={() => setSelected(null)}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    fechar
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </AppShell>
  );
}
