// Provider OpenBSP — envio dual-path + templates via Graph (reuso do adapter
// da casa, whatsappTemplates.ts). NUNCA lança.
//
// Dual-path (plano): com o access_token do número no canal, o caminho
// DIRETO Cloud API é preferido (mesmo código de whatsappSender.ts); o proxy
// OpenBSP (`insert messages`) é o fallback quando falta token/phone_number_id.

import type {
  ChannelAccess,
  DispatchPayload,
  IWhatsAppProvider,
  ListTemplatesResult,
  OfficialSendResult,
  OfficialTemplateSpec,
  ProviderCallOpts,
  TemplateOpResult,
} from '../types';
import { openbspConfig, sendViaOpenbsp, templateContent, textContent } from './client';
import { sendWhatsAppText, sendWhatsAppTemplate } from '../../meta/whatsappSender';
import { listWhatsAppTemplates, createWhatsAppTemplate } from '../../meta/whatsappTemplates';

const GRAPH_VERSION = () => process.env.WHATSAPP_GRAPH_API_VERSION || 'v23.0';

function e164(to: string): string {
  return to.replace(/[^0-9]/g, '');
}

async function send(access: ChannelAccess, to: string, payload: DispatchPayload, opts: ProviderCallOpts = {}): Promise<OfficialSendResult> {
  const dest = e164(to);
  if (!dest) return { ok: false, error: 'invalid_message' };

  // 1) Caminho preferido: Cloud API direta com o token do número.
  if (access.accessToken && access.phoneNumberId) {
    const accessMeta = {
      accessToken: access.accessToken,
      phoneNumberId: access.phoneNumberId,
      version: GRAPH_VERSION(),
    };
    const r =
      payload.kind === 'text'
        ? await sendWhatsAppText(accessMeta, dest, payload.text, opts)
        : await sendWhatsAppTemplate(accessMeta, dest, payload.name, payload.variables, {
            ...opts,
            language: payload.language,
          });
    if (r.ok) return { ok: true, messageId: r.messageId, via: 'meta_direct' };
    // Configuração ausente na trilha direta NUNCA deve cair em fallback
    // silencioso com outro provedor sem registro; erros de negócio Meta
    // (131047 etc.) também não — a fila decide retry. Só network/infra cai.
    if (r.error !== 'network_error' && r.error !== 'fetch_unavailable') {
      return { ok: false, via: 'meta_direct', error: 'provider_error', errorCode: (r as { errorCode?: string | number }).errorCode, errorDetail: r.errorDetail ?? r.error };
    }
    if (!openbspConfig()) {
      return { ok: false, via: 'meta_direct', error: r.error ?? 'network_error', errorDetail: r.errorDetail };
    }
  }

  // 2) Fallback: proxy OpenBSP.
  const content = payload.kind === 'text' ? textContent(payload.text) : templateContent(payload.name, payload.language, payload.variables);
  const r = await sendViaOpenbsp(access, dest, content, opts);
  if (!r.ok) {
    return { ok: false, via: 'openbsp', error: (r.error ?? 'network_error') as OfficialSendResult['error'], errorDetail: r.errorDetail };
  }
  return { ok: true, messageId: r.data?.id, via: 'openbsp' };
}

async function createTemplate(access: ChannelAccess, spec: OfficialTemplateSpec, opts: ProviderCallOpts = {}): Promise<TemplateOpResult> {
  if (!access.wabaId || !access.accessToken) {
    return { ok: false, error: 'channel_unavailable', errorDetail: 'canal sem wabaId/accessToken p/ Graph' };
  }
  const r = await createWhatsAppTemplate(
    { accessToken: access.accessToken, phoneNumberId: access.phoneNumberId, wabaId: access.wabaId, version: GRAPH_VERSION() },
    { name: spec.name, category: spec.category, language: spec.language, body: spec.body },
    opts,
  );
  return r.ok
    ? { ok: true, error: undefined as never }
    : { ok: false, error: 'provider_error', errorDetail: r.errorDetail ?? r.error };
}

async function listTemplates(access: ChannelAccess, opts: ProviderCallOpts = {}): Promise<ListTemplatesResult> {
  if (!access.wabaId || !access.accessToken) {
    return { ok: false, error: 'channel_unavailable', templates: [] };
  }
  const r = await listWhatsAppTemplates(
    { accessToken: access.accessToken, phoneNumberId: access.phoneNumberId, wabaId: access.wabaId, version: GRAPH_VERSION() },
    opts,
  );
  if (!r.ok) return { ok: false, error: 'provider_error', templates: [], errorDetail: r.errorDetail };
  return {
    ok: true,
    error: undefined as never,
    templates: r.templates.map((t) => ({
      name: t.name,
      language: t.language,
      category: t.category,
      status: t.status,
    })),
  };
}

async function getTemplateStatus(
  access: ChannelAccess,
  name: string,
  language: string,
  opts: ProviderCallOpts = {},
): Promise<TemplateOpResult & { template?: import('../types').OfficialTemplateInfo }> {
  const all = await listTemplates(access, opts);
  if (!all.ok) return { ok: false, error: all.error, errorDetail: all.errorDetail };
  const t = all.templates.find((x) => x.name === name && (x.language ?? language) === language);
  return t ? { ok: true, error: undefined as never, template: t } : { ok: false, error: 'provider_error', errorDetail: 'template não encontrado' };
}

export const openbspProvider: IWhatsAppProvider = {
  name: 'openbsp',
  send,
  createTemplate,
  listTemplates,
  getTemplateStatus,
};
