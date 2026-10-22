'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';

interface Pipeline {
  id: string;
  name: string;
  stages: string[];
  createdAt?: string;
}

export default function PipelinesPage() {
  const [items, setItems] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  const [name, setName] = useState('');
  const [stagesInput, setStagesInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/crm/pipelines');
      const data = await res.json();
      if (res.status === 401) {
        setUnauthorized(true);
        return;
      }
      if (!res.ok) throw new Error('Falha ao carregar pipelines');
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
    setSuccess(null);
    try {
      const stages = stagesInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch('/api/crm/pipelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, stages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao criar pipeline');
      setName('');
      setStagesInput('');
      setSuccess('Pipeline criado com sucesso!');
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
          <Link href="/crm" className="text-sm text-purple-400">â† Voltar ao CRM</Link>
          <div className="p-3 text-sm text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg mt-4">
            FaÃ§a login para ver os pipelines da sua organizaÃ§Ã£o.{' '}
            <Link href="/login" className="text-purple-400">Entrar</Link>
          </div>
        </main>
      </AppShell>
    );
  }

  const inputCls =
    'w-full px-4 py-2 bg-black/50 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-500';

  return (
    <AppShell>
      <main className="min-h-screen p-4 sm:p-8 bg-[#05020A]">
        <Link href="/crm" className="text-sm text-purple-400">â† Voltar ao CRM</Link>
        <h1 className="text-2xl font-bold text-white mb-6 mt-4">Pipelines</h1>

        {loading ? (
          <p className="text-gray-400">Carregandoâ€¦</p>
        ) : error ? (
          <div className="p-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">{error}</div>
        ) : items.length === 0 ? (
          <p className="text-gray-500">Nenhum pipeline ainda. Crie um abaixo.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <div key={p.id} className="p-4 bg-[#0D0915] border border-white/10 rounded-xl">
                <h3 className="text-white font-semibold mb-2">{p.name}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {p.stages.length > 0 ? (
                    p.stages.map((stage, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30"
                      >
                        {stage}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-500">Sem etapas definidas</span>
                  )}
                </div>
                {p.createdAt && (
                  <p className="text-xs text-gray-600 mt-2">
                    Criado em {new Date(p.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <section className="mt-8 max-w-lg">
          <h2 className="text-lg font-semibold text-white mb-4">Novo pipeline</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-300">Nome *</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Vendas B2B"
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-300">
                Etapas <span className="text-gray-500">(separadas por vÃ­rgula)</span>
              </label>
              <input
                value={stagesInput}
                onChange={(e) => setStagesInput(e.target.value)}
                placeholder="ProspecÃ§Ã£o, Proposta, NegociaÃ§Ã£o, Fechamento"
                className={inputCls}
              />
              <p className="text-xs text-gray-600">
                Ex: ProspecÃ§Ã£o, Proposta, NegociaÃ§Ã£o, Fechamento
              </p>
            </div>
            {formError && (
              <div className="p-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">
                {formError}
              </div>
            )}
            {success && (
              <div className="p-3 text-sm text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-lg">
                {success}
              </div>
            )}
            <button
              type="submit"
              disabled={saving}
              className="py-2 px-4 font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? 'Salvandoâ€¦' : 'Adicionar'}
            </button>
          </form>
        </section>
      </main>
    </AppShell>
  );
}
