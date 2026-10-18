export interface RiskAcknowledgment {
  platform: 'facebook' | 'instagram' | 'linkedin' | 'tiktok' | 'twitter' | 'bluesky' | 'threads' | 'pinterest' | 'whatsapp';
  timestamp: string;
  acknowledged: boolean;
  version: string;
}

export const CURRENT_RISK_VERSION = '1.0.0';

export function enforceRiskAcknowledgment(
  platform: RiskAcknowledgment['platform'],
  acknowledged: boolean
): void {
  if (!acknowledged) {
    throw new Error(
      `Risk acknowledgment required for platform: ${platform}. ` +
      `Automated actions on social media platforms carry risks of account bans or restrictions. ` +
      `By proceeding, you acknowledge these risks and confirm compliance with platform ToS.`
    );
  }
}

/**
 * Verifica consentimento de risco SEM lançar exceção.
 * Retorna `null` se OK, ou objeto de erro se não reconhecido.
 */
export function checkRiskAcknowledgment(
  platform: RiskAcknowledgment['platform'],
  acknowledged: boolean,
  version?: string,
): { error: string; errorDetail: string } | null {
  if (!acknowledged) {
    return {
      error: 'risk_not_acknowledged',
      errorDetail: `Risk acknowledgment required for platform: ${platform}. ` +
        `Automated actions on social media platforms carry risks of account bans or restrictions. ` +
        `Current risk version: ${version ?? CURRENT_RISK_VERSION}. ` +
        `By proceeding, you acknowledge these risks and confirm compliance with platform ToS.`,
    };
  }
  if (version && version !== CURRENT_RISK_VERSION) {
    return {
      error: 'risk_not_acknowledged',
      errorDetail: `Risk acknowledgment version mismatch. Expected ${CURRENT_RISK_VERSION}, got ${version}. Please re-acknowledge.`,
    };
  }
  return null;
}
