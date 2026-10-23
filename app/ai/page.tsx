'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';

type Provider = {
  id: string;
  name: string;
  configured: boolean;
  models: Array<{
    id: string;
    name?: string;
    contextWindow?: number;
    capabilities?: string[];
  }>;
  cachedAt: number;
  source: 'api' | 'fallback' | 'none';
  stale: boolean;
};

type Auto = { enabled: boolean; strategy: string };

export default function AiModelsPage() {
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [auto, setAuto] = useState<Auto | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [test, setTest] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/models');
      if (res.status === 401) {
        setUnauthorized(true);
        return;
      }
      const data = await res.json();
      setProviders(data.providers ?? []);
      setAuto(data.auto ?? null);
    } catch {
      setProviders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function quickTest() {
    setTest('Testando…');
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: 'Diga "ok" em uma palavra.' }),
      });
      const data = await res.json();
      if (!data.ok) {
        setTest(`Bloqueado: ${data.error}`);
        return;
      }
      setTest(`OK — provedor ${data.provider} / modelo ${data.model}`);
    } catch {
      setTest('Falha de rede no teste.');
    }
  }

  if (unauthorized) {
    return (
      <AppShell>
        <p className="p-6">Você não tem permissão para ver esta área.</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">IA e modelos</h1>
        <button
          onClick={quickTest}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500"
        >
          Teste rápido
        </button>
      </div>
      {test && <p className="mt-3 text-sm text-slate-300">{test}</p>}

      {loading ? (
        <p className="mt-6 text-slate-400">Carregando…</p>
      ) : providers ? (
        <div className="mt-6 space-y-4">
          {providers.map((p) => (
            <div key={p.id} className="rounded-lg border border-slate-700 p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">
                  {p.name}
                  <span className="ml-2 text-xs text-slate-400">({p.id})</span>
                </h2>
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    p.configured
                      ? 'bg-green-900/40 text-green-300'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {p.configured ? 'configurado' : 'não configurado'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                source: {p.source}
                {p.stale && ' · cache expirado (revalidando)'}
              </p>
              {p.models.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">
                  Nenhum modelo disponível{p.configured ? ' — descoberta degenerou' : ''}.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-800 text-sm">
                  {p.models.map((m) => (
                    <li key={m.id} className="flex items-center justify-between py-1">
                      <span>
                        <code className="text-slate-200">{m.id}</code>
                        {m.name && m.name !== m.id ? (
                          <span className="ml-2 text-slate-400">({m.name})</span>
                        ) : null}
                      </span>
                      <span className="text-xs text-slate-400">
                        {m.contextWindow ? `${m.contextWindow.toLocaleString()} tok` : 'ctx ?'}
                        {m.capabilities?.length ? ` · ${m.capabilities.join(', ')}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          {auto && (
            <div className="rounded-lg border border-slate-700 p-4 text-sm">
              <h2 className="font-medium">Auto-modo</h2>
              <p className="mt-1 text-slate-300">{auto.strategy}</p>
              <p className="mt-2 text-xs text-slate-400">
                Quando você não escolhe um modelo, o sistema filtra por capacidade
                e calibra pela janela de contexto — nunca é &quot;o maior ou mais
                recente&quot;. Escolha manual em{' '}
                <Link href="/admin/chat" className="text-blue-400 underline">
                  /admin/chat
                </Link>{' '}
                ou via <code>/api/ai/generate</code>.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
    </AppShell>
  );
}