// Factory WHATSAPP_PROVIDER (mesma ideia do provider de e-mail por env):
//   WHATSAPP_PROVIDER=openbsp      → OpenBSP (padrão agora)
//   WHATSAPP_PROVIDER=meta_direct  → reserva p/ App Review aprovado
import type { IWhatsAppProvider, ProviderName } from './types';
import { openbspProvider } from './openbsp/provider';
import { metaDirectProvider } from './meta_direct/reserved';

export function getWhatsAppProvider(): IWhatsAppProvider {
  const name = (process.env.WHATSAPP_PROVIDER || 'openbsp').trim() as ProviderName;
  if (name === 'meta_direct') {
    console.warn('[WhatsApp Provider] WHATSAPP_PROVIDER=meta_direct solicitado, mas provider meta_direct está reservado (App Review pendente). Usando openbsp como fallback.');
    return openbspProvider;
  }
  return openbspProvider;
}
