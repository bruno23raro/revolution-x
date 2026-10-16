// FASE AGENT — Phase 2: memória persistente do projeto/tenant (§7).
// GET  /api/admin/memory?kind=&limit=  → lista memórias ativas (user-scoped)
// POST /api/admin/memory {kind, key, value} → upsert
//
// Escopo: sempre o usuário autenticado dentro do seu tenant. Não há forma
// de ler/escrever a memória de outro usuário ou de outro tenant.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getAllOrganizationMemberships } from '../../../../src/lib/auth';
import { prisma } from '../../../../src/lib/prisma';
import { saveMemory, listMemory, MemoryKind, TaskQueueUnavailableError } from '../../../../src/lib/taskQueue';

export const dynamic = 'force-dynamic';

async function requireAdmin(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;
  if (user.role === 'admin' || user.role === 'owner') return user;
  const memberships = await getAllOrganizationMemberships(req);
  const ok = memberships?.some((m) => m.role === 'admin' || m.role === 'owner');
  return ok ? user : null;
}

const KINDS: MemoryKind[] = ['decision', 'preference', 'lesson', 'fact'];

export async function GET(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const kindParam = sp.get('kind');
  const kind = kindParam && KINDS.includes(kindParam as MemoryKind) ? (kindParam as MemoryKind) : undefined;
  const limit = Math.min(Number(sp.get('limit') ?? '50') || 50, 200);

  const scope = { organizationId: user.organizationId, userId: user.id };
  try {
    const all = await listMemory(prisma, scope, limit);
    const items = kind ? all.filter((m) => m.kind === kind) : all;
    return NextResponse.json({ count: items.length, items });
  } catch (e) {
    if (e instanceof TaskQueueUnavailableError) {
      return NextResponse.json({ memoryAvailable: false, items: [], detail: e.message }, { status: 503 });
    }
    throw e;
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { kind?: unknown; key?: unknown; value?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (typeof body.key !== 'string' || !body.key.trim()) {
    return NextResponse.json({ error: 'key (string) é obrigatório' }, { status: 400 });
  }
  if (typeof body.kind !== 'string' || !KINDS.includes(body.kind as MemoryKind)) {
    return NextResponse.json({ error: `kind deve ser um de: ${KINDS.join(', ')}` }, { status: 400 });
  }
  // value pode ser qualquer JSON, mas limitado em tamanho para não estourar jsonb/limite de prompt.
  const valueJson = JSON.stringify(body.value ?? null);
  if (valueJson.length > 8000) {
    return NextResponse.json({ error: 'value excede 8000 caracteres serializados' }, { status: 400 });
  }

  const scope = { organizationId: user.organizationId, userId: user.id };
  try {
    await saveMemory(prisma, scope, body.kind as MemoryKind, body.key.trim(), JSON.parse(valueJson));
    return NextResponse.json({ ok: true, key: body.key.trim(), kind: body.kind }, { status: 201 });
  } catch (e) {
    if (e instanceof TaskQueueUnavailableError) {
      return NextResponse.json({ memoryAvailable: false, detail: e.message }, { status: 503 });
    }
    throw e;
  }
}
