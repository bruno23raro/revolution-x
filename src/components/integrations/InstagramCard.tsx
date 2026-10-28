'use client';

// Instagram OAuth
import { useRef, useState } from 'react';
import IntegrationCard, { type IntegrationStatus } from './IntegrationCard';

const INSTAGRAM_OAUTH_URL = '/api/auth/meta?provider=instagram';

function getOrigin(): string {
  return typeof window !== 'undefined' ? window.location.origin : '';
}

export default function InstagramCard({
  status,
  onConnected,
  onDisconnect,
}: {
  status?: IntegrationStatus;
  onConnected?: () => void;
  onDisconnect?: () => void;
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
      INSTAGRAM_OAUTH_URL,
      'instagram-oauth',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`,
    );

    const handler = (e: MessageEvent) => {
      if (e.origin !== getOrigin()) return;
      if (e.data?.type === 'OAUTH_SUCCESS' && e.data?.provider === 'instagram') {
        setLoading(false);
        onConnected?.();
      } else if (e.data?.type === 'OAUTH_ERROR') {
        setLoading(false);
        alert(e.data?.message ?? 'Erro no OAuth');
      }
    };
    window.addEventListener('message', handler);
    const timer = setInterval(() => {
      if (popupRef.current?.closed) {
        window.removeEventListener('message', handler);
        clearInterval(timer);
      }
    }, 500);
  };

  return (
    <IntegrationCard
      channel="instagram"
      title="Instagram"
      subtitle="OAuth · Publicação e agendamento"
      icon={
        <svg className="w-5 h-5 text-pink-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      }
      status={status ?? { connected: false }}
      actions={
        <button
          onClick={startOAuth}
          disabled={loading}
          className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 flex items-center justify-center gap-1"
        >
          {loading ? (
            <><span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" /> Conectando…</>
          ) : (
            'Conectar'
          )}
        </button>
      }
      onDisconnect={onDisconnect}
    >
      <p>Conecte sua conta Instagram Business para publicação e agendamento.</p>
      <p className="text-gray-500 mt-1">Usa OAuth da Meta — token criptografado no banco.</p>
    </IntegrationCard>
  );
}
