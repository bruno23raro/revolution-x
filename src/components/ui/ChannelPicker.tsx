'use client';

import { useCallback, useState } from 'react';
import { useIntegrationAccounts } from '@/hooks/useIntegrationAccounts';

type Channel = 'whatsapp' | 'instagram' | 'facebook';

function asChannel(value: string): Channel | null {
  return value === 'whatsapp' || value === 'instagram' || value === 'facebook' ? value : null;
}

interface ChannelPickerProps {
  onChannelSelect: (channel: Channel, accountRef: string) => void;
  disabled?: boolean;
}

export function ChannelPicker({ onChannelSelect, disabled }: ChannelPickerProps) {
  const { loading, data } = useIntegrationAccounts();
  const [open, setOpen] = useState(false);

  const accounts = (data?.integrations ?? []).filter(
    (a) => asChannel(a.channel) !== null,
  );

  const handleSelect = useCallback(
    (channel: Channel, accountRef: string) => {
      onChannelSelect(channel, accountRef);
      setOpen(false);
    },
    [onChannelSelect],
  );

  return (
    <div className="relative">
      <button
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-sm cursor-pointer"
        onClick={() => setOpen(!open)}
        disabled={disabled}
      >
        <span>
          {loading
            ? 'Carregando...'
            : accounts.length > 0
              ? accounts[0]?.label ?? 'WhatsApp'
              : 'Nenhum canal'}
        </span>
        <svg
          className="w-3 h-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && !disabled && (
        <div
          className="absolute right-0 mt-2 w-64 rounded-lg border border-white/10 bg-[#0D0915] shadow-lg py-2 min-w"
        >
          {accounts.length === 0 ? (
            <div className="px-3 py-1 text-xs text-gray-400">Nenhum canal conectado</div>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {accounts.map((a) => (
                <div
                  key={a.id}
                  className="px-3 py-1 cursor-pointer select-none hover:bg-white/5 rounded-md"
                  onClick={() => {
                    const channel = asChannel(a.channel);
                    if (channel) handleSelect(channel, a.metaAccountId ?? a.label ?? 'sem-ref');
                  }}
                >
                  {a.label ?? a.metaAccountName} {a.metaAccountId && `â€¢â€¢â€¢â€¢${a.metaAccountId.slice(-4)}`}
                  {a.status && ` Â· ${a.status}`}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
