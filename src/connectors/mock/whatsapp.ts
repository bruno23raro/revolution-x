// MOCK — WhatsApp Business API (não precisa de chave para rodar)
// Quando tiver token real, crie WhatsAppRealAdapter usando esta mesma interface

export interface WhatsAppMessage {
  to: string;
  body: string;
  mediaUrl?: string;
}

export interface WhatsAppAdapter {
  sendMessage(msg: WhatsAppMessage): Promise<{ sent: boolean; messageId?: string }>;
  getStatus(messageId: string): Promise<{ delivered: boolean; read: boolean }>;
}

export class WhatsAppMockAdapter implements WhatsAppAdapter {
  async sendMessage(msg: WhatsAppMessage): Promise<{ sent: boolean; messageId?: string }> {
    // Verificar se OpenBSP ou Meta Whapp Cloud estão configurados
    const hasOpenBSP = !!process.env.OPENBSP_API_KEY;
    const hasMeta = !!process.env.META_APP_ID && !!process.env.META_APP_SECRET;

    if (!hasOpenBSP && !hasMeta) {
      // Nenhum provedor real configurado — simular falha temporária
      console.log("[MOCK WhatsApp] Nenhum provedor configurado — simulando falha de serviço");
      return { sent: false };
    }

    console.log("[MOCK WhatsApp] Enviado para:", msg.to, "— corpo:", msg.body.substring(0, 60));
    const mid = "mock_" + Date.now();
    return { sent: true, messageId: mid };
  }
  async getStatus(id: string): Promise<{ delivered: boolean; read: boolean }> {
    // Simular status variável baseado no ID (determinístico para testes)
    const hash = id.split('_').reduce((a, b) => a + b.length, 0);
    const delivered = hash % 3 !== 0; // 2/3 chance de delivered
    const read = hash % 4 !== 0;     // 3/4 chance de read
    return { delivered, read };
  }
}
