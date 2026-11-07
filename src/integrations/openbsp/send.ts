// Envio de mensagens via API OpenBSP
//
// Fluxo: POST para a tabela `messages` na API do OpenBSP (PostgREST).
// O OpenBSP é um PostgREST sobre o banco Supabase, então usamos os headers
// `apikey` (publicable) e `api-key` (service role) para autenticação.
//
// Referencia: https://docs.openbsp.com#send-a-message
//
// POST /rest/v1/messages
// {
//   organization_id: string,
//   organization_address: string,   // phoneNumberId (NÃO o número em texto)
//   conversation_address: string,   // número do destinatário em E.164
//   service: "whatsapp",
//   content: { version: "1", type: "text", kind: "text", text: "Olá!" }
// }

import { createServiceRoleClient } from '@/lib/supabase/server';
import type { WhatsappChannelRow } from '../whatsapp/channelRepo';

export interface OpenBSPSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  details?: unknown;
}

// Env lido por chamada (nao no import): testes setam process.env em
// beforeEach, e env no escopo do modulo congela o valor do carregamento.
function openbspConfig() {
  return {
    baseUrl: process.env.OPENBSP_BASE_URL?.replace(/\/+$/, '') || '',
    publishableKey: process.env.OPENBSP_PUBLISHABLE_KEY || '',
    apiKey: process.env.OPENBSP_API_KEY || '',
  };
}

/**
 * Envia uma mensagem via API OpenBSP.
 * Usa o service role client do Supabase e os headers da OpenBSP para POST direto na tabela messages.
 *
 * @param channel - Pode ser objeto com camelCase (WhatsappChannelRow) ou snake_case (PostgREST response)
 */
export async function sendViaOpenBSP(
  channel: WhatsappChannelRow | Record<string, unknown>,
  to: string,
  text: string,
): Promise<OpenBSPSendResult> {
  const { baseUrl, publishableKey, apiKey } = openbspConfig();

  // Validações básicas
  if (!baseUrl) {
    return { ok: false, error: 'OPENBSP_BASE_URL não configurado' };
  }
  if (!publishableKey || !apiKey) {
    return { ok: false, error: 'Credenciais OpenBSP não configuradas' };
  }

  // Suporta tanto camelCase quanto snake_case (PostgREST retorna snake_case)
  const phoneNumberId = (channel as any).phoneNumberId ?? (channel as any).phone_number_id;
  if (!phoneNumberId) {
    return { ok: false, error: 'Canal OpenBSP sem phoneNumberId' };
  }

  const organizationId = (channel as any).organizationId ?? (channel as any).organization_id;

  const payload = {
    organization_id: organizationId,
    organization_address: phoneNumberId,
    conversation_address: to,
    service: 'whatsapp',
    content: {
      version: '1',
      type: 'text',
      kind: 'text',
      text: text,
    },
  };

  try {
    const response = await fetch(`${baseUrl}/rest/v1/messages`, {
      method: 'POST',
      headers: {
        apikey: publishableKey,
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return {
        ok: false,
        error: `HTTP ${response.status}`,
        details: errorBody,
      };
    }

    const data = await response.json();
    const messageId = Array.isArray(data) ? data[0]?.id : data?.id;

    return {
      ok: true,
      messageId,
      details: data,
    };
  } catch (err) {
    return {
      ok: false,
      error: 'Erro de rede',
      details: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Envia mensagem template via OpenBSP.
 * Para templates WhatsApp Business API oficial.
 *
 * @param channel - Pode ser objeto com camelCase (WhatsappChannelRow) ou snake_case (PostgREST response)
 */
export async function sendTemplateViaOpenBSP(
  channel: WhatsappChannelRow | Record<string, unknown>,
  to: string,
  templateName: string,
  language: string,
  variables?: string[],
): Promise<OpenBSPSendResult> {
  const config = openbspConfig();
  if (!config.baseUrl || !config.publishableKey || !config.apiKey) {
    return { ok: false, error: 'OpenBSP não configurado' };
  }

  // Suporta tanto camelCase quanto snake_case (PostgREST retorna snake_case)
  const phoneNumberId = (channel as any).phoneNumberId ?? (channel as any).phone_number_id;
  if (!phoneNumberId) {
    return { ok: false, error: 'Canal OpenBSP sem phoneNumberId' };
  }

  const organizationId = (channel as any).organizationId ?? (channel as any).organization_id;

  const payload = {
    organization_id: organizationId,
    organization_address: phoneNumberId,
    conversation_address: to,
    service: 'whatsapp',
    template: {
      name: templateName,
      language: language,
      variables: variables || [],
    },
  };

  try {
    const response = await fetch(`${config.baseUrl}/rest/v1/messages`, {
      method: 'POST',
      headers: {
        apikey: config.publishableKey,
        'api-key': config.apiKey,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return {
        ok: false,
        error: `HTTP ${response.status}`,
        details: errorBody,
      };
    }

    const data = await response.json();
    const messageId = Array.isArray(data) ? data[0]?.id : data?.id;

    return { ok: true, messageId, details: data };
  } catch (err) {
    return {
      ok: false,
      error: 'Erro de rede',
      details: err instanceof Error ? err.message : String(err),
    };
  }
}