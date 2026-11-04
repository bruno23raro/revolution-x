/**
 * POST /api/webhooks/whatsapp/inbound
 *
 * Webhook endpoint para receber mensagens de entrada do WhatsApp (Evolution API).
 *
 * Recebe payload do Evolution API e processa para atualizar leads no funil.
 * O workflow WF-08 no n8n processa a lógica de atualização de status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supa = createServiceRoleClient();

    // Extrair informações da mensagem
    const {
      id,
      timestamp,
      messages,
      contacts,
      instanceName,
    } = body;

    // Processar cada mensagem
    for (const message of messages || []) {
      const from = message.from; // número de quem enviou
      const text = message.body || message.caption || '';
      const messageId = message.id;

      if (!from || !text) continue;

      // Formatar número para E.164
      const formattedPhone = from.replace(/^0+/, '').replace(/^\+/, '');
      const cleanPhone = formattedPhone.startsWith('55')
        ? formattedPhone
        : `55${formattedPhone}`;

      // Verificar se é uma resposta (não mensagem inicial)
      const isNewConversation = !message.isNew;

      // Salvar mensagem na tabela messages
      await supa
        .from('messages')
        .insert({
          organizationId: process.env.HEALTH_MONITOR_ORG_ID,
          contactId: null, // Será vinculado depois
          externalId: messageId,
          body: text,
          fromChannel: 'evolution',
          toContact: cleanPhone,
          direction: 'inbound',
          status: 'received',
          createdAt: new Date(timestamp * 1000).toISOString(),
          updatedAt: new Date().toISOString(),
        });

      // Trigger n8n workflow para processar atualização de status
      const n8nUrl = `${process.env.N8N_URL || 'http://localhost:5678'}/webhook/lead-status-update`;

      try {
        await fetch(n8nUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            organizationId: process.env.HEALTH_MONITOR_ORG_ID,
            contact: cleanPhone,
            message: text,
            messageId,
            timestamp: new Date(timestamp * 1000).toISOString(),
            type: 'message',
            isNewConversation,
            instanceName,
          }),
        });
      } catch (err) {
        console.error('[WhatsApp Inbound] Error triggering n8n:', err);
      }
    }

    return NextResponse.json({ success: true, processed: true });
  } catch (error) {
    console.error('[WhatsApp Inbound] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
