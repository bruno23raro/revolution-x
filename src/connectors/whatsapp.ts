// FASE 7/1 — WhatsApp Connector (OpenBSP puro)
//
// MIGRAÇÃO COMPLETA: agora usa apenas OpenBSP como provedor.
// Substitui o código que caía no Meta WhatsApp Sender.
//
// Credenciais: orgId, apiKey, publishableKey, baseUrl, phoneNumberId
// vêm do painel OpenBSP (variáveis de ambiente).

import { openbspSender } from '@/integrations/whatsapp/openbsp/sender';

export interface WhatsAppConfig {
  /** Organization ID do OpenBSP */
  orgId: string;
  /** API Key do OpenBSP */
  apiKey: string;
  /** Publishable Key do OpenBSP */
  publishableKey: string;
  /** Base URL do OpenBSP (https://<ref>.supabase.co/rest/v1) */
  baseUrl: string;
  /** Phone Number ID do OpenBSP */
  phoneNumberId: string;
}

export interface WhatsAppMessage {
  to: string; // telefone com DDI, ex.: 5511999999999
  body: string;
  /** Se definido, envia template oficial em vez de `body`. */
  template?: string;
  templateVariables?: string[];
  language?: string;
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SendOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** Normaliza número para E164 */
function toE164(to: string): string {
  return to.replace(/^\+/, '').replace(/[^0-9]/g, '');
}

export async function sendWhatsAppMessage(
  config: WhatsAppConfig,
  msg: WhatsAppMessage,
  opts: SendOptions = {},
): Promise<WhatsAppSendResult> {
  const input = {
    config: {
      orgId: config?.orgId ?? '',
      apiKey: config?.apiKey ?? '',
      publishableKey: config?.publishableKey ?? '',
      baseUrl: config?.baseUrl ?? 'https://nheelwshzbgenpavwhcy.supabase.co/rest/v1',
      phoneNumberId: config?.phoneNumberId ?? '',
    },
    to: toE164(msg.to),
    body: msg.body ?? '',
    template: msg.template
      ? {
          name: msg.template,
          language: msg.language ?? 'en',
          variables: msg.templateVariables ?? [],
        }
      : undefined,
  };

  const r = await openbspSender.send(input);
  return r.ok
    ? { success: true, messageId: r.messageId }
    : { success: false, error: r.error ?? r.errorDetail };
}