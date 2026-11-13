// Sender OpenBSP puro - substitui Meta WhatsApp Sender
// Usa apenas OpenBSP como provedor de envio (sem fallback Meta).

import { openbspConfig, sendViaOpenbsp, textContent, templateContent } from './client';
import type { ProviderCallOpts } from '../types';

export interface OpenBSPConfig {
  orgId: string;
  apiKey: string;
  publishableKey: string;
  baseUrl: string;
  phoneNumberId: string;
}

export interface SendWhatsAppInput {
  config: OpenBSPConfig;
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

/** Normaliza número para E164 sem o '+' */
function toE164(to: string): string {
  return to.replace(/^\+/, '').replace(/[^0-9]/g, '');
}

/** Cria configuração OpenBSP a partir de variáveis de ambiente */
export function configFromEnv(): OpenBSPConfig | null {
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

/** Envia mensagem de texto via OpenBSP */
export async function sendWhatsAppText(
  config: OpenBSPConfig,
  to: string,
  body: string,
  opts: ProviderCallOpts = {},
): Promise<SendWhatsAppResult> {
  if (!to || !toE164(to).length) {
    return { ok: false, error: 'destinatario_ausente' };
  }
  if (!body) {
    return { ok: false, error: 'conteudo_ausente' };
  }

  const cfg = openbspConfig();
  if (!cfg) {
    return { ok: false, error: 'openbsp_not_configured' };
  }

  const access = {
    phoneNumberId: config.phoneNumberId,
  };

  const content = textContent(body);
  const r = await sendViaOpenbsp(access, toE164(to), content, { ...opts, orgId: config.orgId });

  if (r.ok) {
    return { ok: true, messageId: r.data?.id, status: r.status };
  }
  return {
    ok: false,
    error: r.error ?? 'provider_error',
    errorDetail: r.errorDetail,
    status: r.status,
  };
}

/** Envia template via OpenBSP */
export async function sendWhatsAppTemplate(
  config: OpenBSPConfig,
  to: string,
  name: string,
  variables: string[] = [],
  opts: ProviderCallOpts & { language?: string } = {},
): Promise<SendWhatsAppResult> {
  if (!to || !toE164(to).length) {
    return { ok: false, error: 'destinatario_ausente' };
  }
  if (!name) {
    return { ok: false, error: 'template_ausente' };
  }

  const cfg = openbspConfig();
  if (!cfg) {
    return { ok: false, error: 'openbsp_not_configured' };
  }

  const access = {
    phoneNumberId: config.phoneNumberId,
  };

  const content = templateContent(name, opts.language ?? 'en', variables);
  const r = await sendViaOpenbsp(access, toE164(to), content, { ...opts, orgId: config.orgId });

  if (r.ok) {
    return { ok: true, messageId: r.data?.id, status: r.status };
  }
  return {
    ok: false,
    error: r.error ?? 'provider_error',
    errorDetail: r.errorDetail,
    status: r.status,
  };
}

/** Interface unificada para envio WhatsApp */
export interface SendOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** Envia mensagem WhatsApp (texto ou template) via OpenBSP */
export async function send(input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
  const { config, to, body, mediaUrl, template } = input;

  if (!to) return { ok: false, error: 'destinatario_ausente' };
  if (!body && !template && !mediaUrl) return { ok: false, error: 'conteudo_ausente' };

  // Normaliza number
  const dest = toE164(to);
  if (!dest) return { ok: false, error: 'numero_invalido' };

  // Envolve OpenBSP config
  const access = {
    phoneNumberId: config.phoneNumberId,
  };

  // Determina o conteúdo
  let content: Record<string, unknown>;
  if (template) {
    content = templateContent(template.name, template.language, template.variables);
  } else if (mediaUrl) {
    // Mensagem com media usando o padrão OpenBSP
    content = {
      version: '1',
      type: 'media',
      kind: 'media',
      media: { url: mediaUrl },
    };
  } else {
    content = textContent(body ?? '');
  }

  const cfg = openbspConfig();
  if (!cfg || !cfg.orgId) {
    return { ok: false, error: 'openbsp_not_configured' };
  }

  const r = await sendViaOpenbsp(access, dest, content, {});

  if (r.ok) {
    return { ok: true, messageId: r.data?.id, status: r.status };
  }
  return {
    ok: false,
    error: r.error ?? 'provider_error',
    errorDetail: r.errorDetail,
    status: r.status,
  };
}

export const openbspSender = {
  send,
  sendWhatsAppText,
  sendWhatsAppTemplate,
  configFromEnv,
};