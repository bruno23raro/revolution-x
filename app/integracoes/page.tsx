'use client';

// Página principal de integrações — Grid responsivo com cards especializados.
import { useCallback, useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import WhatsAppApiCard from '@/components/integrations/WhatsAppApiCard';
import WhatsAppQrCard from '@/components/integrations/WhatsAppQrCard';
import InstagramCard from '@/components/integrations/InstagramCard';
import FacebookPagesCard from '@/components/integrations/FacebookPagesCard';
import type { IntegrationStatus } from '@/components/integrations/IntegrationCard';
import type { Channel } from '@/components/integrations/IntegrationCard';

interface IntegrationRow {
  id: string;
  channel: Channel;
  status: string;
  metaAccountId: string | null;
  metaAccountName: string | null;
  phoneNumber: string | null;
  wabaId: string | null;
  tokenExpiresAt: string | null;
  lastError: string | null;
}

interface StatusData {
  connected: boolean;
  integrations: IntegrationRow[];
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function IntegracoesPage() {
  const [status, setStatus] = useState<{ loading: boolean; error: string | null; data: StatusData | null }>({
    loading: true,
    error: null,
    data: null,
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [disconnectConfirm, setDisconnectConfirm] = useState<{ channel: string; id: string } | null>(null);

  const toast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const loadStatus = useCallback(async () => {
    setStatus({ loading: true, error: null, data: null });
    try {
      const r = await fetch('/api/integrations/status');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json() as StatusData;
      setStatus({ loading: false, error: null, data: d });
    } catch (e) {
      setStatus({
        loading: false,
        error: e instanceof Error ? e.message : 'Falha ao carregar integrações',
        data: null,
      });
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const getIntegrationForChannel = (channel: Channel): IntegrationRow | undefined => {
    return status.data?.integrations.find((i) => i.channel === channel);
  };

  const getStatusForChannel = (channel: Channel): IntegrationStatus => {
    const i = getIntegrationForChannel(channel);
    if (!i) return { connected: false };
    return {
      connected: i.status !== 'DISCONNECTED',
      error: i.lastError,
      accountRef: i.metaAccountId,
    };
  };

  const handleDisconnect = async (channel: string, id: string) => {
    setDisconnectConfirm(null);
    try {
      const r = await fetch('/api/integrations/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrationId: id }),
      });
      if (r.ok) {
        toast(`Integração ${channel} desconectada`, 'success');
        await loadStatus();
      } else {
        const d = await r.json().catch(() => ({ error: 'unknown' }));
        toast(d.error ?? 'Falha ao desconectar', 'error');
      }
    } catch {
      toast('Falha de rede ao desconectar', 'error');
    }
  };

  const handleConnected = (channel: string) => {
    toast(`${channel} conectado com sucesso!`, 'success');
    void loadStatus();
  };

  const renderDisconnectButton = (channel: Channel, row: IntegrationRow) => (
    <button
      onClick={() => setDisconnectConfirm({ channel, id: row.id })}
      className="mt-2 text-xs text-red-400 hover:text-red-300 underline"
    >
      Desconectar
    </button>
  );

  return (
    <AppShell>
      <main className="min-h-screen bg-[#05020A] p-4 sm:p-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">Integrações</h1>
            <p className="text-sm text-gray-400 mt-1">
              Conecte suas contas Meta, Instagram e Facebook para automação de marketing.
            </p>
          </div>

          {/* Toasts */}
          <div className="fixed bottom-4 right-4 z-50 space-y-2">
            {toasts.map((t) => (
              <div
                key={t.id}
                className={`px-4 py-2 rounded-lg text-sm shadow-lg ${
                  t.type === 'success'
                    ? 'bg-green-600 text-white'
                    : t.type === 'error'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-800 text-gray-200 border border-white/10'
                }`}
              >
                {t.message}
              </div>
            ))}
          </div>

          {/* Disconnect confirmation modal */}
          {disconnectConfirm && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
              <div className="bg-[#0D0915] border border-white/10 rounded-xl p-6 max-w-sm mx-4">
                <h3 className="text-white font-semibold mb-2">Confirmar desconexão</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Tem certeza que deseja desconectar o {disconnectConfirm.channel}?
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setDisconnectConfirm(null)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-white/15 text-gray-300 hover:bg-white/5"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => void handleDisconnect(disconnectConfirm.channel, disconnectConfirm.id)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </div>
          )}

          {status.loading ? (
            <div className="text-gray-400 text-sm">Carregando integrações…</div>
          ) : status.error ? (
            <div className="p-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">
              {status.error}
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4 auto-rows-fr">
              <WhatsAppApiCard
                status={getStatusForChannel('whatsapp')}
                onConnected={() => handleConnected('whatsapp')}
                onDisconnect={
                  getIntegrationForChannel('whatsapp')
                    ? () => setDisconnectConfirm({ channel: 'whatsapp', id: getIntegrationForChannel('whatsapp')!.id })
                    : undefined
                }
              />
              <InstagramCard
                status={getStatusForChannel('instagram')}
                onConnected={() => handleConnected('instagram')}
                onDisconnect={
                  getIntegrationForChannel('instagram')
                    ? () => setDisconnectConfirm({ channel: 'instagram', id: getIntegrationForChannel('instagram')!.id })
                    : undefined
                }
              />
              <FacebookPagesCard
                status={getStatusForChannel('facebook')}
                onConnected={() => handleConnected('facebook')}
                onDisconnect={
                  getIntegrationForChannel('facebook')
                    ? () => setDisconnectConfirm({ channel: 'facebook', id: getIntegrationForChannel('facebook')!.id })
                    : undefined
                }
              />
              <WhatsAppQrCard />
            </div>
          )}

          {/* Token info */}
          {(status.data?.integrations?.length ?? 0) > 0 && (
            <section className="mt-8">
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-300 mb-3">
                Integrações ativas
              </h2>
              <div className="space-y-2">
                {(status.data?.integrations ?? []).map((i) => (
                  <div
                    key={i.id}
                    className="p-3 bg-[#0D0915] border border-white/10 rounded-xl text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white capitalize">{i.channel}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                        i.status === 'DISCONNECTED'
                          ? 'bg-red-400/10 text-red-400'
                          : 'bg-green-400/10 text-green-400'
                      }`}>
                        {i.status}
                      </span>
                    </div>
                    <div className="mt-1 text-gray-400 grid grid-cols-2 gap-x-4 gap-y-1">
                      {i.metaAccountName && (
                        <>
                          <span className="text-gray-500">Conta:</span>
                          <span className="text-gray-300 truncate" title={i.metaAccountName}>{i.metaAccountName}</span>
                        </>
                      )}
                      {i.phoneNumber && (
                        <>
                          <span className="text-gray-500">Fone:</span>
                          <span className="text-gray-300 truncate" title={i.phoneNumber}>{i.phoneNumber}</span>
                        </>
                      )}
                      {i.wabaId && (
                        <>
                          <span className="text-gray-500">WABA:</span>
                          <span className="text-gray-300">{i.wabaId}</span>
                        </>
                      )}
                      {i.tokenExpiresAt && (
                        <>
                          <span className="text-gray-500">Expira:</span>
                          <span className="text-gray-300">
                            {new Date(i.tokenExpiresAt).toLocaleDateString('pt-BR')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </AppShell>
  );
}
