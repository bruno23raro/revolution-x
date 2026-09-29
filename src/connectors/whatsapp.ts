// FASE 7 — WhatsApp Connector (adapter preparado)
// Baseado: README Fase 7 = WhatsApp + Meta Ads
// Dependência externa: conta Meta + chave API (não inventada)
// Não inventa: templates, fluxos de conversa, automações
// Prepara: interface de envio, configuração, documentação

export interface WhatsAppConfig {
  apiKey?: string;
  phoneNumberId?: string;
  businessAccountId?: string;
}

export interface WhatsAppMessage {
  to: string; // telefone com país
  body: string;
  messageId?: string;
}

// TODO: implementar quando credencial Meta confirmada
export async function sendWhatsAppMessage(config: WhatsAppConfig, msg: WhatsAppMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // BLOQUEADO EXTERNAMENTE — credencial Meta ausente
  // Preparo: estrutura de adapter completa; execução quando Ação do usuário confirmada
  return { success: false, error: 'BLOQUEADO — credencial Meta não fornecida' };
}
