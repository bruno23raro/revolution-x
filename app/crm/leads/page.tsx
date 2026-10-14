'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type Lead = { id: string; status?: string; source?: string; createdAt?: string };

const STATUSES = ['new', 'contacted', 'qualified', 'lost'];

export default function LeadsPage() {
  const [items, setItems] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  const [source, setSource] = useState('');
  const [status, setStatus] = useState('new');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/crm/leads');
      const data = await res.json();
      if (res.status === 401) {
        setUnauthorized(true);
        return;
      }
      if (!res.ok) throw new Error('Falha ao carregar leads');
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
      const res = await fetch('/api/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: source || 'organic', status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao criar lead');
      setSource('');
      setStatus('new');
      await load();
    } catch (err: any) {
      setFormError(err.message === 'invalid_status' ? 'Status inválido.' : err.message);
    } finally {
      setSaving(false);
    }
  };

  if (unauthorized) {
    return (
      <main className="min-h-screen p-8 bg-[#05020A]">
        <Link href="/crm" className="text-sm text-purple-400">← Voltar ao CRM</Link>
        <div className="p-3 text-sm text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg mt-4">
          Faça login para ver os leads da sua organização. <Link href="/login" className="text-purple-400">Entrar</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 bg-[#05020A]">
      <Link href="/crm" className="text-sm text-purple-400">← Voltar ao CRM</Link>
      <h1 className="text-2xl font-bold text-white mb-6 mt-4">Leads</h1>

      {loading ? (
        <p className="text-gray-400">Carregando…</p>
      ) : error ? (
        <div className="p-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">{error}</div>
      ) : items.length === 0 ? (
        <p className="text-gray-500">Nenhum lead ainda.</p>
      ) : (
        <div className="overflow-x-auto border border-white/10 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-[#0D0915] text-gray-400">
              <tr>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Fonte</th>
              </tr>
            </thead>
            <tbody className="text-gray-200">
              {items.map((l) => (
                <tr key={l.id} className="border-t border-white/5">
                  <td className="p-3"><span className="text-purple-300">{l.status ?? '—'}</span></td>
                  <td className="p-3">{l.source ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="mt-8 max-w-lg">
        <h2 className="text-lg font-semibold text-white mb-4">Novo lead</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-300">Fonte</label>
            <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="organic" className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-300">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              {STATUSES.map((s) => (
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
  );
}

const inputCls =
  'w-full px-4 py-2 bg-black/50 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-500';
