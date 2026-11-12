// Processamento de webhook de template WhatsApp
// Atualiza o status de templates quando a Meta muda o estado (PENDING -> APPROVED/REJECTED)

import { prisma } from '@/lib/prisma';
import type { WhatsappTemplate } from '@/types';

export async function processTemplateStatusUpdate(
  organizationId: string,
  payload: Record<string, unknown>,
  tx: any,
): Promise<{ success: boolean; template?: WhatsappTemplate; error?: string }> {
  try {
    // Extrair informações do webhook
    const entry = (payload.entry || [])[0] as Record<string, unknown> | undefined;
    const field = (entry?.field as string) ?? '';

    if (field !== 'message_templates') {
      return { success: false, error: 'Não é um webhook de template' };
    }

    const change = (entry?.changes || [])[0] as Record<string, unknown> | undefined;
    const value = (change?.value || {}) as Record<string, unknown>;

    // Extrair dados do template
    const templateName = typeof value.name === 'string' ? value.name : null;
    const language = value.language as { code?: string } | undefined;
    const templateLanguage = typeof language?.code === 'string' ? language.code : 'en_US';
    const newStatus = typeof value.status === 'string' ? value.status : 'PENDING';
    const rejectionReason = typeof value.rejection_reason === 'string' ? value.rejection_reason : null;
    const metaTemplateId = typeof value.id === 'string' ? value.id : null;

    if (!templateName) {
      return { success: false, error: 'Nome do template não encontrado no payload' };
    }

    // Buscar template existente
    const existingTemplate = await tx.whatsapp_template.findFirst({
      where: {
        organizationId,
        name: templateName,
        language: templateLanguage,
      },
    });

    if (!existingTemplate) {
      console.log(`[template-webhook] Template ${templateName} não encontrado para atualização - ignorado`);
      return { success: true }; // Não é erro, template pode ser de outro tenant
    }

    // Atualizar status
    const updatedTemplate = await tx.whatsapp_template.update({
      where: { id: existingTemplate.id },
      data: {
        status: newStatus,
        rejectionReason,
        metaTemplateId,
        lastCheckedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log(
      `[template-webhook] Status atualizado: ${templateName} -> ${newStatus}` +
        (rejectionReason ? ` (motivo: ${rejectionReason})` : '')
    );

    return { success: true, template: updatedTemplate };
  } catch (error) {
    console.error('[template-webhook] Erro no processamento:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

// Também processar quality_update para score
export async function processTemplateQualityUpdate(
  organizationId: string,
  payload: Record<string, unknown>,
  tx: any,
): Promise<{ success: boolean; template?: WhatsappTemplate; error?: string }> {
  try {
    const entry = (payload.entry || [])[0] as Record<string, unknown> | undefined;

    if (entry?.field !== 'message_template_quality') {
      return { success: false, error: 'Não é um webhook de qualidade de template' };
    }

    const change = (entry?.changes || [])[0] as Record<string, unknown> | undefined;
    const value = (change?.value || {}) as Record<string, unknown>;

    const templateName = typeof value.name === 'string' ? value.name : null;
    const qualityScore = typeof value.quality_score === 'number' ? value.quality_score : null;

    if (!templateName) return { success: true };

    const existingTemplate = await tx.whatsapp_template.findFirst({
      where: {
        organizationId,
        name: templateName,
      },
    });

    if (existingTemplate && qualityScore !== null) {
      await tx.whatsapp_template.update({
        where: { id: existingTemplate.id },
        data: {
          updatedAt: new Date(),
        },
      });
    }

    return { success: true };
  } catch (error) {
    console.error('[template-webhook] Erro no processamento de qualidade:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}