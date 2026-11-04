/**
 * POST /api/social/growth/send
 *
 * Send WhatsApp messages to selected leads via Evolution API.
 *
 * Recebe do frontend: { organizationId, selectedLeads, messageText, targetInstance }
 * Para cada lead: chama Evolution API sendMessage endpoint
 * Atualiza status do lead no Supabase (pending → sent/failed)
 * Retorna contagem de enviados/failed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { formatE164 } from '@/services/evolution/EvolutionService';

/**
 * Delay aleatório anti-ban (1–5s) entre envios via Evolution API.
 * O fundo de 1s evita banimentos por disparo em burst; o jitter (0–4s)
 * quebra padrões previsíveis que o WhatsApp deteciona como comportamento de bot.
 */
async function antiBanDelay(): Promise<void> {
  const ms = 1000 + Math.floor(Math.random() * 4000);
  await new Promise(resolve => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  try {
    const supa = createServiceRoleClient();

    const body = await req.json();
    const {
      organizationId,
      selectedLeads, // array de strings (números de telefone)
      messageText,
      targetInstance,
    } = body as {
      organizationId: string;
      selectedLeads: string[];
      messageText: string;
      targetInstance?: string;
    };

    // Validar campos obrigatórios
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId é obrigatório' },
        { status: 400 }
      );
    }

    if (!selectedLeads || selectedLeads.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum lead selecionado' },
        { status: 400 }
      );
    }

    if (!messageText.trim()) {
      return NextResponse.json(
        { error: 'Mensagem vazia' },
        { status: 400 }
      );
    }

    const evolution = new (await import('@/services/evolution/EvolutionService')).EvolutionService();

    let sentCount = 0;
    let failedCount = 0;

    // Processar em lotes de 50 para evitar rate limiting do Evolution API
    const batchSize = 50;

    for (let i = 0; i < selectedLeads.length; i += batchSize) {
      const batch = selectedLeads.slice(i, i + batchSize);

      const promises = batch.map(async (contact) => {
        try {
          // Delay anti-ban antes de cada envio individual
          await antiBanDelay();

          const formattedPhone = formatE164(contact);

          const payload = {
            instanceName: targetInstance || 'default',
            to: formattedPhone,
            text: messageText,
            kind: 'text' as const,
          };

          const result = await evolution.sendMessage(payload);

          // Atualizar status no banco dependendo do resultado
          if (result.success) {
            await supa
              .from('growth_leads')
              .update({ status: 'sent', updatedAt: new Date().toISOString() })
              .eq('organizationId', organizationId)
              .eq('contact', formattedPhone);
            sentCount++;
          } else {
            await supa
              .from('growth_leads')
              .update({ status: 'failed', updatedAt: new Date().toISOString(), error: result.error })
              .eq('organizationId', organizationId)
              .eq('contact', formattedPhone);
            failedCount++;
          }
        } catch (e) {
          failedCount++;
          console.error(`[SocialGrowth Send] Error for contact ${contact}:`, e);
        }
      });

      await Promise.all(promises);

      // Pausa entre lotes para evitar banimentos/rate limiting
      if (i + batchSize < selectedLeads.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return NextResponse.json({
      success: true,
      sentCount,
      failedCount,
      total: selectedLeads.length,
      message: `Enviados: ${sentCount}, Falhas: ${failedCount}`,
    });

  } catch (error) {
    console.error('[SocialGrowth Send] Error:', error);
    return NextResponse.json(
      { error: 'Internal error during WhatsApp send' },
      { status: 500 }
    );
  }
}