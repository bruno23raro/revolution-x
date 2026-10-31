'use client';

// Página principal de integrações — filtro "API Oficial | Sem API" (modo OFFICIAL|MANUAL),
// multi-conta por canal com "Remover Conta" em cada linha.
import { useCallback, useState } from 'react';
import AppShell from '@/components/AppShell';
import WhatsAppApiCard from '@/components/integrations/WhatsAppApiCard';
import WhatsAppQrCard from '@/components/integrations/WhatsAppQrCard';
import WhatsAppOfficialCard from '@/components/integrations/WhatsAppOfficialCard';
import InstagramCard from '@/components/integrations/InstagramCard';
import FacebookPagesCard from '@/components/integrations/FacebookPagesCard';
import ManualAccountsCard from '@/components/integrations/ManualAccountsCard';
import type { AccountRow as CardAccountRow, IntegrationStatus } from '@/components/integrations/IntegrationCard';
import { useIntegrationAccounts, type AccountRow } from '@/hooks/useIntegrationAccounts';

type Mode = 'OFFICIAL' | 'MANUAL';
type Channel = 'whatsapp' | 'instagram' | 'facebook';

// shortcut: espelha MANUAL_WHATSAPP_MAX do servidor (src/integrations/manual.ts);
// upgrade quando /api/integrations/status expuser o limite no payload.
const WHATSAPP_MANUAL_MAX = 5;

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function IntegracoesPage() {
  const { loading, error, data, reload } = useIntegrationAccounts();
  const [view, setView] = useState<Mode>('OFFICIAL');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [removeConfirm, setRemoveConfirm] = useState<{ label: string; id: string } | null>(null);

  const toast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const accounts = (data?.integrations ?? []).filter((a) => a.mode === view);

  const forChannel = useCallback(
    (channel: Channel) => accounts.filter((a) => a.channel === channel),
    [accounts],
  );

  const statusFor = useCallback(
    (channel: Channel): IntegrationStatus => {
      const rows = forChannel(channel);
      const active = rows.find((a) => a.status !== 'DISCONNECTED');
      if (!active) return { connected: false };
      return { connected: true, error: active.lastError, accountRef: active.metaAccountId };
    },
    [forChannel],
  );

  const cardAccounts = useCallback(
    (channel: Channel): CardAccountRow[] =>
      forChannel(channel).map((a) => ({
        id: a.id,
        status: a.status,
        metaAccountId: a.metaAccountId,
        label: a.label ?? a.metaAccountName,
        createdAt: a.createdAt,
      })),
    [forChannel],
  );

  const handleRemove = async (id: string) => {
    setRemoveConfirm(null);
    try {
      const r = await fetch('/api/integrations/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrationId: id }),
      });
      if (r.ok) {
        toast('Conta removida', 'success');
        await reload();
      } else {
        const d = await r.json().catch(() => ({ error: 'unknown' }));
        toast(d.error ?? 'Falha ao remover conta', 'error');
      }
    } catch {
      toast('Falha de rede ao remover', 'error');
    }
  };

  const handleConnected = (channel: string) => {
    toast(`${channel} conectado com sucesso!`, 'success');
    void reload();
  };

  const askRemove = (a: AccountRow) =>
    setRemoveConfirm({ label: a.label ?? a.metaAccountName ?? a.channel, id: a.id });

  const whatsappManualUsed = (data?.integrations ?? []).filter(
    (a) => a.mode === 'MANUAL' && a.channel === 'whatsapp',
  ).length;

  const manualByChannel = (channel: Channel) =>
    forChannel(channel).map((a) => (
      <div
        key={a.id}
        className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#0D0915] border border-amber-500/20"
      >
        <div className="min-w-0">
          <div className="text-xs text-white truncate">
            {a.label ?? a.metaAccountName ?? 'Conta sem apelido'}
            {a.metaAccountId && (
              <span className="font-mono text-gray-500 ml-1">••••{a.metaAccountId.slice(-4)}</span>
            )}
          </div>
          <div className="text-[10px] text-gray-500">
            {a.status} · {new Date(a.createdAt).toLocaleDateString('pt-BR')}
            {a.lastError ? ` · ${a.lastError}` : ''}
          </div>
        </div>
        <button
          onClick={() => askRemove(a)}
          className="shrink-0 px-2 py-1 text-[10px] font-semibold rounded-md border border-red-400/30 text-red-400 hover:bg-red-400/10"
        >
          Remover Conta
        </button>
      </div>
    ));

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

          {/* Toggle Ver: API Oficial | Ver: Sem API */}
          <div className="mb-6 inline-flex rounded-lg border border-white/10 p-1 bg-[#0D0915]">
            <button
              onClick={() => setView('OFFICIAL')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                view === 'OFFICIAL' ? 'bg-purple-500/20 text-purple-300' : 'text-gray-400 hover:text-white'
              }`}
            >
              Ver: API Oficial
            </button>
            <button
              onClick={() => setView('MANUAL')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                view === 'MANUAL' ? 'bg-amber-500/20 text-amber-300' : 'text-gray-400 hover:text-white'
              }`}
            >
              Ver: Sem API
            </button>
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

          {/* Confirmação de remoção */}
          {removeConfirm && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
              <div className="bg-[#0D0915] border border-white/10 rounded-xl p-6 max-w-sm mx-4">
                <h3 className="text-white font-semibold mb-2">Remover conta</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Remover a conta &ldquo;{removeConfirm.label}&rdquo;?
                  {view === 'MANUAL' && ' A sessão salva será apagada do banco.'}
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setRemoveConfirm(null)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-white/15 text-gray-300 hover:bg-white/5"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => void handleRemove(removeConfirm.id)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700"
                  >
                    Remover Conta
                  </button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-gray-400 text-sm">Carregando integrações…</div>
          ) : error ? (
            <div className="p-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">
              {error}
            </div>
          ) : view === 'OFFICIAL' ? (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                <h2 className="text-sm font-bold uppercase tracking-wide text-purple-400">
                  API Oficial
                </h2>
                <span className="text-[10px] text-gray-500">OAuth · API oficial · Sem risco · Multi-conta</span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4 auto-rows-fr">
                <WhatsAppApiCard
                  status={statusFor('whatsapp')}
                  onConnected={() => handleConnected('whatsapp')}
                  accounts={cardAccounts('whatsapp')}
                  onRemoveAccount={(id) => {
                    const a = forChannel('whatsapp').find((x) => x.id === id);
                    if (a) askRemove(a);
                  }}
                />
                <InstagramCard
                  status={statusFor('instagram')}
                  onConnected={() => handleConnected('instagram')}
                  accounts={cardAccounts('instagram')}
                  onRemoveAccount={(id) => {
                    const a = forChannel('instagram').find((x) => x.id === id);
                    if (a) askRemove(a);
                  }}
                />
                <FacebookPagesCard
                  status={statusFor('facebook')}
                  onConnected={() => handleConnected('facebook')}
                  accounts={cardAccounts('facebook')}
                  onRemoveAccount={(id) => {
                    const a = forChannel('facebook').find((x) => x.id === id);
                    if (a) askRemove(a);
                  }}
                />
                <WhatsAppOfficialCard onConnected={() => handleConnected('WhatsApp Oficial')} />
              </div>
            </section>
          ) : (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <h2 className="text-sm font-bold uppercase tracking-wide text-amber-400">
                  Sem API (métodos não-oficiais)
                </h2>
                <span className="text-[10px] text-gray-500">Viola ToS · risco de bloqueio · use conta de sacrifício</span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4 auto-rows-fr">
                <ManualAccountsCard
                  whatsappUsed={whatsappManualUsed}
                  whatsappMax={WHATSAPP_MANUAL_MAX}
                  onConnected={(msg) => {
                    toast(msg, 'success');
                    void reload();
                  }}
                />
                <WhatsAppQrCard status={{ connected: false }} onConnected={() => handleConnected('WhatsApp QR')} />
              </div>

              {(
                [
                  ['instagram', 'Instagram'],
                  ['facebook', 'Facebook'],
                  ['whatsapp', 'WhatsApp'],
                ] as Array<[Channel, string]>
              ).map(([channel, label]) => {
                const rows = manualByChannel(channel);
                if (rows.length === 0) return null;
                return (
                  <div key={channel} className="mt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                      {label} manual ({rows.length})
                    </h3>
                    <div className="space-y-1.5">{rows}</div>
                  </div>
                );
              })}
              {accounts.length === 0 && (
                <p className="mt-4 text-xs text-gray-500">
                  Nenhuma conta manual conectada. Use o card acima para conectar via e-mail/senha ou cookie/token.
                </p>
              )}
            </section>
          )}
        </div>
      </main>
    </AppShell>
  );
}
