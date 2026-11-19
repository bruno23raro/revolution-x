// FASE 1 — Templates oficiais de WhatsApp via OpenBSP.
//
//   GET  /api/whatsapp/templates → { ok, templates }        (membro)
//   POST /api/whatsapp/templates → { ok, name }              (admin)
//
// GET lista os templates do escopo do tenant (número/WABA) e guarda um
// snapshot local (melhor esforço). POST cria um template no OpenBSP
// e salva snapshot local. Não lança: retorna resultado honesto com código HTTP coerente.

import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAllOrganizationMemberships } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { saveTemplateSnapshot } from '@/integrations/configStore';
import { whatsappTemplateSchema } from '@/lib/validation/schemas';
import { getChannelDecrypted } from '@/integrations/whatsapp/channelRepo';
import { openbspConfig, createTemplate } from '@/integrations/whatsapp/openbsp/client';
import { upsertTemplateRow, listTemplateRows } from '@/integrations/whatsapp/channelRepo';
import type { CreateTemplateInput } from '@/integrations/whatsapp/openbsp/client';

export const dynamic = 'force-dynamic';

const CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'] as const;

async function requireAdmin(req: NextRequest) {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user) return null;
  if (user.role === 'admin' || user.role === 'owner') return user;
  const memberships = await getAllOrganizationMemberships(req);
  const ok = memberships?.some((m) => m.role === 'admin' || m.role === 'owner');
  return ok ? user : null;
}

export async function GET(req: NextRequest) {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const channel = await getChannelDecrypted(user.organizationId);
  if (!channel || !channel.isOpenBSPConnected) {
    return NextResponse.json(
      { ok: false, error: 'channel_unavailable', detail: 'WhatsApp não conectado via OpenBSP' },
      { status: 409 },
    );
  }

  const localTemplates = await listTemplateRows(user.organizationId);

  const scope = { organizationId: user.organizationId, userId: user.id };
  try {
    await saveTemplateSnapshot(prisma, scope, {
      at: new Date().toISOString(),
      templates: localTemplates,
    });
  } catch {
    /* snapshot é melhor esforço — não afeta a listagem */
  }

  return NextResponse.json(
    { ok: true, templates: localTemplates },
    { status: 200 },
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

  const parsed = whatsappTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_payload', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, language, category, body: templateBody } = parsed.data;

  const channel = await getChannelDecrypted(user.organizationId);
  if (!channel || !channel.isOpenBSPConnected) {
    return NextResponse.json(
      { ok: false, error: 'channel_unavailable', detail: 'WhatsApp não conectado via OpenBSP' },
      { status: 409 },
    );
  }

  const cfg = openbspConfig();
  if (!cfg) {
    return NextResponse.json(
      { ok: false, error: 'openbsp_not_configured', detail: 'OpenBSP não configurado no servidor' },
      { status: 503 },
    );
  }

  const components: CreateTemplateInput['components'] = [
    { type: 'BODY', text: templateBody ?? '' },
  ];

  const input: CreateTemplateInput = {
    name,
    language: language?.trim() ?? 'pt_BR',
    category: (category as CreateTemplateInput['category']) ?? 'UTILITY',
    components,
  };

  const result = await createTemplate(cfg, input);

  if (!result.ok) {
    const status = result.error === 'openbsp_not_configured' ? 503 : result.error ? 502 : 500;
    return NextResponse.json(
      { ok: false, error: result.error, detail: result.errorDetail },
      { status },
    );
  }

  const templateRow = {
    organizationId: user.organizationId,
    name: result.data!.name,
    language: result.data!.language,
    category: result.data!.category,
    status: result.data!.status,
    metaTemplateId: result.data!.id,
    componentsJson: result.data!.components,
    rejectionReason: result.data!.rejection_reason ?? null,
  };

  await upsertTemplateRow(templateRow);

  return NextResponse.json(
    { ok: true, name: result.data!.name, templateId: result.data!.id },
    { status: 200 },
  );
}