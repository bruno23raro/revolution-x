// FASE 1 — Health check das integrações.
// Para cada provedor, roda a sonda declarada (endpoint = GET real; keys =
// presença de campos; none/OAuth = skip). Valores (com segredos) ficam apenas
// no servidor; a resposta tem só o estado, nunca o segredo.
//
//   GET /api/integrations/health → { health: [{ provider, status, detail }], at }

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getAllOrganizationMemberships } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TaskQueueUnavailableError } from '@/lib/taskQueue';
import { getProviderConfig } from '@/integrations/configStore';
import { PROVIDERS, probeMany } from '@/integrations/providers';

export const dynamic = 'force-dynamic';

async function requireAdmin(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;
  if (user.role === 'admin' || user.role === 'owner') return user;
  const memberships = await getAllOrganizationMemberships(req);
  const ok = memberships?.some((m) => m.role === 'admin' || m.role === 'owner');
  return ok ? user : null;
}

export async function GET(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const scope = { organizationId: user.organizationId, userId: user.id };
  try {
    // Lê os valores (com segredo) no servidor — apenas para sondar, não para responder.
    const values: Record<string, Record<string, unknown> | null> = {};
    for (const def of PROVIDERS) {
      values[def.id] = await getProviderConfig(prisma, scope, def.id);
    }
    const health = await probeMany(PROVIDERS, values);
    return NextResponse.json({ health, at: new Date().toISOString() });
  } catch (e) {
    if (e instanceof TaskQueueUnavailableError) {
      return NextResponse.json({ health: [], detail: e.message }, { status: 503 });
    }
    throw e;
  }
}
