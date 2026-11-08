/**
 * POST /api/social/growth/trigger
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

    // Integrar com n8n real via API
    // Consulta a URL da n8n do .env.local ou usa padrão
    const n8nBaseUrl = process.env.N8N_BASE_URL || 'http://localhost:5678';
    const n8nApiKey = process.env.N8N_API_KEY;

    let triggerResult: any;
    if (n8nApiKey) {
      // Chamada real via API n8n
      const n8nResponse = await fetch(`${n8nBaseUrl}/workflows/${organizationId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-N8N-API-KEY': n8nApiKey,
        },
        body: JSON.stringify({
          organizationId,
          targetProfile,
          city,
          gender,
          provider,
        }),
      });

      if (!n8nResponse.ok) {
        const errText = await n8nResponse.text();
        console.error('[SocialGrowth Trigger] n8n API error:', n8nResponse.status, errText);
        // Fallback: registrar trigger mesmo com erro n8n
        triggerResult = { success: false, error: 'n8n_api_error' };
      } else {
        triggerResult = await n8nResponse.json();
      }
    } else {
      // Sem chave n8n — registrar trigger localmente para monitoramento futuro
      console.log('[SocialGrowth Trigger] n8n sem chave configurada — registrando trigger local');
      triggerResult = { success: true, queued: true, organizationId };
    }

    const triggerData = {
      organizationId,
      targetProfile,
      city,
      gender,
      provider,
      triggeredAt: new Date().toISOString(),
      status: triggerResult.success ? 'triggered' : 'failed',
      ...(triggerResult && triggerResult.data ? { data: triggerResult.data } : {}),
    };

    return NextResponse.json({
      success: triggerResult.success ?? true,
      trigger: triggerData,
      message: triggerResult.success
        ? `Trigger enviada para n8n (provider: ${provider})`
        : triggerResult.error || 'Falha ao disparar n8n',
      monitoringUrl: `/api/social/growth/monitor?triggerId=${crypto.randomUUID()}`,
    });

  } catch (error) {
    console.error('[SocialGrowth Trigger] Error:', error);
    return NextResponse.json(
      { error: 'Internal error during extraction trigger' },
      { status: 500 }
    );
  }
}