// Fila de campanhas oficiais — gates de tier e janela 24h (gate 5).
//
// A execucao em lote continua sendo `executeCampaignBatch` (campaignExecutor,
// fila persistente Prisma + retry/backoff JA testados). Este modulo so fornece
// o `sender` com as regras do WhatsApp OFICIAL em cima:
//   * tier starter 250/24h por numero (whatsapp_channels.tierLimitPer24h);
//   * alerta em 80% e auto-pause no limite (a rota devolve a campanha p/ 'paused');
//   * gate 2: em massa so template com status local APPROVED;
//   * categoria ancorada na tabela (MARKETING nunca dispara UTILITY).

import type { ChannelDecrypted, WhatsappChannelRow } from './channelRepo';
import { bumpSentWindow, getApprovedTemplate } from './channelRepo';
import { getWhatsAppProvider } from './provider';
import type { ChannelAccess, DispatchPayload, OfficialSendResult, ProviderCallOpts } from './types';

export type SendResultLike = { ok: boolean; externalMessageId?: string; error?: string };

export interface TierVerdict {
  allowed: boolean;
  /** >= 80% do tier (alerta honesto antes do auto-pause). */
  nearLimit: boolean;
  sent: number;
  limit: number;
}

export function checkTier(channel: WhatsappChannelRow, now = Date.now()): TierVerdict {
  const fresh = !channel.windowStartedAt || now - new Date(channel.windowStartedAt).getTime() > 86_400_000;
  const sent = fresh ? 0 : channel.sentWindow24h;
  const limit = channel.tierLimitPer24h || 250;
  return { allowed: sent < limit, nearLimit: sent >= limit * 0.8, sent, limit };
}

export interface OfficialSenderDeps {
  channel: ChannelDecrypted;
  client: Parameters<typeof bumpSentWindow>[0];
  payload: DispatchPayload;
  /** Categoria esperada do template (auditoria; o gate 2 checa a tabela). */
  expectedCategory?: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  provider?: ReturnType<typeof getWhatsAppProvider>;
  opts?: ProviderCallOpts;
}

export interface OfficialSender {
  (id: string, to: string, text: string): Promise<SendResultLike>;
  /** estado acumulado do lote — a rota usa p/ alerta 80% e auto-pause. */
  readonly lastResult: { sentInRun: number; tierBlocked: boolean; nearLimit: boolean };
}

/**
 * Monta o sender injetavel do `executeCampaignBatch`.
 * shortcut: variaveis do template = linhas da mensagem interpolada
 * ({{1}} na 1a linha, {{2}} na 2a...); migrar p/ array de vars estruturado na
 * UI de templates propria.
 */
export function buildOfficialSender(deps: OfficialSenderDeps): OfficialSender {
  const provider = deps.provider ?? getWhatsAppProvider();
  const access: ChannelAccess = {
    accessToken: deps.channel.accessToken ?? '',
    phoneNumberId: deps.channel.phoneNumberId ?? '',
    wabaId: deps.channel.wabaId,
  };
  let sentInRun = 0;
  let tierBlocked = false;
  let nearLimit = false;

  const fn = async (_id: string, to: string, text: string): Promise<SendResultLike> => {
    const tier = checkTier(deps.channel);
    if (!tier.allowed) {
      tierBlocked = true;
      return { ok: false, error: 'tier_limit_reached' };
    }

    // Gate 2: template precisa estar APPROVED no espelho local (019).
    let payload: DispatchPayload = deps.payload;
    if (payload.kind === 'template') {
      const approved = await getApprovedTemplate(deps.client, deps.channel.organizationId, payload.name, payload.language);
      if (!approved) return { ok: false, error: 'template_not_approved' };
      if (deps.expectedCategory && approved.category !== deps.expectedCategory) {
        return { ok: false, error: 'template_category_mismatch' };
      }
      payload = { ...payload, variables: text ? text.split('\n') : payload.variables };
    }

    const r: OfficialSendResult = await provider.send(access, to, payload, deps.opts);
    if (r.ok) {
      sentInRun += 1;
      deps.channel.sentWindow24h += 1; // espelho em memoria p/ checkTier no lote
      await bumpSentWindow(deps.client, deps.channel);
      nearLimit = checkTier(deps.channel).nearLimit;
      return { ok: true, externalMessageId: r.messageId ?? undefined };
    }
    const code = (r as { errorCode?: string | number }).errorCode;
    const detail = r.errorDetail ? ` ${String(r.errorDetail)}`.slice(0, 180) : '';
    return { ok: false, error: `${r.error ?? 'send_failed'}${code ? `:${code}` : ''}${detail}` };
  };

  // defineProperty (Object.assign avaliaria o getter e congelaria o valor).
  Object.defineProperty(fn, 'lastResult', {
    get: () => ({ sentInRun, tierBlocked, nearLimit }),
  });
  return fn as OfficialSender;
}
