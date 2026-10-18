// FASE 1 — Templates oficiais de WhatsApp (Cloud API da Meta).
//
//   GET  /api/whatsapp/templates → { ok, templates }        (membro)
//   POST /api/whatsapp/templates → { ok, name }              (admin)
//
// GET lista os templates do escopo do tenant (número/WABA) e guarda um
// snapshot local (melhor esforço). POST cria um template e não lança:
// retorna resultado honesto com código HTTP coerente.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getAllOrganizationMemberships } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveTenantMetaAccess } from '@/integrations/meta/resolveAccess';
import {
  listWhatsAppTemplates,
  createWhatsAppTemplate,
  type TemplateCreateSpec,
} from '@/integrations/meta/whatsappTemplates';
import { saveTemplateSnapshot } from '@/integrations/configStore';

export const dynamic = 'force-dynamic';

const CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'] as const;

async function requireAdmin(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;
  if (user.role === 'admin' || user.role === 'owner') return user;
  const memberships = await getAllOrganizationMemberships(req);
  const ok = memberships?.some((m) => m.role === 'admin' || m.role === 'owner');
  return ok ? user : null;
}

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const resolved = await resolveTenantMetaAccess(user.organizationId);
  if (!resolved.ok) {
    const status = resolved.reason === 'not_connected' ? 409 : 503;
    return NextResponse.json({ ok: false, error: resolved.reason }, { status });
  }

  const result = await listWhatsAppTemplates(resolved.access);
  if (result.ok) {
    const scope = { organizationId: user.organizationId, userId: user.id };
    try {
      await saveTemplateSnapshot(prisma, scope, {
        at: new Date().toISOString(),
        templates: result.templates,
      });
    } catch {
      /* snapshot é melhor esforço — não afeta a listagem */
    }
  }

  const status = result.ok ? 200 : result.error === 'meta_not_configured' ? 503 : 502;
  return NextResponse.json(
    { ok: result.ok, templates: result.templates, error: result.error, detail: result.errorDetail },
    { status },
  );
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, any>;
  try {
    body = (await req.json()) as Record<string, any>;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 });
  }

  const name = String(body.name ?? '').trim();
  if (!name) return NextResponse.json({ ok: false, error: 'name_vazio' }, { status: 400 });
  const category = (CATEGORIES as readonly string[]).includes(body.category)
    ? (body.category as TemplateCreateSpec['category'])
    : undefined;

  const spec: TemplateCreateSpec = {
    name,
    category,
    language: typeof body.language === 'string' && body.language.trim() ? body.language : undefined,
    body: typeof body.body === 'string' ? body.body : undefined,
  };

  const resolved = await resolveTenantMetaAccess(user.organizationId);
  if (!resolved.ok) {
    const status = resolved.reason === 'not_connected' ? 409 : 503;
    return NextResponse.json({ ok: false, error: resolved.reason }, { status });
  }

  const result = await createWhatsAppTemplate(resolved.access, spec);
  const status = result.ok ? 200 : result.error === 'meta_not_configured' ? 503 : 502;
  return NextResponse.json(
    { ok: result.ok, name: result.name, error: result.error, detail: result.errorDetail },
    { status },
  );
}
