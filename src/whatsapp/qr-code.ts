// FASE 22 — Estrutura para WhatsApp Business por QR Code.
//
// Esta funcionalidade está condicionada à disponibilidade de uma biblioteca
// ou provedor compatível com as regras do projeto. O QR Code é gerado
// temporariamente e o usuário o escaneia com um aplicativo cliente.
//
// NÃO implenteíamos o fluxo de leitura do QR Code em si (depende de SDK
// externo), mas fornecemos a estrutura para:
// - Geração de QR Code temporário com tempo de expiração
// - Estados de sessão (aguardando leitura, autenticando, conectado, desconectado)
// - Isolamento por tenant
// - Tratamento de reconexão e falhas
// - Limitações e riscos documentados

import { v4 as uuidv4 } from 'uuid';

export type WhatsAppQRCodeSession = {
  /** ID único da sessão QR Code */
  sessionId: string;
  /** URL do QR Code (data URI ou caminho para arquivo temporário) */
  qrCodeUrl: string;
  /** Quando o QR Code expira */
  expiresAt: Date;
  /** Quando foi criado */
  createdAt: Date;
  /** Quantas vezes o QR Code foi escaneado */
  scanCount: number;
  /** Quando a sessão foi conectada */
  connectedAt?: Date;
  /** Quando a sessão expirou ou foi encerrada */
  endedAt?: Date;
  /** ID do tenant/usuário autorizado */
  tenantId: string;
  /** Status da sessão */
  status: 'PENDING' | 'SCANNED' | 'CONNECTED' | 'EXPIRED' | 'ENDED';
};

/**
 * Gera um novo session ID para QR Code e a URL associada.
 * O QR Code em si seria gerado por uma biblioteca externa (ex.: qrcode, canvas, etc.).
 *
 * @param tenantId ID do tenant/usuário autorizado
 * @param expiresIn Minutos até expiração (padrão: 15 minutos)
 * @returns Sessão QR Code com URL placeholder para geração externa
 */
export function generateQRCodeSession(
  tenantId: string,
  expiresInMinutes = 15,
): WhatsAppQRCodeSession {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresInMinutes * 60 * 1000);

  return {
    sessionId: uuidv4(),
    qrCodeUrl: `/api/whatsapp/qr/${uuidv4()}`, // Endpoint para servir o QR Code
    expiresAt,
    createdAt: now,
    scanCount: 0,
    status: 'PENDING',
    tenantId,
  };
}

/**
 * Atualiza o estado da sessão QR Code após escaneamento.
 * Em produção real, isso seria chamado pelo frontend após o usuário escanear.
 *
 * @param sessionId ID da sessão
 * @param newStatus Novo status ('SCANNED' | 'CONNECTED' | 'EXPIRED' | 'ENDED')
 * @returns Sessão atualizada
 */
export function updateQRCodeSession(
  sessionId: string,
  newStatus: 'SCANNED' | 'CONNECTED' | 'EXPIRED' | 'ENDED',
): WhatsAppQRCodeSession | null {
  // Em produção real, isto buscaria a sessão do banco/dados e atualizaria o status
  // Por ora, retorna null (implementação dependente de persistencia)
  return null;
}

/**
 * Verifica se uma sessão QR Code expirou.
 *
 * @param session Sessão a ser verificada
 * @returns true se expirou, false caso contrário
 */
function hasQRCodeExpired(session: WhatsAppQRCodeSession): boolean {
  return new Date() > session.expiresAt;
}

/**
 * Monta a resposta para o frontend sobre o estado da sessão QR Code.
 *
 * @param session Sessão atual (poderia ser buscada do banco)
 * @returns Objeto de resposta para o frontend
 */
export function getQRCodeSessionStatus(
  session: WhatsAppQRCodeSession | null,
) {
  if (!session) {
    return {
      status: 'ENDED',
      expired: true,
      qrCodeUrl: null,
      scanCount: 0,
    };
  }

  const expired = hasQRCodeExpired(session);

  return {
    status: expired ? 'EXPIRED' : session.status,
    expired,
    qrCodeUrl: session.qrCodeUrl,
    scanCount: session.scanCount,
    connectedAt: session.connectedAt,
    endedAt: session.endedAt,
  };
}

