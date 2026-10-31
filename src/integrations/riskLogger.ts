// FASE 1 — Logger de risco para ações de extração/automação não-oficial.
//
// Regra: SEMPRE que uma ação de risco (scraping, QR, automação de navegador) é
// iniciada, logamos em stderr/console com timestamp, plataforma, ação e contexto.
// Isso dá trilha auditoria sem expor segredos.

export type RiskAction =
  | 'scrape_followers'
  | 'scrape_contacts'
  | 'scrape_groups'
  | 'scrape_businesses'
  | 'auto_follow'
  | 'auto_reply_directs'
  | 'mass_follow'
  | 'mass_unfollow'
  | 'qr_pair'
  | 'mention_all'
  | 'mass_message'
  | 'browser_automation';

export interface RiskLogEntry {
  timestamp: string;
  platform: string;
  action: RiskAction;
  detail: string;
  /** Mascarado: primeiros 4 chars do identificador, se houver */
  target?: string;
}

const RISK_LOG: RiskLogEntry[] = [];

/**
 * Loga uma ação de risco no buffer interno e no console.
 * Nunca lança; é apenas auditoria.
 */
export function logRisk(
  platform: string,
  action: RiskAction,
  detail: string,
  target?: string
): RiskLogEntry {
  const entry: RiskLogEntry = {
    timestamp: new Date().toISOString(),
    platform,
    action,
    detail,
    target: target ? mask(target) : undefined,
  };
  RISK_LOG.push(entry);
  // eslint-disable-next-line no-console
  console.warn(`[RISK] ${entry.timestamp} platform=${platform} action=${action} detail=${detail}${target ? ` target=${mask(target)}` : ''}`);
  return entry;
}

function mask(value: string): string {
  if (value.length <= 8) return `${value.slice(0, 2)}…`;
  return `${value.slice(0, 4)}…${value.slice(-2)}`;
}

/** Lista os logs de risco registrados (útil para auditoria/debug). */
export function getRiskLog(): RiskLogEntry[] {
  return [...RISK_LOG];
}

/** Limpa o buffer de logs (útil em testes). */
export function clearRiskLog(): void {
  RISK_LOG.length = 0;
}