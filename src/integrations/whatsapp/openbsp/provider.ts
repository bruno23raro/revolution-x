// Provider OpenBSP puro - substitui o provider dual-path que caía no Meta.
// Agora usa EXCLUSIVAMENTE OpenBSP para envio e templates.

import type {
  DispatchPayload,
  IWhatsAppProvider,
  ListTemplatesResult,
  OfficialSendResult,
  OfficialTemplateSpec,
  ProviderCallOpts,
  TemplateOpResult,
} from '../types';
import { openbspConfig, sendViaOpenbsp, textContent, templateContent } from './client';
import type { OpenbspChannelAccess } from './client';

// TODO openbsp: templates via Meta - depende da API Graph da Meta
// Para criar/lister templates, ainda precisamos do Graph API da Meta

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

async function createTemplate(access: OpenbspChannelAccess, spec: OfficialTemplateSpec, opts: ProviderCallOpts = {}): Promise<TemplateOpResult> {
  // TODO openbsp: sem equivalente Meta - templates precisam da API Graph da Meta
  return { ok: false, error: 'provider_error', errorDetail: 'criacao de templates ainda requer Meta Graph API' };
}

async function listTemplates(access: OpenbspChannelAccess, opts: ProviderCallOpts = {}): Promise<ListTemplatesResult> {
  // TODO openbsp: sem equivalente Meta - templates precisam da API Graph da Meta
  return { ok: false, error: 'provider_error', templates: [], errorDetail: 'listagem de templates ainda requer Meta Graph API' };
}

async function getTemplateStatus(
  access: OpenbspChannelAccess,
  name: string,
  language: string,
  opts: ProviderCallOpts = {},
): Promise<TemplateOpResult & { template?: import('../types').OfficialTemplateInfo }> {
  // TODO openbsp: sem equivalente Meta - templates precisam da API Graph da Meta
  return { ok: false, error: 'provider_error', errorDetail: 'status de templates ainda requer Meta Graph API' };
}

export const openbspProvider: IWhatsAppProvider = {
  name: 'openbsp',
  send,
  createTemplate,
  listTemplates,
  getTemplateStatus,
};
