import { sendViaOpenbsp } from '../../openbsp/send';
// Provider OpenBSP puro - substitui o provider dual-path que caía no Meta.
// Agora usa EXCLUSIVAMENTE OpenBSP para envio e templates.

import type {
  DispatchPayload,
  IWhatsAppProvider,
  ListTemplatesResult,
  OfficialSendResult,
  OfficialSendError,
  OfficialTemplateInfo,
  OfficialTemplateSpec,
  ProviderCallOpts,
  TemplateOpResult,
} from '../types';
import { openbspConfig, sendViaOpenbsp, textContent, templateContent } from './client';
import type { OpenbspChannelAccess } from './client';

// TODO openbsp: templates via Meta - depende da API Graph da Meta
// Para criar/lister templates, ainda precisamos da Graph API da Meta

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
  return { ok: false, via: 'openbsp', error: (r.error as OfficialSendError) ?? 'provider_error', errorDetail: r.errorDetail };
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
  opts: { delayMs?: number; template?: { name: string; variables: string[]; language?: string } } & ProviderCallOpts = {}
): Promise<{ total: number; sent: number; failed: number; results: OfficialSendResult[] }> {
  const results: OfficialSendResult[] = [];
  let sent = 0;
  let failed = 0;
  // Create baseOpts by extracting only allowed keys from opts
  const baseOpts = {
    fetchImpl: opts.fetchImpl,
    timeoutMs: opts.timeoutMs,
    language: opts.language,
    signal: opts.signal,
  };

  for (const recipient of recipients) {
    const r = await send(access, recipient.to, { kind: 'text', text: recipient.text ?? '' }, baseOpts);
    results.push(r);
    if (r.ok) sent++; else failed++;
    if (opts.delayMs && recipients.length > 1) {
      await new Promise(resolve => setTimeout(resolve, opts.delayMs));
    }
  }

  return { total: recipients.length, sent: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, results };
}

async function sendTestMessage(
  access: OpenbspChannelAccess,
  templateName: string,
  to: string,
  variables?: string[],
  _opts?: ProviderCallOpts
): Promise<OfficialSendResult> {
  // For test messages, we send the template via OpenBSP
  const dest = e164(to);
  if (!dest) return { ok: false, error: 'invalid_message', errorDetail: 'numero invalido' };

  const phoneNumberId = access.phoneNumberId || process.env.OPENBSP_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    return { ok: false, error: 'channel_unavailable', errorDetail: 'phoneNumberId ausente' };
  }

  const accessOpenBSP: OpenbspChannelAccess = { phoneNumberId: phoneNumberId };
  const content = templateContent(templateName, 'pt_BR', variables ?? []);
  const r = await sendViaOpenbsp(accessOpenBSP, dest, content, { select: 'id' });

  if (r.ok) {
    return { ok: true, messageId: r.data?.id, via: 'openbsp' };
  }
  return { ok: false, via: 'openbsp', error: (r.error as OfficialSendError) ?? 'provider_error', errorDetail: r.errorDetail };
}

async function listTemplates(access: OpenbspChannelAccess, opts: ProviderCallOpts = {}): Promise<ListTemplatesResult> {
  const phoneNumberId = access.phoneNumberId || process.env.OPENBSP_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    return { ok: false, error: 'channel_unavailable', errorDetail: 'phoneNumberId ausente', templates: [] };
  }

  const accessOpenBSP: OpenbspChannelAccess = { phoneNumberId: phoneNumberId };
  const r = await sendViaOpenbsp(accessOpenBSP, '', textContent(''), { ...opts, listTemplates: true } as ProviderCallOpts & { listTemplates?: boolean });

  if (r.ok && r.data) {
    return { ok: true, templates: r.data as OfficialTemplateInfo[] };
  }
  return { ok: false, error: (r.error as OfficialSendError) ?? 'provider_error', errorDetail: r.errorDetail, templates: [] };
}

async function getTemplateStatus(
  access: OpenbspChannelAccess,
  name: string,
  language: string,
  opts: ProviderCallOpts = {}
): Promise<TemplateOpResult & { template?: OfficialTemplateInfo }> {
  const phoneNumberId = access.phoneNumberId || process.env.OPENBSP_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    return { ok: false, error: 'channel_unavailable', errorDetail: 'phoneNumberId ausente' };
  }

  const accessOpenBSP: OpenbspChannelAccess = { phoneNumberId: phoneNumberId };
  const r = await sendViaOpenbsp(accessOpenBSP, '', textContent(''), { ...opts, getTemplateStatus: true, templateName: name, language } as ProviderCallOpts & { getTemplateStatus?: boolean; templateName?: string; language?: string });

  if (r.ok && r.data) {
    return { ok: true, template: { name: name } };
  }
  return { ok: false, error: (r.error as OfficialSendError) ?? 'provider_error', errorDetail: r.errorDetail };
}

async function createTemplate(
  _access: OpenbspChannelAccess,
  _spec: OfficialTemplateSpec,
  _opts?: ProviderCallOpts
): Promise<TemplateOpResult> {
  // Template creation via OpenBSP requires Meta Graph API
  return { ok: false, error: 'provider_error', errorDetail: 'Template creation requires Meta Graph API' };
}

export const openbspProvider: IWhatsAppProvider = {
  name: 'openbsp',
  send,
  sendButton,
  runMassSend,
  sendTestMessage,
  listTemplates,
  getTemplateStatus,
  createTemplate,
};

