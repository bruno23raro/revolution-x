// FASE 3 · slice 2 — Chatbot visual: resposta automática a mensagens
// recebidas no WhatsApp, fechando o ciclo que a FASE 1 deixou aberto
// (motor + config CRUD existiam; nada respondia sozinho).
//
// Compõe as peças já existentes, sem caminho novo:
//   1. config do tenant no AgentMemory (leitura org-wide, `getChatbotConfigForOrg`);
//   2. motor de decisão puro `evaluateChatbot` (horários, saudação, fluxo
//      visual, regras, IA, fallback);
//   3. sender oficial da Cloud API (texto ou quick replies em botões).
//
// NUNCA lança: sem credencial resolve, devolve `skipReason` honesto
// (ex.: `not_connected`), para o webhook Meta seguir devolvendo 200.

import type { PrismaClient } from '@prisma/client';
import { getChatbotConfigForOrg } from '@/integrations/configStore';
import { resolveTenantMetaAccess, type ResolveDeps } from './resolveAccess';
import {
  sendWhatsAppButton,
  sendWhatsAppText,
  type SendTextResult,
} from './whatsappSender';
import {
  evaluateChatbot,
  type AiFn,
  type ChatbotConfig,
  type ChatbotDecision,
  type DecisionSource,
} from './whatsappChatbot';

export interface AutoReplyDeps {
  /** Prisma para leitura da config (ou injete `loadConfig` direto). */
  client?: PrismaClient;
  /** Injetável (testes): carrega a config do tenant. */
  loadConfig?: (organizationId: string) => Promise<ChatbotConfig | null>;
  /** Injetável (testes): sender final. Padrão: Cloud API oficial. */
  send?: (to: string, body: string, quickReplies?: string[]) => Promise<SendTextResult>;
  /** Deps do `resolveTenantMetaAccess` (ex.: serviceRole fake em teste). */
  resolveAccessDeps?: ResolveDeps;
  ai?: AiFn;
  nowOverride?: Date;
}

export type AutoReplySkip =
  | 'config_unavailable'
  | 'not_enabled'
  | 'no_response'
  | 'send_failed'
  | 'error';

export interface AutoReplyOutcome {
  replied: boolean;
  source?: DecisionSource;
  decision?: ChatbotDecision;
  send?: SendTextResult;
  skipReason?: AutoReplySkip;
}

/**
 * Tenta responder automaticamente uma mensagem recebida usando a config
 * de chatbot do tenant. Retorna sempre um resultado — nunca lança.
 */
export async function maybeAutoReply(
  organizationId: string,
  waId: string,
  text: string,
  opts: { firstContact?: boolean } = {},
  deps: AutoReplyDeps = {},
): Promise<AutoReplyOutcome> {
  try {
    if (!deps.client && !deps.loadConfig) {
      return { replied: false, skipReason: 'config_unavailable' };
    }

    const loadConfig =
      deps.loadConfig ??
      (async (org: string) => {
        if (!deps.client) return null;
        const value = await getChatbotConfigForOrg(deps.client, org);
        return value ? (value as unknown as ChatbotConfig) : null;
      });

    const config = await loadConfig(organizationId);
    if (!config || config.enabled !== true) {
      return { replied: false, skipReason: 'not_enabled' };
    }

    const decision = await evaluateChatbot(
      config,
      { text, firstContact: opts.firstContact },
      { ai: deps.ai, nowOverride: deps.nowOverride },
    );
    if (!decision.respond || !decision.text?.trim()) {
      return { replied: false, source: decision.source, decision, skipReason: 'no_response' };
    }

    const send = deps.send ?? defaultSender(organizationId, deps.resolveAccessDeps ?? {});
    const result = await send(waId, decision.text, decision.quickReplies);
    if (!result.ok) {
      return {
        replied: false,
        source: decision.source,
        decision,
        send: result,
        skipReason: 'send_failed',
      };
    }
    return { replied: true, source: decision.source, decision, send: result };
  } catch (err) {
    return { replied: false, skipReason: 'error' };
  }
}

/**
 * Sender padrão: resolve a credencial Meta do tenant (`meta_integrations`,
 * descriptografada) e usa a Cloud API oficial — botões quando há quick
 * replies, texto simples senão. Falha de credencial vira `meta_not_configured`
 * com o motivo no detalhe (nunca segredo).
 */
function defaultSender(
  organizationId: string,
  resolveAccessDeps: ResolveDeps,
): (to: string, body: string, quickReplies?: string[]) => Promise<SendTextResult> {
  return async (to, body, quickReplies) => {
    const resolved = await resolveTenantMetaAccess(organizationId, resolveAccessDeps);
    if (!resolved.ok) {
      return {
        ok: false,
        to,
        error: 'meta_not_configured',
        status: 'failed',
        errorDetail: `meta access: ${resolved.reason}`,
      };
    }
    if (quickReplies && quickReplies.length > 0) {
      return sendWhatsAppButton(resolved.access, to, body, quickReplies, {});
    }
    return sendWhatsAppText(resolved.access, to, body, {});
  };
}
