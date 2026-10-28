'use client';

// Card base para integrações com botão de ação, status e ícone do canal.
import { type ReactNode, useState } from 'react';

export type Channel = 'whatsapp' | 'instagram' | 'facebook';

export interface IntegrationStatus {
  connected: boolean;
  error?: string | null;
  /** Referência da conta conectada (ex.: metaAccountId); exibida truncada como ••••abcd. */
  accountRef?: string | null;
}

export interface IntegrationCardProps {
  channel: Channel;
  title: string;
  subtitle: string;
  icon: ReactNode;
  status: IntegrationStatus;
  actions?: ReactNode;
  onDisconnect?: () => void;
  children?: ReactNode;
}

const CHANNEL_COLORS: Record<Channel, { bg: string; text: string; border: string }> = {
  whatsapp: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
  instagram: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/30' },
  facebook: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
};

export default function IntegrationCard({ channel, title, subtitle, icon, status, actions, onDisconnect, children }: IntegrationCardProps) {
  const colors = CHANNEL_COLORS[channel];
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-xl border ${colors.border} ${colors.bg} p-4 transition-all hover:shadow-lg`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${colors.border} border`}>
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-white text-sm truncate">{title}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
            {!status.connected && status.error && (
              <p className="text-xs text-red-400 mt-1">{status.error}</p>
            )}
            {status.connected && (
              <span className="inline-flex items-center gap-1 mt-1 text-[11px] text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                Conectado
                {status.accountRef && (
                  // shortcut: só o tail do identificador; não é segredo (a API já o expõe)
                  <span className="font-mono text-gray-400">••••{status.accountRef.slice(-4)}</span>
                )}
              </span>
            )}
          </div>
        </div>
        {actions && <div className="shrink-0 flex flex-col gap-1">{actions}</div>}
        {status.connected && onDisconnect && (
          <button
            onClick={onDisconnect}
            className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-400/30 text-red-400 hover:bg-red-400/10"
          >
            Desconectar
          </button>
        )}
      </div>
      {children && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="mt-3 text-xs text-gray-400 hover:text-white transition-colors"
        >
          {expanded ? 'Mostrar menos ▲' : 'Mais informações ▼'}
        </button>
      )}
      {expanded && children && (
        <div className="mt-3 pt-3 border-t border-white/10 text-xs text-gray-300 space-y-1">
          {children}
        </div>
      )}
    </div>
  );
}
