'use client';

// Tarefas — fila persistente de agentes (progresso REAL, sem simulação).
// Lê /api/admin/tasks e /api/admin/tasks/[id]. Quando a fila não existe neste
// ambiente (migration 014 pendente) a API responde 503 e a tela mostra o motivo
// exato em vez de inventar dados.

import AppShell from '@/components/AppShell';
import { useCallback, useEffect, useState } from 'react';

type TaskStatus =
  | 'queued'
  | 'running'
  | 'waiting_human'
  | 'completed'
  | 'failed'
  | 'canceled';

interface TaskSummary {
  id: string;
  title: string;
  status: TaskStatus;
  progress: number;
  modelUsed: string | null;
  errorText: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface TaskDetail extends TaskSummary {
  waitingReason: string | null;
  inputJson: unknown;
  resultJson: unknown;
  usageJson: unknown;
  steps: Array<{ seq: number; name: string; status: string }>;
  events: Array<{ type: string; payload: unknown; at: string }>;
}

const FILTERS: Array<{ value: TaskStatus | ''; label: string }> = [
  { value: '', label: 'todas' },
  { value: 'queued', label: 'na fila' },
  { value: 'running', label: 'em execução' },
  { value: 'waiting_human', label: 'aguardando humano' },
  { value: 'completed', label: 'concluída' },
  { value: 'failed', label: 'falhou' },
  { value: 'canceled', label: 'cancelada' },
];

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
  running: 'em execução',
  waiting_human: 'aguardando humano',
  completed: 'concluída',
  failed: 'falhou',
  canceled: 'cancelada',
};

export default function AdminTasksPage() {
  const [items, setItems] = useState<TaskSummary[]>([]);
  const [filter, setFilter] = useState<TaskStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<TaskDetail | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setDenied(false);
    setUnavailable(null);
    setFetchError(null);
    const q = filter ? `?status=${filter}&limit=200` : '?limit=200';
    try {
      const r = await fetch(`/api/admin/tasks${q}`);
      if (r.status === 401) {
        setDenied(true);
        setItems([]);
      } else if (r.status === 503) {
        const d = await r.json().catch(() => null);
        setUnavailable(d?.detail ?? 'Fila persistente indisponível neste ambiente.');
        setItems([]);
      } else if (!r.ok) {
        setFetchError(`Falha ao carregar tarefas (HTTP ${r.status}).`);
        setItems([]);
      } else {
        const d = await r.json();
        setItems(Array.isArray(d?.items) ? d.items : []);
      }
    } catch {
      setFetchError('Falha de rede ao carregar a fila de tarefas.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const open = async (id: string) => {
    const r = await fetch(`/api/admin/tasks/${id}`).catch(() => null);
    if (!r) return;
    if (r.status === 503) {
      const d = await r.json().catch(() => null);
      setUnavailable(d?.detail ?? 'Fila persistente indisponível neste ambiente.');
      return;
    }
    if (!r.ok) return;
    const d = await r.json();
    if (d?.id) setSelected(d as TaskDetail);
  };

  return (
    <AppShell>
      <main className="min-h-screen p-4 sm:p-8 bg-[#05020A]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Tarefas</h1>
            <p className="text-sm text-gray-500">
              Fila persistente de tarefas de agentes — progresso real, isolado por tenant.
            </p>
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as TaskStatus | '')}
            className="px-3 py-2 text-sm bg-[#0D0915] border border-white/10 rounded-lg text-gray-200"
          >
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value} className="bg-[#0D0915]">
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {denied && (
          <div className="mb-4 p-3 text-sm text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-lg">
            Acesso negado: esta página exige papel admin/owner.
          </div>
        )}
        {unavailable && (
          <div className="mb-4 p-3 text-sm text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-lg">
            {unavailable}
          </div>
        )}
        {fetchError && (
          <div className="mb-4 p-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">
            {fetchError}
          </div>
        )}

        {loading ? (
          <p className="text-gray-400 text-sm">Carregando tarefas…</p>
        ) : !denied && !unavailable && !fetchError && items.length === 0 ? (
          <p className="text-gray-500 text-sm">Nenhuma tarefa registrada{filter ? ` para "${statusLabel[filter]}"` : ''}.</p>
        ) : (
          <ul className="space-y-3 max-w-3xl">
            {items.map((t) => (
              <li key={t.id} className="p-4 bg-[#0D0915] border border-white/10 rounded-xl text-sm">
                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={() => void open(t.id)}
                    className="text-gray-200 hover:text-purple-300 text-left flex-1 truncate"
                  >
                    {t.title}
                  </button>
                  <span className={`text-xs font-medium shrink-0 ${statusColor[t.status] ?? 'text-gray-400'}`}>
                    {statusLabel[t.status] ?? t.status}
                  </span>
                </div>
                <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${t.status === 'failed' ? 'bg-red-500' : 'bg-purple-500'}`}
                    style={{ width: `${Math.min(t.progress, 100)}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {t.progress}%{t.modelUsed ? ` · ${t.modelUsed}` : ''}
                  {t.completedAt ? ` · concluída em ${new Date(t.completedAt).toLocaleString('pt-BR')}` : ''}
                </div>
              </li>
            ))}
          </ul>
        )}

        {selected && (
          <div className="mt-6 p-4 bg-[#0D0915] border border-white/10 rounded-xl text-sm max-w-3xl">
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="text-gray-200 truncate">{selected.title}</span>
              <span className={`text-xs shrink-0 ${statusColor[selected.status] ?? ''}`}>
                {statusLabel[selected.status] ?? selected.status}
              </span>
            </div>
            {selected.waitingReason && (
              <p className="text-xs text-amber-300">aguardando: {selected.waitingReason}</p>
            )}
            {selected.errorText && <p className="text-xs text-red-400 mt-1">{selected.errorText}</p>}
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
                      {s.status === 'done' ? '✔' : s.status === 'running' ? '▶' : s.status === 'failed' ? '✖' : '○'}
                    </span>
                    {s.name}
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={() => setSelected(null)}
              className="mt-3 text-xs text-gray-500 hover:text-gray-300"
            >
              fechar detalhes
            </button>
          </div>
        )}
      </main>
    </AppShell>
  );
}
