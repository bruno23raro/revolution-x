'use client';

// Memória de agentes — leitura/gravação do que os agentes aprendem (por tenant).
// GET /api/admin/memory lista; POST grava (upsert). Quando a tabela não existe
// neste ambiente a API responde 503 e a tela mostra o motivo em vez de fingir.

import AppNav from '@/components/AppNav';
import { useCallback, useEffect, useState } from 'react';

type MemoryKind = 'decision' | 'preference' | 'lesson' | 'fact';

interface MemoryItem {
  kind: MemoryKind;
  key: string;
  value: unknown;
  updatedAt: string;
}

const KINDS: MemoryKind[] = ['decision', 'preference', 'lesson', 'fact'];

const kindLabel: Record<MemoryKind, string> = {
  decision: 'decisão',
  preference: 'preferência',
  lesson: 'lição',
  fact: 'fato',
};

export default function AdminMemoryPage() {
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Formulário de novo registro
  const [kind, setKind] = useState<MemoryKind>('decision');
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setDenied(false);
    setUnavailable(null);
    setFetchError(null);
    try {
      const r = await fetch('/api/admin/memory?limit=200');
      if (r.status === 401) {
        setDenied(true);
        setItems([]);
      } else if (r.status === 503) {
        const d = await r.json().catch(() => null);
        setUnavailable(d?.detail ?? 'Memória persistente indisponível neste ambiente.');
        setItems([]);
      } else if (!r.ok) {
        setFetchError(`Falha ao carregar memórias (HTTP ${r.status}).`);
        setItems([]);
      } else {
        const d = await r.json();
        setItems(Array.isArray(d?.items) ? d.items : []);
      }
    } catch {
      setFetchError('Falha de rede ao carregar memórias.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveNote(null);
    let parsed: unknown = value.trim() ? value : null;
    if (value.trim()) {
      try {
        parsed = JSON.parse(value);
      } catch {
        parsed = value; // aceita texto simples; a API serializa
      }
    }
    try {
      const r = await fetch('/api/admin/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, key: key.trim(), value: parsed }),
      });
      const d = await r.json().catch(() => null);
      if (r.status === 201) {
        setSaveNote({ ok: true, text: `Memória "${key.trim()}" salva.` });
        setKey('');
        setValue('');
        await load();
      } else if (r.status === 401) {
        setDenied(true);
        setSaveNote({ ok: false, text: 'Acesso negado: exige papel admin/owner.' });
      } else if (r.status === 503) {
        setUnavailable(d?.detail ?? 'Memória persistente indisponível neste ambiente.');
      } else {
        setSaveNote({ ok: false, text: d?.error ?? `Falha ao salvar (HTTP ${r.status}).` });
      }
    } catch {
      setSaveNote({ ok: false, text: 'Falha de rede ao salvar.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AppNav />
      <main className="min-h-screen p-4 sm:p-8 bg-[#05020A]">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Memória de agentes</h1>
          <p className="text-sm text-gray-500">
            O que os agentes decidiram/aprenderam neste tenant. Escopo do seu usuário; impossível
            ler a memória de outra pessoa.
          </p>
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
          <p className="text-gray-400 text-sm">Carregando memórias…</p>
        ) : !denied && !unavailable && !fetchError && items.length === 0 ? (
          <p className="text-gray-500 text-sm mb-6">Nenhuma memória registrada ainda.</p>
        ) : null}

        {!loading && !denied && !unavailable && !fetchError && items.length > 0 && (
          <div className="max-w-3xl space-y-2 mb-8">
            {items.map((m) => (
              <div key={`${m.kind}:${m.key}`} className="p-3 bg-[#0D0915] border border-white/10 rounded-lg text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-200">{m.key}</span>
                  <span className="text-xs text-purple-300 shrink-0">{kindLabel[m.kind] ?? m.kind}</span>
                </div>
                <pre className="mt-1 text-xs text-gray-400 whitespace-pre-wrap break-words">{JSON.stringify(m.value)}</pre>
                <div className="mt-1 text-xs text-gray-600">
                  atualizado em {new Date(m.updatedAt).toLocaleString('pt-BR')}
                </div>
              </div>
            ))}
          </div>
        )}

        <section className="max-w-3xl p-4 sm:p-6 bg-[#0D0915] border border-white/10 rounded-2xl">
          <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
            Registrar memória
          </h2>
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-300">Tipo</label>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as MemoryKind)}
                  className="w-full px-4 py-2 bg-black/50 border border-white/10 rounded-lg text-white"
                >
                  {KINDS.map((k) => (
                    <option key={k} value={k} className="bg-[#0D0915]">
                      {kindLabel[k]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-300">Chave *</label>
                <input
                  required
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="ex.: preferencia-canal"
                  className="w-full px-4 py-2 bg-black/50 border border-white/10 rounded-lg text-white placeholder-gray-500"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-300">Valor (JSON ou texto)</label>
              <textarea
                rows={3}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder='ex.: {"canal":"whatsapp"} ou Um texto simples'
                className="w-full resize-y px-4 py-2 bg-black/50 border border-white/10 rounded-lg text-white placeholder-gray-500"
              />
            </div>
            {saveNote && (
              <div
                className={`p-3 text-sm rounded-lg border ${
                  saveNote.ok
                    ? 'text-green-400 bg-green-400/10 border-green-400/20'
                    : 'text-red-400 bg-red-400/10 border-red-400/20'
                }`}
              >
                {saveNote.text}
              </div>
            )}
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </form>
        </section>
      </main>
    </>
  );
}
