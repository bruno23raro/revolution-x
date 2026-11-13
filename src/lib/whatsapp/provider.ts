// Factory puro OpenBSP — substitui provider.ts original com dependência Meta.
// Todo o fluxo WhatsApp agora usa apenas OpenBSP como provedor.

import { openbspSender } from '@/integrations/whatsapp/openbsp/sender';

export interface WhatsAppConfig {
  orgId: string;
  apiKey: string;
  publishableKey: string;
  baseUrl: string;
  phoneNumberId: string;
}

export interface SendWhatsAppInput {
  config: WhatsAppConfig;
  to: string;
  body: string;
  mediaUrl?: string;
  template?: {
    name: string;
    language: string;
    variables: string[];
  };
}

export interface SendWhatsAppResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  errorDetail?: string;
  status?: number;
  raw?: unknown;
}

export function configFromEnv(): WhatsAppConfig | null {
  const orgId = process.env.OPENBSP_ORG_ID;
  const apiKey = process.env.OPENBSP_API_KEY;
  const baseUrl = process.env.OPENBSP_BASE_URL;
  const publishableKey = process.env.OPENBSP_PUBLISHABLE_KEY;
  const phoneNumberId = process.env.OPENBSP_PHONE_NUMBER_ID;

  if (!orgId || !apiKey || !baseUrl) return null;
  return {
    orgId,
    apiKey,
    baseUrl: baseUrl.replace(/\/+$/, ''),
    publishableKey: publishableKey ?? '',
    phoneNumberId: phoneNumberId ?? '',
  };
}

export interface SendOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export async function sendWhatsApp(input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
  const { config, to, body, mediaUrl, template } = input;

  if (!to) return { ok: false, error: 'destinatario_ausente' };
  if (!body && !template && !mediaUrl) return { ok: false, error: 'conteudo_ausente' };

  // Normaliza number para E164
  const dest = to.replace(/^\+/, '').replace(/[^0-9]/g, '');
  if (!dest) return { ok: false, error: 'numero_invalido' };

  try {
    const res = await openbspSender.send({
      config: {
        orgId: config.orgId,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        publishableKey: config.publishableKey,
        phoneNumberId: config.phoneNumberId,
      },
      to: dest,
      body: body ?? '',
      mediaUrl,
      template,
    });

    return { ok: true, messageId: res?.messageId, raw: res };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'erro_desconhecido' };
  }
}

export const whatsappProvider = { sendWhatsApp, configFromEnv, send: openbspSender.send };