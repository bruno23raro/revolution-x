// FASE AGENT — Phase 2: fila de tarefas persistente.
// GET /api/admin/tasks?status=&limit= → lista do tenant atual (progresso real)

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getAllOrganizationMemberships } from '../../../../src/lib/auth';
import { prisma } from '../../../../src/lib/prisma';
import {
  listTasks,
  TaskQueueUnavailableError,
  TaskStatus,
} from '../../../../src/lib/taskQueue';

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

  const sp = req.nextUrl.searchParams;
  const statusParam = sp.get('status');
  const allowed: TaskStatus[] = ['queued', 'running', 'waiting_human', 'completed', 'failed', 'canceled'];
  const status = statusParam && allowed.includes(statusParam as TaskStatus) ? (statusParam as TaskStatus) : undefined;
  const limit = Math.min(Number(sp.get('limit') ?? '50') || 50, 200);

  const scope = { organizationId: user.organizationId, userId: user.id };
  try {
    const items = await listTasks(prisma, scope, { status, limit });
    return NextResponse.json({ organizationId: user.organizationId, count: items.length, items });
  } catch (e) {
    if (e instanceof TaskQueueUnavailableError) {
      // Tabela ainda não migrada neste ambiente — resposta honesta, não simulação.
      return NextResponse.json({ queueAvailable: false, items: [], detail: e.message }, { status: 503 });
    }
    throw e;
  }
}
