'use client';

// WhatsApp Business API (Official) — OAuth + signup option
import { useRef, useState } from 'react';
import IntegrationCard, { type AccountRow, type IntegrationStatus } from './IntegrationCard';

const WHATSAPP_OAUTH_URL = '/api/auth/meta?provider=whatsapp';

function getOrigin(): string {
  return typeof window !== 'undefined' ? window.location.origin : '';
}

export default function WhatsAppApiCard({
  status,
  onConnected,
  onDisconnect,
  accounts,
  onRemoveAccount,
}: {
  status?: IntegrationStatus;
  onConnected?: () => void;
  onDisconnect?: () => void;
  /** Contas conectadas (multi-conta): cada uma vira uma linha removível. */
  accounts?: AccountRow[];
  onRemoveAccount?: (accountId: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const popupRef = useRef<Window | null>(null);

  const startOAuth = () => {
    setLoading(true);
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;
    popupRef.current = window.open(
      WHATSAPP_OAUTH_URL,
      'whatsapp-oauth',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`,
    );

    const handler = (e: MessageEvent) => {
      if (e.origin !== getOrigin()) return;
      if (e.data?.type === 'OAUTH_SUCCESS' && e.data?.provider === 'whatsapp') {
        setLoading(false);
        onConnected?.();
      } else if (e.data?.type === 'OAUTH_ERROR') {
        setLoading(false);
        alert(e.data?.message ?? 'Erro no OAuth');
      }
    };
    window.addEventListener('message', handler);
    // Cleanup: desligar se o popup for fechado
    const timer = setInterval(() => {
      if (popupRef.current?.closed) {
        window.removeEventListener('message', handler);
        clearInterval(timer);
      }
    }, 500);
  };

  const handleSignup = () => {
    window.open('https://developers.facebook.com/docs/whatsapp/', '_blank');
  };

  return (
    <IntegrationCard
      channel="whatsapp"
      title="WhatsApp Business API"
      subtitle="Oficial · Meta · Disparo em massa e chatbot"
      icon={
        <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      }
      status={status ?? { connected: false }}
      actions={
        <>
          <button
            onClick={startOAuth}
            disabled={loading}
            className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {loading ? (
              <><span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" /> Conectando…</>
            ) : (
              'Conectar'
            )}
          </button>
          <button
            onClick={handleSignup}
            className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-white/15 text-gray-300 hover:bg-white/5"
          >
            Criar conta Meta
          </button>
        </>
      }
      onDisconnect={onDisconnect}
      accounts={accounts}
      onRemoveAccount={onRemoveAccount}
    >
      <p>Via API oficial da Meta. Você será redirecionado para autorizar o aplicativo.</p>
      <p className="text-gray-500 mt-1">O token fica criptografado (AES-256-GCM) no banco.</p>
    </IntegrationCard>
  );
}
