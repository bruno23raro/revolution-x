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
  async sendMessage(msg: WhatsAppMessage): Promise<{ sent: boolean; messageId: string }> {
    console.log("[MOCK WhatsApp] Enviado para:", msg.to, "— corpo:", msg.body.substring(0, 60));
    return { sent: true, messageId: "mock_" + Date.now() };
  }
  async getStatus(id: string): Promise<{ delivered: boolean; read: boolean }> {
    return { delivered: true, read: true };
  }
}
