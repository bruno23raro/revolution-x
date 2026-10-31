'use client';

// Card base para integrações com botão de ação, status e ícone do canal.
// Suporta multi-conta: quando `accounts` é passado, cada conta vira uma linha
// removível (botão "Remover conta"); o status principal continua sendo o da
// primeira conta ativa.
import { type ReactNode, useState } from 'react';

export type Channel = 'whatsapp' | 'instagram' | 'facebook';

export interface IntegrationStatus {
  connected: boolean;
  error?: string | null;
  /** Referência da conta conectada (ex.: metaAccountId); exibida truncada como ••••abcd. */
  accountRef?: string | null;
}

export interface AccountRow {
  id: string;
  status: string;
  metaAccountId: string | null;
  label?: string | null;
  createdAt?: string;
}

export interface IntegrationCardProps {
  channel: Channel;
  title: string;
  subtitle: string;
  icon: ReactNode;
  status: IntegrationStatus;
  actions?: ReactNode;
  onDisconnect?: () => void;
  /** Contas conectadas (multi-conta). Cada uma tem botão "Remover conta". */
  accounts?: AccountRow[];
  onRemoveAccount?: (accountId: string) => void;
  children?: ReactNode;
}

const CHANNEL_COLORS: Record<Channel, { bg: string; text: string; border: string }> = {
  whatsapp: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
  instagram: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/30' },
  facebook: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
};

export default function IntegrationCard({
  channel,
  title,
  subtitle,
  icon,
  status,
  actions,
  onDisconnect,
  accounts,
  onRemoveAccount,
  children,
}: IntegrationCardProps) {
  const colors = CHANNEL_COLORS[channel];
  const [expanded, setExpanded] = useState(false);
  const hasAccounts = accounts && accounts.length > 0;

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
                {hasAccounts && (
                  <span className="font-mono text-gray-500">· {accounts.length} conta(s)</span>
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

      {/* Multi-conta: lista de contas conectadas, cada uma com botão remover */}
      {hasAccounts && (
        <div className="mt-3 space-y-1.5">
          {accounts.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-black/20 border border-white/5"
            >
              <div className="min-w-0">
                <div className="text-xs text-white truncate">
                  {a.label ?? 'Conta sem apelido'}
                  {a.metaAccountId && (
                    <span className="font-mono text-gray-500 ml-1">••••{a.metaAccountId.slice(-4)}</span>
                  )}
                </div>
                <div className="text-[10px] text-gray-500">
                  {a.status} {a.createdAt ? `· ${new Date(a.createdAt).toLocaleDateString('pt-BR')}` : ''}
                </div>
              </div>
              {onRemoveAccount && (
                <button
                  onClick={() => onRemoveAccount(a.id)}
                  className="shrink-0 px-2 py-1 text-[10px] font-semibold rounded-md border border-red-400/30 text-red-400 hover:bg-red-400/10"
                >
                  Remover
                </button>
              )}
            </div>
          ))}
        </div>
      )}

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