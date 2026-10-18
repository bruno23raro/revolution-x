// FASE 4 — Configuração segura de IA (substituto para localStorage).
// Armazena Base URL e API Key em AgentMemory (DB) com RLS de tenant.
// GET  /api/admin/ai-config → retorna { configured, baseUrl, model } (sem chave)
// POST /api/admin/ai-config { baseUrl, apiKey, model? } → upsert seguro
// DELETE /api/admin/ai-config → remove configuração

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getAllOrganizationMemberships } from '../../../../src/lib/auth';
import { prisma } from '../../../../src/lib/prisma';
import { saveMemory, listMemory, TaskQueueUnavailableError } from '../../../../src/lib/taskQueue';

export const dynamic = 'force-dynamic';

async function requireAdmin(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;
  if (user.role === 'admin' || user.role === 'owner') return user;
  const memberships = await getAllOrganizationMemberships(req);
  const ok = memberships?.some((m) => m.role === 'admin' || m.role === 'owner');
  return ok ? user : null;
}

const CONFIG_KEY = 'ai_config';

export async function GET(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const scope = { organizationId: user.organizationId, userId: user.id };
  try {
    const memories = await listMemory(prisma, scope, 10);
    const config = memories.find((m) => m.key === CONFIG_KEY);
    if (!config) {
      return NextResponse.json({ configured: false, baseUrl: null, model: null });
    }
    const value = config.value as { baseUrl?: string; model?: string };
    return NextResponse.json({
      configured: true,
      baseUrl: value.baseUrl ?? null,
      model: value.model ?? null,
      // apiKey NUNCA é retornado — fica apenas no servidor
    });
  } catch (e) {
    if (e instanceof TaskQueueUnavailableError) {
      return NextResponse.json({ configured: false, detail: e.message }, { status: 503 });
    }
    throw e;
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { baseUrl?: unknown; apiKey?: unknown; model?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const baseUrl = typeof body.baseUrl === 'string' ? body.baseUrl.trim() : '';
  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  const model = typeof body.model === 'string' ? body.model.trim() : '';

  if (!baseUrl || !apiKey) {
    return NextResponse.json(
      { error: 'baseUrl e apiKey são obrigatórios' },
      { status: 400 },
    );
  }

  try {
    new URL(baseUrl);
  } catch {
    return NextResponse.json(
      { error: 'baseUrl precisa ser uma URL válida' },
      { status: 400 },
    );
  }

  const scope = { organizationId: user.organizationId, userId: user.id };
  try {
    await saveMemory(prisma, scope, 'preference' as any, CONFIG_KEY, {
      baseUrl,
      apiKey,
      ...(model ? { model } : {}),
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    if (e instanceof TaskQueueUnavailableError) {
      return NextResponse.json({ detail: e.message }, { status: 503 });
    }
    throw e;
  }
}

export async function DELETE(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const scope = { organizationId: user.organizationId, userId: user.id };
  try {
    await prisma.agentMemory.deleteMany({
      where: {
        organizationId: scope.organizationId,
        userId: scope.userId,
        memoryKey: CONFIG_KEY,
        kind: 'preference',
      },
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    if (e instanceof TaskQueueUnavailableError) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    throw e;
  }
}
