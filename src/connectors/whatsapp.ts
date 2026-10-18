// FASE 7/1 — WhatsApp Connector (adapter REAL, delega à Cloud API oficial da Meta)
//
// Antes: stub "BLOQUEADO — credencial Meta não fornecida". Agora: delega ao
// `whatsappSender`, então envia de verdade quando `config.apiKey` (= access
// token já descriptografado) e `config.phoneNumberId` estão presentes; senão
// degrada honestamente para `meta_not_configured` (nada de fingir).
//
// Mantém as exportações da Fase 7 (`WhatsAppConfig`, `WhatsAppMessage`,
// `sendWhatsAppMessage`) para não quebrar a interface — apenas agora funciona.

import {
  sendWhatsAppText,
  sendWhatsAppTemplate,
  type MetaWABAccess,
  type SendOptions,
} from '../integrations/meta/whatsappSender';

export interface WhatsAppConfig {
  /** Access token da Meta (já descriptografado). Em produção, decifrado de `meta_integrations`. */
  apiKey?: string;
  phoneNumberId?: string;
  businessAccountId?: string;
  apiBase?: string;
  version?: string;
}

export interface WhatsAppMessage {
  to: string; // telefone com DDI, ex.: 5511999999999
  body: string;
  messageId?: string;
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

export async function sendWhatsAppMessage(
  config: WhatsAppConfig,
  msg: WhatsAppMessage,
  opts: SendOptions = {},
): Promise<WhatsAppSendResult> {
  const access: MetaWABAccess = {
    accessToken: config?.apiKey ?? '',
    phoneNumberId: config?.phoneNumberId ?? '',
    apiBase: config?.apiBase,
    version: config?.version,
  };

  if (msg.template) {
    const r = await sendWhatsAppTemplate(access, msg.to, msg.template, msg.templateVariables ?? [], {
      ...opts,
      language: msg.language,
    });
    return r.ok ? { success: true, messageId: r.messageId } : { success: false, error: r.error ?? r.errorDetail };
  }

  const r = await sendWhatsAppText(access, msg.to, msg.body ?? '', opts);
  return r.ok ? { success: true, messageId: r.messageId } : { success: false, error: r.error ?? r.errorDetail };
}
