'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';

type Deal = { id: string; title: string; value: number | string; stage: string; createdAt?: string };

const STAGES = ['prospecting', 'proposal', 'negotiation', 'won', 'lost'];

export default function DealsPage() {
  const [items, setItems] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [stage, setStage] = useState('prospecting');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/crm/deals');
      const data = await res.json();
      if (res.status === 401) {
        setUnauthorized(true);
        return;
      }
      if (!res.ok) throw new Error('Falha ao carregar deals');
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e: any) {
      setError(e.message || 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch('/api/crm/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, value: value === '' ? 0 : Number(value), stage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao criar deal');
      setTitle('');
      setValue('');
      setStage('prospecting');
      await load();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (unauthorized) {
    return (
      <AppShell>
      <main className="min-h-screen p-8 bg-[#05020A]">
        <Link href="/crm" className="text-sm text-purple-400">← Voltar ao CRM</Link>
        <div className="p-3 text-sm text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg mt-4">
          Faça login para ver os deals da sua organização. <Link href="/login" className="text-purple-400">Entrar</Link>
        </div>
      </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
    <main className="min-h-screen p-8 bg-[#05020A]">
      <Link href="/crm" className="text-sm text-purple-400">← Voltar ao CRM</Link>
      <h1 className="text-2xl font-bold text-white mb-6 mt-4">Deals</h1>

      {loading ? (
        <p className="text-gray-400">Carregando…</p>
      ) : error ? (
        <div className="p-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">{error}</div>
      ) : items.length === 0 ? (
        <p className="text-gray-500">Nenhum deal ainda.</p>
      ) : (
        <div className="overflow-x-auto border border-white/10 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-[#0D0915] text-gray-400">
              <tr>
                <th className="text-left p-3">Título</th>
                <th className="text-left p-3">Valor</th>
                <th className="text-left p-3">Etapa</th>
              </tr>
            </thead>
            <tbody className="text-gray-200">
              {items.map((d) => (
                <tr key={d.id} className="border-t border-white/5">
                  <td className="p-3">{d.title}</td>
                  <td className="p-3">{d.value}</td>
                  <td className="p-3"><span className="text-purple-300">{d.stage}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="mt-8 max-w-lg">
        <h2 className="text-lg font-semibold text-white mb-4">Novo deal</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-300">Título *</label>
            <input required value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-300">Valor</label>
            <input type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-300">Etapa</label>
            <select value={stage} onChange={(e) => setStage(e.target.value)} className={inputCls}>
              {STAGES.map((s) => (
                <option key={s} value={s} className="bg-[#0D0915]">{s}</option>
              ))}
            </select>
          </div>
          {formError && <div className="p-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">{formError}</div>}
          <button type="submit" disabled={saving} className="py-2 px-4 font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50">
            {saving ? 'Salvando…' : 'Adicionar'}
          </button>
        </form>
      </section>
    </main>
    </AppShell>
  );
}

const inputCls =
  'w-full px-4 py-2 bg-black/50 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-500';
