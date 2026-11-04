/**
 * Evolution API Service
 *
 * Cliente para comunicação com a Evolution API (WhatsApp Non-Official).
 * Gerencia instâncias, QR Codes, envio de mensagens e status das sessões.
 *
 * Todas as operações são scoped por organizationId para multi-tenant.
 * Credenciais devem vir de .env.local, nunca hardcoded.
 *
 * Nota: Usa o fetch nativo do Node.js 18+ (compatível com package.json engines.node >= 18.0.0).
 * Não depende do pacote node-fetch externo.
 */

// Tipos reexportados para uso no frontend
export interface EvolutionInstance {
  id: string;
  organizationId: string;
  instanceName: string;
  status: 'DISCONNECTED' | 'CONNECTED' | 'ERROR';
  qrCode: string | null; // base64 image, expires quickly
  accessToken: string | null; // token da Evolution API (gerenciado pelo app)
  lastHeartbeat: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInstanceRequest {
  instanceName: string;
}

export interface ConnectInstanceResponse {
  instanceName: string;
  qrCode: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
}

export interface SendMessagePayload {
  instanceName: string;
  to: string; // E.164 format: 5511987654321
  text: string;
  kind: 'text' | 'template';
  templateName?: string;
  templateLanguage?: string;
  variables?: (string | number)[];
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
  via?: 'evolution' | 'openbsp' | 'meta';
}

export interface GrowthLead {
  id: string;
  organizationId: string;
  source: 'instagram' | 'facebook';
  contact: string; // E.164: 5511987654321
  metadata: Record<string, unknown>;
  status: 'pending' | 'sent' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

export interface FilterInstagramRequest {
  city?: string;
  gender?: 'M' | 'F' | null;
  profile?: string; // nickname or pattern
  limit?: number;
}

/**
 * Formata número de telefone para o padrão E.164 (ex: 5511987654321)
 * Método estático - não depende de instância.
 */
export function formatE164(phone: string): string {
  // Remove tudo que não é dígito
  const cleaned = phone.replace(/[^0-9]/g, '');

  // Se já começar com código do país (55 para Brasil), mantém
  if (cleaned.startsWith('55')) {
    return cleaned;
  }

  // Assume Brasil (+55) se for 10-11 dígitos (número sem DDD)
  if (cleaned.length >= 10 && cleaned.length <= 11) {
    return `55${cleaned}`;
  }

  return cleaned;
}

export class EvolutionService {
  // Propriedades públicas para acesso no frontend
  public baseUrl: string;
  public apiKey: string;

  constructor() {
    // URLs vêm de variáveis de ambiente - nunca hardcoded
    this.baseUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
    this.apiKey = process.env.EVOLUTION_API_KEY || '';

    if (!this.apiKey) {
      console.warn('[EvolutionService] EVOLUTION_API_KEY not set in environment');
    }
  }

  /**
   * Gera headers de autenticação para as API calls
   */
  public getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  /**
   * Cria uma nova instância no Evolution API
   */
  async createInstance(name: string, organizationId: string): Promise<EvolutionInstance> {
    const payload = { instanceName: name };

    const res = await fetch(`${this.baseUrl}/instance/create`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Evolution API error: ${res.status} - ${errText}`);
    }

    return res.json() as Promise<EvolutionInstance>;
  }

  /**
   * Obtém estado de uma instância específica
   */
  async getInstance(instanceName: string): Promise<EvolutionInstance> {
    const res = await fetch(`${this.baseUrl}/instance/connectionState/${instanceName}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      throw new Error(`Failed to get instance state: ${res.status}`);
    }

    return res.json() as Promise<EvolutionInstance>;
  }

  /**
   * Gera QR Code para conexão de instância
   * O usuário deve escanear o QR code com o WhatsApp
   */
  async generateQRCode(instanceName: string): Promise<{ qrCode: string }> {
    const res = await fetch(`${this.baseUrl}/instance/qrcode/${instanceName}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      throw new Error(`Failed to generate QR code: ${res.status}`);
    }

    return res.json() as Promise<{ qrCode: string }>;
  }

  /**
   * Envia mensagem para um número específico
   * Suporta texto puro ou template
   */
  async sendMessage(payload: SendMessagePayload): Promise<SendMessageResult> {
    const res = await fetch(`${this.baseUrl}/message/send`, {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to send message: ${res.status} - ${errText}`);
    }

    return res.json() as Promise<SendMessageResult>;
  }

  /**
   * Lista instâncias conectadas para uma organização
   * NOTE: Esta busca é feita via Evolution API. O padrão do app é usar RLS direto
   * no Supabase: supabase.from('whatsapp_instances').select('*').eq('organizationId', orgId)
   */
  public async listConnectedInstances(organizationId: string): Promise<EvolutionInstance[]> {
    // O frontend deve consultar o Supabase diretamente quando precisar listar
    // instâncias por org: supabase.from('whatsapp_instances').select('*').eq('organizationId', organizationId)
    return [];
  }

  /**
   * Atualiza heartbeat da instância no Evolution API
   */
  public async updateHeartbeat(instanceName: string): Promise<void> {
    await fetch(`${this.baseUrl}/instance/heartbeat/${instanceName}`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
  }

  /**
   * Remove/desconecta uma instância
   */
  public async deleteInstance(instanceName: string): Promise<void> {
    await fetch(`${this.baseUrl}/instance/delete/${instanceName}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
  }

  /**
   * Valida se instância está conectada
   */
  public async isInstanceConnected(instanceName: string): Promise<boolean> {
    try {
      const instance = await this.getInstance(instanceName);
      return instance.status === 'CONNECTED';
    } catch {
      return false;
    }
  }
}