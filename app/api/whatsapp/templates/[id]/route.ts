// FASE 5.1 — GET individual de template WhatsApp (detalhes completos)
//
//   GET /api/whatsapp/templates/[id] → { ok, template }  (membro)
//
// Retorna os detalhes completos de um template específico incluindo
// componentes (header, body, footer, buttons) e status de aprovação.

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveTenantMetaAccess } from '@/integrations/meta/resolveAccess';
import { getWhatsAppTemplate } from '@/integrations/meta/whatsappTemplates';
import { rateLimit } from '@/middleware/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, context: { params: { id: string } }) {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limiting - 60 req/min por usuário
  const rateResult = await rateLimit(req, 'api', { windowMs: 60000, max: 60 });
  if (rateResult.limited) {
    const response = NextResponse.json(
      { ok: false, error: 'Rate limit excedido', rateLimit: { remaining: 0, resetIn: rateResult.resetIn } },
      { status: 429 }
    );
    response.headers.set('X-RateLimit-Remaining', '0');
    if (rateResult.resetIn > 0) response.headers.set('X-RateLimit-Reset', String(rateResult.resetIn));
    return response;
  }

  const templateId = context.params.id;
  if (!templateId) {
    const response = NextResponse.json({ ok: false, error: 'Template ID é obrigatório' }, { status: 400 });
    response.headers.set('X-RateLimit-Remaining', String(rateResult.remaining));
    return response;
  }

  // Primeiro, buscar no banco local (snapshot)
  const localTemplate = await prisma.whatsappTemplate.findFirst({
    where: {
      id: templateId,
      organizationId: user.organizationId,
    },
  });

  if (!localTemplate) {
    const response = NextResponse.json({ ok: false, error: 'Template não encontrado' }, { status: 404 });
    response.headers.set('X-RateLimit-Remaining', String(rateResult.remaining));
    return response;
  }

  // Construir template com componentes
  const template = {
    id: localTemplate.id,
    name: localTemplate.name,
    language: localTemplate.language,
    category: localTemplate.category,
    status: localTemplate.status,
    componentsJson: localTemplate.componentsJson,
    rejectionReason: localTemplate.rejectionReason,
    metaTemplateId: localTemplate.metaTemplateId,
    lastCheckedAt: localTemplate.lastCheckedAt?.toISOString(),
    createdAt: localTemplate.createdAt.toISOString(),
    updatedAt: localTemplate.updatedAt.toISOString(),
  };

  // Se o template está pendente, buscar detalhes atualizados da Meta
  if (localTemplate.status === 'PENDING' || !localTemplate.metaTemplateId) {
    const resolved = await resolveTenantMetaAccess(user.organizationId);
    if (resolved.ok && resolved.access) {
      try {
        // Usar o metaTemplateId se disponível, senão tentar buscar pelo nome
        const metaResult = await getWhatsAppTemplate(
          resolved.access,
          localTemplate.metaTemplateId || localTemplate.name
        );
        if (metaResult.ok && metaResult.template) {
          // Atualizar com dados da Meta
          template.componentsJson = metaResult.template.components || template.componentsJson;
          template.status = metaResult.template.status || template.status;
          template.rejectionReason = metaResult.template.rejection_reason || template.rejectionReason;
        }
      } catch {
        /* Falha na chamada à Meta — usa dados locais */
      }
    }
  }

  const response = NextResponse.json(
    { ok: true, template },
    { status: 200 }
  );
  response.headers.set('X-RateLimit-Remaining', String(rateResult.remaining));
  if (rateResult.resetIn > 0) response.headers.set('X-RateLimit-Reset', String(rateResult.resetIn));
  return response;
}

// DELETE /api/whatsapp/templates/[id] — Excluir template (admin)
export async function DELETE(req: NextRequest, context: { params: { id: string } }) {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Verificar se é admin
  if (user.role !== 'admin' && user.role !== 'owner') {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limiting - 10 req/min por admin
  const rateResult = await rateLimit(req, 'admin', { windowMs: 60000, max: 10 });
  if (rateResult.limited) {
    const response = NextResponse.json(
      { ok: false, error: 'Rate limit excedido', rateLimit: { remaining: 0, resetIn: rateResult.resetIn } },
      { status: 429 }
    );
    response.headers.set('X-RateLimit-Remaining', '0');
    return response;
  }

  const templateId = context.params.id;
  if (!templateId) {
    const response = NextResponse.json({ ok: false, error: 'Template ID é obrigatório' }, { status: 400 });
    response.headers.set('X-RateLimit-Remaining', String(rateResult.remaining));
    return response;
  }

  // Verificar se o template pertence ao tenant
  const template = await prisma.whatsappTemplate.findFirst({
    where: {
      id: templateId,
      organizationId: user.organizationId,
    },
  });

  if (!template) {
    const response = NextResponse.json({ ok: false, error: 'Template não encontrado' }, { status: 404 });
    response.headers.set('X-RateLimit-Remaining', String(rateResult.remaining));
    return response;
  }

  // Excluir template
  await prisma.whatsappTemplate.delete({
    where: { id: templateId, organizationId: user.organizationId },
  });

  const response = NextResponse.json(
    { ok: true, message: 'Template excluído com sucesso' },
    { status: 200 }
  );
  response.headers.set('X-RateLimit-Remaining', String(rateResult.remaining));
  return response;
}