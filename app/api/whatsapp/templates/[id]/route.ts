// FASE 5.1 — GET individual de template WhatsApp (detalhes completos) via OpenBSP
//
//   GET /api/whatsapp/templates/[id] → { ok, template }  (membro)
//
// Retorna os detalhes completos de um template específico incluindo
// componentes (header, body, footer, buttons) e status de aprovação.

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/middleware/rate-limit';
import { getChannelDecrypted } from '@/integrations/whatsapp/channelRepo';
import { openbspConfig, getTemplateStatus, editTemplate, deleteTemplate } from '@/integrations/whatsapp/openbsp/client';

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
    response.headers.set('X-RateLimit-Remaining', '0');
    return response;
  }
  if (!templateId) {
    const response = NextResponse.json({ ok: false, error: 'Template ID é obrigatório' }, { status: 400 });
    response.headers.set('X-RateLimit-Remaining', String(rateResult.remaining));
    return response;
  }

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

  let template = {
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

  // Se o template está pendente ou não tem metaTemplateId, buscar status no OpenBSP
  if (localTemplate.status === 'PENDING' || !localTemplate.metaTemplateId) {
    const channel = await getChannelDecrypted(user.organizationId);
    if (channel?.isOpenBSPConnected) {
      const cfg = openbspConfig();
      if (cfg) {
        try {
          const metaResult = await getTemplateStatus(cfg, localTemplate.name, localTemplate.language);
          if (metaResult.ok && metaResult.data) {
            template.componentsJson = metaResult.data.components || template.componentsJson;
            template.status = metaResult.data.status || template.status;
            template.rejectionReason = metaResult.data.rejection_reason || template.rejectionReason;
            template.metaTemplateId = metaResult.data.id || template.metaTemplateId;

            await prisma.whatsappTemplate.update({
              where: { id: templateId, organizationId: user.organizationId },
              data: {
                status: metaResult.data.status,
                componentsJson: metaResult.data.components,
                rejectionReason: metaResult.data.rejection_reason,
                metaTemplateId: metaResult.data.id,
                lastCheckedAt: new Date(),
                updatedAt: new Date(),
              },
            });
          }
        } catch {
          /* Falha na chamada ao OpenBSP — usa dados locais */
        }
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

// PATCH /api/whatsapp/templates/[id] — Atualizar template (admin)
export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
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

  let body: Record<string, any>;
  try {
    body = (await req.json()) as Record<string, any>;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 });
  }

  const channel = await getChannelDecrypted(user.organizationId);
  if (channel?.isOpenBSPConnected && channel.phoneNumberId) {
    const cfg = openbspConfig();
    if (cfg) {
      const categoryValue = (template.category ?? 'UTILITY') as 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
      const components = template.componentsJson
        ? (Array.isArray(template.componentsJson)
          ? template.componentsJson.map((c: any) => ({ type: c.type, text: c.text, buttons: c.buttons }))
          : [])
        : [{ type: 'BODY', text: template.componentsJson?.[0]?.text || '' }];
      const input = {
        name: template.name,
        language: template.language,
        category: categoryValue as 'MARKETING' | 'UTILITY' | 'AUTHENTICATION',
        components,
      };
      await editTemplate(cfg, user.organizationId, channel.phoneNumberId, input);
    }
  }

  // Atualizar localmente
  const updateData: Record<string, any> = {};
  if (body.status) updateData.status = body.status;
  if (body.componentsJson !== undefined) updateData.componentsJson = body.componentsJson;
  if (body.rejectionReason !== undefined) updateData.rejectionReason = body.rejectionReason;

  if (Object.keys(updateData).length > 0) {
    await prisma.whatsappTemplate.update({
      where: { id: templateId, organizationId: user.organizationId },
      data: updateData,
    });
  }

  const response = NextResponse.json(
    { ok: true, template: { id: template.id, ...updateData } },
    { status: 200 }
  );
  response.headers.set('X-RateLimit-Remaining', String(rateResult.remaining));
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

  // Excluir do OpenBSP e localmente
  const channel = await getChannelDecrypted(user.organizationId);
  if (channel?.isOpenBSPConnected && channel.phoneNumberId) {
    const cfg = openbspConfig();
    if (cfg) {
      const categoryValue = (template.category ?? 'UTILITY') as 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
      const components = template.componentsJson
        ? (Array.isArray(template.componentsJson)
          ? template.componentsJson.map((c: any) => ({ type: c.type, text: c.text, buttons: c.buttons }))
          : [])
        : [{ type: 'BODY', text: template.componentsJson?.[0]?.text || '' }];
      const input = {
        name: template.name,
        language: template.language,
        category: categoryValue as 'MARKETING' | 'UTILITY' | 'AUTHENTICATION',
        components,
      };
      await deleteTemplate(cfg, user.organizationId, channel.phoneNumberId, input);
    }
  }

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