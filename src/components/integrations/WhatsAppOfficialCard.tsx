'use client';

// WhatsApp OFICIAL via OpenBSP (019) — popup de onboarding + poll do callback.
// Additivo: nao toca no card QR legado; nunca mesmo numero nos dois canais.
import { useCallback, useEffect, useRef, useState } from 'react';
import IntegrationCard, { type IntegrationStatus } from './IntegrationCard';

interface OfficialStatus {
  connected: boolean;
  status?: string;
  phoneNumber?: string | null;
  verifiedName?: string | null;
  tier?: { sent: number; limit: number; nearLimit: boolean };
}

export default function WhatsAppOfficialCard({
  onConnected,
}: {
  onConnected?: () => void;
}) {
  const [st, setSt] = useState<OfficialStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/integrations/whatsapp-official/status');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setSt(await r.json());
    } catch {
      /* card mostra "desconectado"; erro real so em acoes */
    }
  }, []);

  useEffect(() => {
    void load();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/integrations/openbsp/connect', { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.popupUrl) {
        throw new Error(d.error === 'openbsp_not_configured'
          ? 'OpenBSP ainda nao configurado nesta instancia'
          : d.error ?? 'Falha ao iniciar conexao');
      }
      window.open(d.popupUrl, 'openbsp_onboard', 'width=600,height=700');
      // OpenBSP nao faz postMessage de volta -> poll honesto do callback ate conectar.
      stopPoll();
      pollRef.current = setInterval(async () => {
        try {
          const c = await fetch('/api/integrations/openbsp/callback');
          const cd = await c.json().catch(() => ({}));
          if (cd.connected) {
            stopPoll();
            setBusy(false);
            await load();
            onConnected?.();
          }
        } catch { /* tenta de novo no proximo tick */ }
      }, 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao conectar');
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await fetch('/api/integrations/whatsapp-official/disconnect', { method: 'POST' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const connected = !!st?.connected;
  const status: IntegrationStatus = { connected, error, accountRef: st?.phoneNumber ?? null };
  const tier = st?.tier;

  return (
    <IntegrationCard
      channel="whatsapp"
      title="WhatsApp API Oficial"
      subtitle="Cloud API via OpenBSP · plano temporario ate o App Review"
      icon={
        <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      }
      status={status}
      actions={
        connected ? (
          <button
            onClick={() => void disconnect()}
            disabled={busy}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-400/30 text-red-400 hover:bg-red-400/10 disabled:opacity-50"
          >
            Desconectar
          </button>
        ) : (
          <button
            onClick={() => void connect()}
            disabled={busy}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            {busy ? 'Aguardando…' : 'Conectar'}
          </button>
        )
      }
    >
      <div className="space-y-2">
        {connected && st?.verifiedName && (
          <p className="text-gray-300">Numero verificado: {st.verifiedName} ({st.phoneNumber})</p>
        )}
        {tier && (
          <p className={tier.nearLimit ? 'text-amber-400' : 'text-gray-400'}>
            Tier: {tier.sent}/{tier.limit} mensagens em 24h{tier.nearLimit ? ' — proximo do limite' : ''}
          </p>
        )}
        <p className="text-amber-400/90">
          Free tier do OpenBSP: ate 3 numeros e 5.000 msgs/mes. Voce mesmo registra o numero no
          portal do OpenBSP; use um numero DISTINTO do canal QR.
        </p>
        <p className="text-gray-400">
          Templates passam por aprovacao da Meta (PENDING ate APPROVED) — a campanha so dispara
          template aprovado, e o envio respeita 250 msgs/24h em numero novo.
        </p>
      </div>
    </IntegrationCard>
  );
}
