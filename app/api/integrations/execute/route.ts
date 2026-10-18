// FASE 3 · slice 3 — Execução de saída do Hub de Integrações.
//
//   POST /api/integrations/execute
//   body: { provider: 'n8n'|'zapier'|'make'|'webhook_outbound',
//           event?: string, payload?: object, test?: boolean }
//
// Envia um evento estruturado para a automação do tenant (config no
// AgentMemory, RLS de usuário). Só admin/owner (mesmo gate da rota de config).
// O resultado é HONESTO: falha de execução externa volta com ok:false no 200
// (estado transitório), enquanto estado fixável do usuário volta 409/400.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getAllOrganizationMemberships } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TaskQueueUnavailableError } from '@/lib/taskQueue';
import { getProviderConfig } from '@/integrations/configStore';
import { executeOutbound, OUTBOUND_PROVIDER_IDS, type OutboundProviderId } from '@/integrations/outboundExecutors';

export const dynamic = 'force-dynamic';

async function requireAdmin(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;
  if (user.role === 'admin' || user.role === 'owner') return user;
  const memberships = await getAllOrganizationMemberships(req);
  const ok = memberships?.some((m) => m.role === 'admin' || m.role === 'owner');
  return ok ? user : null;
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { provider?: unknown; event?: unknown; payload?: unknown; test?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const provider = typeof body.provider === 'string' ? body.provider : '';
  const isOutbound = (OUTBOUND_PROVIDER_IDS as readonly string[]).includes(provider);
  if (!isOutbound) {
    return NextResponse.json(
      { error: `provedor não executa saída: ${provider} (esperado: ${OUTBOUND_PROVIDER_IDS.join(', ')})` },
      { status: 400 },
    );
  }

  const test = body.test === true;
  const event = test ? 'revolution-x.test' : (typeof body.event === 'string' ? body.event : 'custom').slice(0, 64);
  const payload = test ? { message: 'teste do hub de integrações' } : body.payload;

  const scope = { organizationId: user.organizationId, userId: user.id };
  let value: Record<string, unknown> | null;
  try {
    value = await getProviderConfig(prisma, scope, provider);
  } catch (e) {
    if (e instanceof TaskQueueUnavailableError) {
      return NextResponse.json({ detail: e.message }, { status: 503 });
    }
    throw e;
  }

  const result = await executeOutbound(
    provider as OutboundProviderId,
    value,
    event,
    payload as Record<string, unknown> | undefined,
    { organizationId: user.organizationId },
  );

  // Estado fixável pelo usuário (config ausente/alvo inválido) → 409.
  if (result.error === 'not_configured' || result.error === 'invalid_target') {
    return NextResponse.json({ ok: false, provider, error: result.error, detail: result.errorDetail }, { status: 409 });
  }
  // Evento/payload malformados pelo chamador → 400.
  if (result.error === 'invalid_event' || result.error === 'payload_too_large') {
    return NextResponse.json({ ok: false, provider, error: result.error, detail: result.errorDetail }, { status: 400 });
  }
  // Falha transitória externa (HTTP do alvo, timeout, rede, fetch) → 200 honesto.
  return NextResponse.json({
    ok: result.ok,
    provider,
    httpStatus: result.httpStatus,
    error: result.error,
    detail: result.errorDetail,
  });
}
