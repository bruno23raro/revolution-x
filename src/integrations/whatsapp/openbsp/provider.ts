// Provider OpenBSP puro - substitui o provider dual-path que caía no Meta.
// Agora usa EXCLUSIVAMENTE OpenBSP para envio e templates.

import type {
  DispatchPayload,
  IWhatsAppProvider,
  ListTemplatesResult,
  OfficialSendResult,
  OfficialSendError,
  OfficialTemplateSpec,
  ProviderCallOpts,
  TemplateOpResult,
} from '../types';
import { openbspConfig, sendViaOpenbsp, textContent, templateContent } from './client';
import type { OpenbspChannelAccess } from './client';

// TODO openbsp: templates via Meta - depende da API Graph da Meta
// Para criar/lister templates, ainda precisamos da Graph API da Meta

const GRAPH_VERSION = () => process.env.WHATSAPP_GRAPH_API_VERSION || 'v23.0';

function e164(to: string): string {
  return to.replace(/[^0-9]/g, '');
}

async function send(access: OpenbspChannelAccess, to: string, payload: DispatchPayload, opts: ProviderCallOpts = {}): Promise<OfficialSendResult> {
  const dest = e164(to);
  if (!dest) return { ok: false, error: 'invalid_message', errorDetail: 'numero invalido' };

  // OpenBSP puro - envia via proxy OpenBSP
  const content = payload.kind === 'text' ? textContent(payload.text) : templateContent(payload.name, payload.language, payload.variables);

  // Se phoneNumberId não está no canal, tenta usar do config
  const phoneNumberId = access.phoneNumberId || process.env.OPENBSP_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    return { ok: false, error: 'channel_unavailable', errorDetail: 'phoneNumberId ausente' };
  }

  const accessOpenBSP: OpenbspChannelAccess = { phoneNumberId: phoneNumberId };
  const r = await sendViaOpenbsp(accessOpenBSP, dest, content, opts);

  if (r.ok) {
    return { ok: true, messageId: r.data?.id, via: 'openbsp' };
  }

  // OpenBSP business error - não caímos de volta para Meta
  return { ok: false, via: 'openbsp', error: r.error ?? 'provider_error', errorDetail: r.errorDetail };
}

async function sendButton(access: OpenbspChannelAccess, to: string, body: string, buttons: string[], opts: ProviderCallOpts = {}): Promise<OfficialSendResult> {
  // OpenBSP não suporta botões interativos nativamente via API simplificada
  // Envia como texto com botões numerados
  const buttonText = buttons.map((b, i) => `${i + 1}. ${b}`).join('\n');
  const bodyWithButtons = `${body}\n\n${buttonText}`;
  return send(access, to, { kind: 'text', text: bodyWithButtons }, opts);
}

async function runMassSend(
  access: OpenbspChannelAccess,
  recipients: Array<{ to: string; text?: string }>,
  opts: { delayMs?: number; template?: { name: string; variables: string[]; language?: string } } = {}
): Promise<{ total: number; sent: number; failed: number; results: OfficialSendResult[] }> {
  const results: Array<{ ok: boolean; to: string; messageId?: string; via?: 'openbsp' | 'meta_direct'; error?: OfficialSendError; errorDetail?: string }> = [];
  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const r = await send(access, recipient.to, { kind: 'text', text: recipient.text ?? '' }, opts as ProviderCallOpts);
    results.push({ ok: r.ok, to: recipient.to, messageId: r.messageId, via: r.via, error: r.error, errorDetail: r.errorDetail });
    if (r.ok) sent++; else failed++;
    if (opts.delayMs && recipients.length > 1) {
      await new Promise(r => setTimeout(r, opts.delayMs));
    }
  }

  return { total: recipients.length, sent: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, results: results.map(r => ({ ok: r.ok, to: '', messageId: r.messageId, via: r.via, error: r.error, errorDetail: r.errorDetail })) };
}

async function sendTestMessage(
  access: OpenbspChannelAccess,
  templateName: string,
  to: string,
  variables?: string[],
  opts: ProviderCallOpts = {},
): Promise<{ ok: boolean; messageId?: string; error?: OfficialSendError; errorDetail?: string }> {
  // OpenBSP não suporta envio de template de teste via Graph API
  return { ok: false, error: 'provider_error', errorDetail: 'envio de template de teste requer Meta Graph API' };
}

async function createTemplate(
  access: OpenbspChannelAccess,
  spec: OfficialTemplateSpec,
  opts?: ProviderCallOpts,
): Promise<TemplateOpResult> {
  return { ok: false, error: 'provider_error', errorDetail: 'criacao de templates requer Meta Graph API' };
}

async function listTemplates(access: OpenbspChannelAccess): Promise<ListTemplatesResult> {
  return { ok: true, templates: [] };
}

async function getTemplateStatus(
  access: OpenbspChannelAccess,
  name: string,
  language: string,
  opts?: ProviderCallOpts,
): Promise<TemplateOpResult & { template?: import('../types').OfficialTemplateInfo }> {
  return { ok: true, name, template: { name, status: 'UNKNOWN', language } };
}

export const openbspProvider: IWhatsAppProvider = {
  name: 'openbsp',
  send,
  sendButton,
  runMassSend,
  createTemplate,
  listTemplates,
  getTemplateStatus,
  sendTestMessage,
};
