// FASE 1 — Sincronizar template específico da Meta.
//
//   POST /api/whatsapp/templates/[id]/sync → { ok, template }  (admin)
//
// Sincroniza os detalhes de um template específico da Meta Cloud API v19.0.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { resolveTenantMetaAccess } from '@/integrations/meta/resolveAccess';
import { getWhatsAppTemplate, type TemplatesAccess } from '@/integrations/meta/whatsappTemplates';
import { rateLimit } from '@/middleware/rate-limit';

export const dynamic = 'force-dynamic';

async function requireAdmin(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;
  if (user.role === 'admin' || user.role === 'owner') return user;
  return null;
}

export async function POST(req: NextRequest, context: { params: { id: string } }) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  // Rate limiting
  const rateResult = await rateLimit(req, 'admin', { windowMs: 60000, max: 10 });
  if (rateResult.limited) {
    return NextResponse.json(
      { ok: false, error: 'Rate limit excedido', rateLimit: { remaining: 0, resetIn: rateResult.resetIn } },
      { status: 429 }
    );
  }

  const templateId = context.params.id;
  if (!templateId) {
    return NextResponse.json({ ok: false, error: 'Template ID é obrigatório' }, { status: 400 });
  }

  const resolved = await resolveTenantMetaAccess(user.organizationId);
  if (!resolved.ok) {
    const status = resolved.reason === 'not_connected' ? 409 : 503;
    return NextResponse.json({ ok: false, error: resolved.reason }, { status });
  }

  const result = await getWhatsAppTemplate(resolved.access, templateId);

  const response = NextResponse.json(
    { ok: result.ok, template: result.template, error: result.error, errorDetail: result.errorDetail },
    { status: result.ok ? 200 : 502 }
  );
  response.headers.set('X-RateLimit-Remaining', String(rateResult.remaining));
  return response;
}