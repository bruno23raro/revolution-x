// FASE 1 — Configuração de integrações (Hub de Integrações).
// Padrão idêntico ao ai-config: segredos vivem SÓ no banco (AgentMemory, RLS de
// tenant/usuário). GET nunca retorna segredo; POST upsert; DELETE remove.
//
//   GET    /api/integrations/config → { providers: [{ id, configured, updatedAt }] }
//   POST   /api/integrations/config { provider, value } → upsert seguro
//   DELETE /api/integrations/config?provider=x → remove

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getAllOrganizationMemberships } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TaskQueueUnavailableError } from '@/lib/taskQueue';
import {
  saveProviderConfig,
  clearProviderConfig,
  getProviderStatus,
} from '@/integrations/configStore';
import { PROVIDERS, providerById } from '@/integrations/providers';

export const dynamic = 'force-dynamic';

async function requireAdmin(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;
  if (user.role === 'admin' || user.role === 'owner') return user;
  const memberships = await getAllOrganizationMemberships(req);
  const ok = memberships?.some((m) => m.role === 'admin' || m.role === 'owner');
  return ok ? user : null;
}

const ALL_IDS = PROVIDERS.map((p) => p.id);

export async function GET(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const scope = { organizationId: user.organizationId, userId: user.id };
  try {
    const statuses = await getProviderStatus(prisma, scope, ALL_IDS);
    // Nunca devolve o valor (segredos) — apenas se está configurado.
    return NextResponse.json({
      providers: statuses.map((s) => ({
        id: s.provider,
        configured: s.configured,
        updatedAt: s.updatedAt,
      })),
    });
  } catch (e) {
    if (e instanceof TaskQueueUnavailableError) {
      return NextResponse.json(
        { providers: ALL_IDS.map((id) => ({ id, configured: false, updatedAt: null })), detail: e.message },
        { status: 503 },
      );
    }
    throw e;
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { provider?: unknown; value?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const provider = typeof body.provider === 'string' ? body.provider : '';
  const def = providerById(provider);
  if (!def) {
    return NextResponse.json({ error: `provedor desconhecido: ${provider}` }, { status: 400 });
  }

  // Para provedores com campos obrigatórios, valida presença (não valida valor de segredo).
  const value: Record<string, unknown> =
    body.value && typeof body.value === 'object' ? (body.value as Record<string, unknown>) : {};
  const required = def.fields.filter((f) => f.required).map((f) => f.key);
  const missing = required.filter((k) => !value[k]);
  if (missing.length > 0) {
    return NextResponse.json({ error: `campos obrigatórios faltando: ${missing.join(', ')}` }, { status: 400 });
  }

  const scope = { organizationId: user.organizationId, userId: user.id };
  try {
    await saveProviderConfig(prisma, scope, provider, value);
    return NextResponse.json({ ok: true, provider }, { status: 200 });
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

  const provider = new URL(req.url).searchParams.get('provider') ?? '';
  if (!providerById(provider)) {
    return NextResponse.json({ error: `provedor desconhecido: ${provider}` }, { status: 400 });
  }

  const scope = { organizationId: user.organizationId, userId: user.id };
  try {
    await clearProviderConfig(prisma, scope, provider);
    return NextResponse.json({ ok: true, provider }, { status: 200 });
  } catch (e) {
    if (e instanceof TaskQueueUnavailableError) {
      return NextResponse.json({ ok: true, provider }, { status: 200 });
    }
    throw e;
  }
}
