'use client';

// Integrações — status real das integrações conectadas neste tenant.
// Hoje o backend expõe apenas Meta (paginas/Instagram/WhatsApp). Mostra só o que
// a API devolve (sem campos sensíveis: tokens e chaves nunca aparecem).

import AppNav from '@/components/AppNav';
import { useCallback, useEffect, useState } from 'react';

interface MetaIntegration {
  provider: string;
  metaPageId: string | null;
  instagramAccountId: string | null;
  whatsappBusinessAccountId: string | null;
  phoneNumberId: string | null;
  tokenExpiresAt: string | null;
  connectedAt: string | null;
  disconnectedAt: string | null;
  status: string | null;
  lastError: string | null;
}

export default function IntegrationsPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [integrations, setIntegrations] = useState<MetaIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setDenied(false);
    setError(null);
    try {
      const r = await fetch('/api/integrations/meta');
      if (r.status === 401) {
        setDenied(true);
        setConnected(false);
        setIntegrations([]);
      } else if (!r.ok) {
        setError(`Falha ao carregar integrações (HTTP ${r.status}).`);
        setConnected(null);
        setIntegrations([]);
      } else {
        const d = await r.json();
        setConnected(Boolean(d?.connected));
        setIntegrations(Array.isArray(d?.integrations) ? d.integrations : []);
      }
    } catch {
      setError('Falha de rede ao carregar integrações.');
      setConnected(null);
      setIntegrations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const disconnect = async (provider: string) => {
    if (!window.confirm(`Desconectar a integração ${provider}?`)) return;
    setDisconnecting(true);
    setNote(null);
    try {
      const r = await fetch(`/api/integrations/meta?provider=${encodeURIComponent(provider)}`, {
        method: 'DELETE',
      });
      if (r.ok) {
        setNote(`Integração ${provider} desconectada.`);
        await load();
      } else {
        setNote(`Falha ao desconectar (HTTP ${r.status}).`);
      }
    } catch {
      setNote('Falha de rede ao desconectar.');
    } finally {
      setDisconnecting(false);
    }
  };

  const providerLabel = (p: string) => {
    switch (p) {
      case 'meta':
        return 'Meta (Facebook)';
      case 'instagram':
        return 'Instagram';
      case 'whatsapp':
        return 'WhatsApp Business';
      default:
        return p;
    }
  };

  const hasAnyData = integrations.some(
    (i) => i.metaPageId || i.instagramAccountId || i.whatsappBusinessAccountId || i.phoneNumberId,
  );

  return (
    <>
      <AppNav />
      <main className="min-h-screen p-4 sm:p-8 bg-[#05020A]">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Integrações</h1>
          <p className="text-sm text-gray-500">
            Status real das integrações do seu tenant. Nenhum token ou chave é exibido.
          </p>
        </div>

        {denied && (
          <div className="mb-4 p-3 text-sm text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-lg">
            Faça login para ver as integrações da sua organização.
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">
            {error}
          </div>
        )}
        {note && (
          <div className="mb-4 p-3 text-sm text-green-400 bg-green-400/10 border border-green-400/20 rounded-lg">
            {note}
          </div>
        )}

        {loading ? (
          <p className="text-gray-400 text-sm">Carregando integrações…</p>
        ) : !denied && connected === false && integrations.length === 0 ? (
          <div className="p-4 bg-[#0D0915] border border-white/10 rounded-2xl text-sm text-gray-400 max-w-2xl">
            Nenhuma integração conectada ainda.
            <p className="text-xs text-gray-600 mt-2">
              O backend atual expõe a integração Meta (página do Facebook, Instagram e WhatsApp
              Business). Quando conectada, o status aparece aqui.
            </p>
          </div>
        ) : !denied && !error && integrations.length > 0 ? (
          <div className="space-y-4 max-w-2xl">
            {integrations.map((i, idx) => (
              <div key={idx} className="p-4 bg-[#0D0915] border border-white/10 rounded-2xl text-sm">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="text-gray-200 font-semibold">{providerLabel(i.provider)}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${
                      i.status === 'DISCONNECTED'
                        ? 'text-gray-400 border-white/10'
                        : 'text-green-400 border-green-400/20 bg-green-400/5'
                    }`}
                  >
                    {i.status ?? '—'}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <dt className="text-gray-500">Página Meta</dt>
                  <dd className="text-gray-300 truncate" title={i.metaPageId ?? undefined}>
                    {i.metaPageId ?? '—'}
                  </dd>
                  <dt className="text-gray-500">Instagram</dt>
                  <dd className="text-gray-300 truncate" title={i.instagramAccountId ?? undefined}>
                    {i.instagramAccountId ?? '—'}
                  </dd>
                  <dt className="text-gray-500">WhatsApp Business</dt>
                  <dd className="text-gray-300 truncate" title={i.whatsappBusinessAccountId ?? undefined}>
                    {i.whatsappBusinessAccountId ?? '—'}
                  </dd>
                  <dt className="text-gray-500">Nº. de telefone</dt>
                  <dd className="text-gray-300 truncate" title={i.phoneNumberId ?? undefined}>
                    {i.phoneNumberId ?? '—'}
                  </dd>
                  <dt className="text-gray-500">Token expira</dt>
                  <dd className="text-gray-300">
                    {i.tokenExpiresAt ? new Date(i.tokenExpiresAt).toLocaleString('pt-BR') : '—'}
                  </dd>
                </dl>
                {i.lastError && (
                  <p className="mt-2 text-xs text-red-400">último erro: {i.lastError}</p>
                )}
                {hasAnyData && i.status !== 'DISCONNECTED' && (
                  <button
                    onClick={() => void disconnect(i.provider)}
                    disabled={disconnecting}
                    className="mt-3 px-3 py-1.5 text-xs font-semibold text-red-400 border border-red-400/30 rounded-lg hover:bg-red-400/10 disabled:opacity-50"
                  >
                    {disconnecting ? 'Desconectando…' : 'Desconectar'}
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          !loading && !denied && !error && connected !== false && <p className="text-gray-500 text-sm">Sem integrações.</p>
        )}
      </main>
    </>
  );
}
