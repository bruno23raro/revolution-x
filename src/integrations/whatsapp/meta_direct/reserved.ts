// meta_direct — RESERVADO para quando o App Review aprovar o app próprio.
// Hoje falha de forma explícita (nunca envio silencioso por trilha errada).

import type { IWhatsAppProvider } from '../types';

const notReady = {
  ok: false,
  error: 'meta_direct_reserved' as const,
  errorDetail: 'Provedor meta_direct reservado (App Review pendente); use WHATSAPP_PROVIDER=openbsp.',
};

export const metaDirectProvider: IWhatsAppProvider = {
  name: 'meta_direct',
  async send() {
    return { ...notReady };
  },
  async createTemplate() {
    return { ...notReady };
  },
  async listTemplates() {
    return { ...notReady, templates: [] };
  },
  async getTemplateStatus() {
    return { ...notReady };
  },
};
