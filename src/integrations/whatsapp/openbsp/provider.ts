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

  // 1) Fallback: proxy OpenBSP — prioritizado para uso exclusivo OpenBSP.
  //    Quando o canal tem phoneNumberId, tentamos o proxy OpenBSP primeiro.
  const content = payload.kind === 'text' ? textContent(payload.text) : templateContent(payload.name, payload.language, payload.variables);
  const r = await sendViaOpenbsp(access, dest, content, opts);
  if (r.ok) {
    return { ok: true, messageId: r.data?.id, via: 'openbsp' };
  }
  // Se OpenBSP falhar por erro de negócio (não network), NÃO caímos de volta para Meta.
  // Só caímos de volta para Meta se for erro de network/infra structure.
  if (r.error === 'network_error' || r.error === 'fetch_unavailable') {
    // 2) Fallback: Cloud API direta com Meta — somente erros de network/infra.
    if (!access.accessToken || !access.phoneNumberId) {
      return { ok: false, via: 'openbsp', error: r.error ?? 'network_error', errorDetail: r.errorDetail };
    }
    const accessMeta = {
      accessToken: access.accessToken,
      phoneNumberId: access.phoneNumberId,
      version: GRAPH_VERSION(),
    };
    const mr =
      payload.kind === 'text'
        ? await sendWhatsAppText(accessMeta, dest, payload.text, opts)
        : await sendWhatsAppTemplate(accessMeta, dest, payload.name, payload.variables, {
            ...opts,
            language: payload.language,
          });
    if (mr.ok) return { ok: true, messageId: mr.messageId, via: 'meta_direct' };
    // Erros de negócio Meta (131047 etc.) NÃO caem de volta — só network/infra.
    if (mr.error !== 'network_error' && mr.error !== 'fetch_unavailable') {
      return { ok: false, via: 'meta_direct', error: 'provider_error', errorCode: (mr as { errorCode?: string | number }).errorCode, errorDetail: mr.errorDetail ?? mr.error };
    }
    // Ainda é network/infra → retorna o erro OpenBSP original
    return { ok: false, via: 'openbsp', error: r.error ?? 'network_error', errorDetail: r.errorDetail };
  }

  // OpenBSP business error — não caímos de volta para Meta.
  return { ok: false, via: 'openbsp', error: r.error ?? 'provider_error', errorDetail: r.errorDetail };
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
