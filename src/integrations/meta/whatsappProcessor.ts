// src/integrations/meta/whatsappProcessor.ts
// Processa mensagens WhatsApp recebidas via webhook Meta.
// O tenant (organizationId) é resolvido pelo chamador (route.ts) via meta_integrations.
//
// Schema (FASE 12):
//   Contact.waId      — WhatsApp account ID (wa_id do Meta API)
//   Message.contactId — FK para Contact
//   Message.externalId — WAMID ou outro identificador da mensagem Meta
//   Message.direction — 'inbound' | 'outbound'
//   Message.status    — 'received' | 'sent' | 'delivered' | 'read'
//
// SECURITY: this processor receives a Prisma.TransactionClient that has already
// had app.current_org set inside a transaction. It must NOT fall back to the
// global singleton — that would bypass RLS when the production connection role
// is later switched to a restricted non-BYPASSRLS user.
import type { Prisma } from '@prisma/client';

export interface WhatsAppMessageResult {
  success: boolean;
  error?: string;
  contactId?: string;
  messageId?: string;
}

/**
 * Processa payload validado do webhook Meta.
 * Não valida HMAC — isso é responsabilidade do webhook route.
 *
 * @param payload - Payload já validado (estrutura Meta)
 * @param organizationId - Tenant já resolvido (viola multi-tenant se ausente)
 * @param tx - Prisma.TransactionClient com app.current_org configurado pela transação外层
 */
export async function processWhatsAppPayload(
  payload: unknown,
  organizationId: string,
  tx: Prisma.TransactionClient
): Promise<WhatsAppMessageResult[]> {
  const results: WhatsAppMessageResult[] = [];

  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as Record<string, unknown>).entry)) {
    return [{ success: false, error: 'invalid_payload_structure' }];
  }

  const p = payload as { entry: any[] };

  for (const entry of p.entry) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as { changes: any[] };
    if (!Array.isArray(e.changes)) continue;

    for (const change of e.changes) {
      if (!change || typeof change !== 'object') continue;
      const c = change as { value: any };
      const value = c.value;
      if (!value || typeof value !== 'object') continue;

      // Só processa mensagens (ignora status updates, etc.)
      const v = value as { messages?: any[]; contacts?: any[] };
      if (!Array.isArray(v.messages) || v.messages.length === 0) continue;

      // Perfil do remetente (disponível em event Meta v14+)
      const contacts = Array.isArray(v.contacts) ? v.contacts : [];
      const profileName: string =
        (contacts[0] as { profile?: { name?: string } })?.profile?.name || '';

      for (const rawMsg of v.messages) {
        if (!rawMsg || typeof rawMsg !== 'object') continue;
        const msg = rawMsg as Record<string, unknown>;
        const waId: string | undefined = msg.from as string | undefined;
        if (!waId) {
          results.push({ success: false, error: 'missing_wa_id' });
          continue;
        }

        const textBody: string = ((msg.text as Record<string, unknown>)?.body as string) || '';
        const msgTimestamp: Date = msg.timestamp
          ? new Date(parseInt(msg.timestamp as string, 10) * 1000)
          : new Date();
        const wamid: string | undefined = msg.id as string | undefined;

        // --- Localizar ou criar Contact (sempre dentro do tenant) ---
        let contactId: string | null = null;

        try {
          let contact = await tx.contact.findFirst({
            where: {
              organizationId,
              waId,
            },
            select: { id: true },
          });

          if (!contact) {
            const name = profileName || `WhatsApp ${waId}`;
            contact = await tx.contact.create({
              data: {
                organizationId,
                name,
                waId,
                // email deixado null para WhatsApp-only contacts
                email: null,
              },
              select: { id: true },
            });
          }

          contactId = contact.id;
        } catch (err) {
          console.error('[whatsapp-processor] contact op failed:', (err as Error).message);
          results.push({ success: false, error: 'contact_operation_failed' });
          continue;
        }

        // --- Persistir Message ---
        try {
          const createdMessage = await tx.message.create({
            data: {
              organizationId,
              contactId,
              externalId: wamid ?? null,
              body: textBody,
              fromChannel: 'whatsapp',
              toContact: waId,
              direction: 'inbound',
              status: 'received',
              createdAt: msgTimestamp,
            },
            select: { id: true },
          });

          results.push({
            success: true,
            contactId: contactId!,
            messageId: createdMessage.id,
          });
        } catch (err) {
          console.error('[whatsapp-processor] message create failed:', (err as Error).message);
          results.push({ success: false, error: 'message_create_failed' });
        }
      }
    }
  }

  return results;
}
