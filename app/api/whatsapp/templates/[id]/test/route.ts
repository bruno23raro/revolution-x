// FASE 5.0 — Envio de mensagem de teste para template de WhatsApp Cloud API v19.0
//
//   POST /api/whatsapp/templates/[id]/test → { ok, messageId, detail }
//
// Envia uma mensagem de teste usando um template aprovado.
// Apenas templates com status APPROVED podem enviar testes.

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveTenantMetaAccess } from '@/integrations/meta/resolveAccess';
import { sendTestMessage } from '@/integrations/meta/whatsappTemplates';
import { rateLimit } from '@/middleware/rate-limit';

export const dynamic = 'force-dynamic';

async function requireAdmin(req: NextRequest) {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user) return null;
  if (user.role === 'admin' || user.role === 'owner') return user;
  return null;
}

export async function POST(req: NextRequest, context: { params: { id: string } }) {
  // Só admin pode enviar mensagens de teste
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  // Rate limiting - 10 testes/min por usuário
  const rateResult = await rateLimit(req, 'api', { windowMs: 60000, max: 10 });
  if (rateResult.limited) {
    return NextResponse.json(
      { ok: false, error: 'Rate limit excedido', rateLimit: { remaining: 0, resetIn: rateResult.resetIn } },
      { status: 429 }
    );
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

  // Só pode enviar teste se estiver APROVADO
  if (template.status !== 'APPROVED') {
    return NextResponse.json({
      ok: false,
      error: 'Template não aprovado',
      detail: `Status atual: ${template.status}. Aguardando aprovação da Meta.`
    }, { status: 400 });
  }

  // Parsear body
  let body: { to: string; variables?: string[]; language?: string };
  try {
    body = (await req.json()) as { to: string; variables?: string[]; language?: string };
  } catch {
    const response = NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 });
    response.headers.set('X-RateLimit-Remaining', String(rateResult.remaining));
    return response;
  }

  if (!body.to || body.to.trim().length === 0) {
    const response = NextResponse.json({ ok: false, error: 'Campo "to" é obrigatório' }, { status: 400 });
    response.headers.set('X-RateLimit-Remaining', String(rateResult.remaining));
    return response;
  }

  // Resolver acesso Meta
  const resolved = await resolveTenantMetaAccess(user.organizationId);
  if (!resolved.ok) {
    const response = NextResponse.json({ ok: false, error: resolved.reason }, { status: 503 });
    response.headers.set('X-RateLimit-Remaining', String(rateResult.remaining));
    return response;
  }

  // Enviar mensagem de teste
  const variables = body.variables || [];
  // Meta espera códigos de idioma no formato xx_XX (ex: en_US, pt_BR)
  const VALID_LANGUAGES = /^([a-z]{2})_([A-Z]{2})$/;
  const language = body.language?.trim();
  if (language && !VALID_LANGUAGES.test(language)) {
    const response = NextResponse.json(
      { ok: false, error: 'Idioma inválido', detail: 'Use formato xx_XX (ex: en_US, pt_BR)' },
      { status: 400 }
    );
    response.headers.set('X-RateLimit-Remaining', String(rateResult.remaining));
    return response;
  }
  const result = await sendTestMessage(
    resolved.access,
    template.name,
    body.to,
    variables,
    { language: language || 'en_US' },
  );

  const response = NextResponse.json(
    {
      ok: result.ok,
      messageId: result.messageId,
      error: result.error,
      errorDetail: result.errorDetail,
      detail: result.ok ? 'Mensagem de teste enviada com sucesso' : result.errorDetail,
    },
    { status: result.ok ? 200 : 500 }
  );
  response.headers.set('X-RateLimit-Remaining', String(rateResult.remaining));
  return response;
}