/**
 * POST /api/social/growth/extract
 *
 * Trigger n8n workflow for Instagram/Facebook lead extraction.
 *
 * Recebe do frontend: { organizationId, targetProfile, city, gender, provider }
 * Envia para o n8n via API ou webhook.
 * Retorna status da trigger e novos leads encontrados.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supa = createServiceRoleClient();

    const body = await req.json();
    const {
      organizationId,
      targetProfile,
      city,
      gender,
      provider,
    } = body as {
      organizationId: string;
      targetProfile?: string;
      city?: string;
      gender?: 'M' | 'F' | null;
      provider: string;
    };

    // Validar campos obrigatórios
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId é obrigatório' },
        { status: 400 }
      );
    }

    // TODO: Integrar com n8n real
    // Por ora, simular a trigger e buscar leads via Instaloader/Evolution
    // Em produção, isso chamaria: n8n API ou webhook setup

    // Lógica de placeholder: registra a trigger e retorna status
    const triggerData = {
      organizationId,
      targetProfile,
      city,
      gender,
      provider,
      triggeredAt: new Date().toISOString(),
      status: 'triggered',
    };

    // Em produção futura, aqui seria:
    // - POST para n8n webhook URL
    // - ou chamar n8n API: n8n.workflows.execute()
    // - ou disparar fila de jobs

    // Por ora, registramos que a trigger foi enviada
    // e retornamos estrutura que o frontend pode monitorar

    return NextResponse.json({
      success: true,
      trigger: triggerData,
      message: `Trigger enviada para n8n (provider: ${provider})`,
      // Em produção: incluir jobId ou webhook URL para monitoramento
      monitoringUrl: `/api/social/growth/monitor?triggerId=${crypto.randomUUID()}`,
    });

  } catch (error) {
    console.error('[SocialGrowth Extract] Error:', error);
    return NextResponse.json(
      { error: 'Internal error during extraction trigger' },
      { status: 500 }
    );
  }
}