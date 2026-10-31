'use client';

// Facebook Pages OAuth com dropdown de seleção de página
import { useRef, useState, useEffect } from 'react';
import IntegrationCard, { type AccountRow, type IntegrationStatus } from './IntegrationCard';

const FACEBOOK_OAUTH_URL = '/api/auth/meta?provider=facebook';

function getOrigin(): string {
  return typeof window !== 'undefined' ? window.location.origin : '';
}

interface PageOption {
  id: string;
  name: string;
}

export default function FacebookPagesCard({
  status,
  onConnected,
  onDisconnect,
  accounts,
  onRemoveAccount,
}: {
  status?: IntegrationStatus;
  onConnected?: () => void;
  onDisconnect?: () => void;
  /** Contas conectadas (multi-conta): cada página do Facebook vira uma linha removível. */
  accounts?: AccountRow[];
  onRemoveAccount?: (accountId: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [pages, setPages] = useState<PageOption[]>([]);
  const [selectedPage, setSelectedPage] = useState<string>('');
  const popupRef = useRef<Window | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const startOAuth = async () => {
    setLoading(true);
    const url = selectedPage
      ? `${FACEBOOK_OAUTH_URL}&page_id=${encodeURIComponent(selectedPage)}`
      : FACEBOOK_OAUTH_URL;

    const width = 600;
    const height = 700;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;
    popupRef.current = window.open(url, 'facebook-oauth', `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);

    const handler = (e: MessageEvent) => {
      if (e.origin !== getOrigin()) return;
      if (e.data?.type === 'OAUTH_SUCCESS' && e.data?.provider === 'facebook') {
        setLoading(false);
        setShowDropdown(false);
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

  const loadPages = async () => {
    try {
      const r = await fetch('/api/integrations/status');
      if (!r.ok) return;
      const d = await r.json() as { integrations?: Array<{ metaAccountId: string; metaAccountName: string }> };
      const pageList: PageOption[] = (d.integrations ?? [])
        .filter((i) => i.metaAccountId && i.metaAccountName)
        .map((i) => ({ id: i.metaAccountId!, name: i.metaAccountName! }));
      setPages(pageList);
      if (pageList.length > 0 && !selectedPage) setSelectedPage(pageList[0].id);
    } catch {
      // Silencioso
    }
  };

  useEffect(() => {
    if (showDropdown) loadPages();
  }, [showDropdown]);

  return (
    <IntegrationCard
      channel="facebook"
      title="Facebook Pages"
      subtitle="OAuth · Páginas do Facebook"
      icon={
        <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      }
      status={status ?? { connected: false }}
      actions={
        <div className="w-full space-y-1">
          <select
            value={selectedPage}
            onChange={(e) => setSelectedPage(e.target.value)}
            onClick={() => setShowDropdown(true)}
            className="w-full text-xs bg-white/5 border border-white/10 rounded px-2 py-1.5 text-gray-300 focus:outline-none focus:border-blue-500/50"
          >
            <option value="">Selecione uma página…</option>
            {pages.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            onClick={startOAuth}
            disabled={loading}
            className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {loading ? (
              <><span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" /> Conectando…</>
            ) : (
              'Conectar Página'
            )}
          </button>
        </div>
      }
      onDisconnect={onDisconnect}
      accounts={accounts}
      onRemoveAccount={onRemoveAccount}
    >
      <p>Conecte uma página do Facebook para publicação e anúncios.</p>
      <p className="text-gray-500 mt-1">Selecione a página no dropdown antes de conectar.</p>
      <p className="text-gray-500">Token criptografado (AES-256-GCM) no banco.</p>
    </IntegrationCard>
  );
}
