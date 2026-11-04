'use client';

// Card base para integrações com badge de status, modo e botão de ação.
// Busca estado do banco via getByChannel quando não há status passado explicitamente.
// Suporta multi-conta: quando `accounts` é passado, cada conta vira uma linha
// removível (botão "Remover conta"); o status principal continua sendo o da
// primeira conta ativa.
import { type ReactNode, useEffect, useState } from 'react';

import { getByChannel } from '@/integrations/repository';
import { Channel, type IntegrationRow } from '@/integrations/types';

export type Mode = 'OFFICIAL' | 'MANUAL';

export interface IntegrationStatus {
  connected: boolean;
  error?: string | null;
  /** Referência da conta conectada (ex.: metaAccountId); exibida truncada como ••••abcd. */
  accountRef?: string | null;
  mode?: Mode;
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
  mode?: Mode;
  title: string;
  subtitle: string;
  icon: ReactNode;
  /** Já buscado do banco via getByChannel. Se não passado, o componente faz a busca. */
  status?: IntegrationStatus | null;
  actions?: ReactNode;
  onDisconnect?: () => void;
  /** Contas conectadas (multi-conta). Cada uma tem botão "Remover conta". */
  accounts?: AccountRow[];
  onRemoveAccount?: (accountId: string) => void;
  children?: ReactNode;
  /** Quando true, força recarregar do banco ao invés de usar estado local. */
  reloadOnMount?: boolean;
}

// Cores por canal (compatíveis com Record<Channel, { bg: string; text: string; border: string; }>)
const CHANNEL_COLORS: Record<Channel, {
  bg: string;
  text: string;
  border: string;
  // TS precisa que todas as propriedades estejam presentes
}> = {
  whatsapp: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
  instagram: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/30' },
  facebook: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
} as unknown as Record<Channel, { bg: string; text: string; border: string; }>;

// Estado de expansão do card (toggle "Mostrar menos/Mais")
const useCardExpanded = (): [boolean, (open: boolean) => void] => {
  const [expanded, setExpanded] = useState(false);
  return [expanded, setExpanded];
};

export default function IntegrationCard({
  channel,
  mode: modeProp,
  title,
  subtitle,
  icon,
  status: statusProp,
  actions,
  onDisconnect,
  accounts,
  onRemoveAccount,
  children,
  reloadOnMount = false,
}: IntegrationCardProps) {
  const colors = CHANNEL_COLORS[channel];
  const [loadedStatus, setLoadedStatus] = useState<IntegrationStatus | null>(null);
  const [didLoad, setDidLoad] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Busca do banco apenas na montagem (ou se recarregar for explicitado)
  useEffect(() => {
    // Se já tem statusProp vindo do pai, usa ele direto (para testes/SSR)
    if (statusProp) {
      setLoadedStatus(statusProp);
      setDidLoad(true);
    } else {
      // Busca do banco — usa workspaceId do contexto ou fallback
      const fetchStatus = async () => {
        try {
          // workspaceId virá do contexto de auth do app
          const wsId = 'workspace-1'; // placeholder — será substituído pelo contexto real
          const result = await getByChannel(null as any, wsId, channel);
          if (result) {
            const modeLabel: Mode = result.mode === 'OFFICIAL' ? 'OFFICIAL' : 'MANUAL';
            const status: IntegrationStatus = {
              connected: result.status === 'connected',
              error: result.status_reason ?? undefined,
              accountRef: result.external_account_id ? `••••${result.external_account_id.slice(-4)}` : undefined,
              mode: modeLabel,
            };
            setLoadedStatus(status);
          } else {
            const modeLabel: Mode = 'OFFICIAL'; // default quando não há registro
            setLoadedStatus({ connected: false, error: null, accountRef: undefined, mode: modeLabel });
          }
          setDidLoad(true);
        } catch (e) {
          const modeLabel: Mode = modeProp || 'OFFICIAL';
          setLoadedStatus({ connected: false, error: 'Erro ao carregar', accountRef: undefined, mode: modeLabel });
          setDidLoad(true);
        }
      };
      fetchStatus();
    }
  }, [channel, modeProp, reloadOnMount, statusProp]);

  // Se o status ainda não carregou, mostrar spinner/placeholder
  if (!didLoad || loadedStatus === null) {
    return (
      <div className={`rounded-xl border ${colors.border} ${colors.bg} p-4 transition-all`}>
        <div className="flex items-center justify-center min-h-64">
          <span className="text-gray-400">Carregando...</span>
        </div>
      </div>
    );
  }

  const status = loadedStatus || statusProp || { connected: false, error: null, accountRef: undefined, mode: modeProp || 'OFFICIAL' };

  const hasAccounts = accounts && accounts.length > 0;

  // Determina rótulo de ação por modo e estado
  const getActionLabel = (): string => {
    if (!status.connected) {
      if (status.error) {
        return 'Tentar de novo';
      }
      // disconnected
      if (modeProp === 'OFFICIAL') {
        if (channel === 'whatsapp') return 'Gerar QR Code';
        if (channel === 'instagram') return 'Configurar credenciais';
        if (channel === 'facebook') return 'Conectar conta';
      }
      return 'Conectar';
    }
    if (status.connected && !status.error) {
      return 'Desconectar';
    }
    return 'Tentar de novo';
  };

  // Determina badge de modo
  const modeBadge = modeProp || status.mode || 'OFFICIAL';
  const modeClass = modeBadge === 'OFFICIAL'
    ? 'bg-green-500/20 text-green-400 border-green-500/30'
    : 'bg-orange-500/20 text-orange-400 border-orange-500/30';

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
        {/* Botão de ação — estado depende do modo e conexão */}
        {status.connected && onDisconnect && (
          <button
            onClick={onDisconnect}
            className={`shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-400/30 text-red-400 hover:bg-red-400/10 ${modeClass}`}
            aria-label={`Desconectar ${channel} ${modeBadge === 'OFFICIAL' ? 'conta oficial' : 'conta manual'}`}
          >
            Desconectar
          </button>
        )}
        {/* Quando desconectado: botão conectar com rótulo por modo */}
        {!status.connected && !status.error && onDisconnect && (
          <button
            onClick={onDisconnect}
            className={`shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-400/30 text-red-400 hover:bg-red-400/10 ${modeClass}`}
            aria-label={`Conectar ${channel} via ${modeBadge === 'OFFICIAL' ? 'API oficial' : 'modal/manual'}`}
          >
            {getActionLabel()}
          </button>
        )}
        {/* Estado error / pending */}
        {!status.connected && status.error && (
          <button
            onClick={() => {}}
            className={`shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-400/30 text-red-400 hover:bg-red-400/10 ${modeClass}`}
            aria-label={`Tentar novamente ${channel} ${modeBadge === 'OFFICIAL' ? 'via API oficial' : 'via modal/manual'}`}
          >
            Tentar de novo
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