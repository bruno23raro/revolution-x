// FASE AGENT — Phase 2: detalhe + ações de uma tarefa.
// GET  /api/admin/tasks/{id}            → detalhe (etapas, eventos, progresso)
// POST /api/admin/tasks/{id} {action}   → "cancel" | "resume"

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getAllOrganizationMemberships } from '../../../../../src/lib/auth';
import { prisma } from '../../../../../src/lib/prisma';
import {
  getTaskDetail,
  cancelTask,
  resumeAfterHuman,
  TaskQueueUnavailableError,
} from '../../../../../src/lib/taskQueue';

export const dynamic = 'force-dynamic';

async function requireAdmin(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;
  if (user.role === 'admin' || user.role === 'owner') return user;
  const memberships = await getAllOrganizationMemberships(req);
  const ok = memberships?.some((m) => m.role === 'admin' || m.role === 'owner');
  return ok ? user : null;
}

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = ctx.params;
  const scope = { organizationId: user.organizationId, userId: user.id };
  try {
    const detail = await getTaskDetail(prisma, scope, id);
    if (!detail) return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    return NextResponse.json(detail);
  } catch (e) {
    if (e instanceof TaskQueueUnavailableError) {
      return NextResponse.json({ queueAvailable: false, detail: e.message }, { status: 503 });
    }
    throw e;
  }
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = ctx.params;

  let body: { action?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const scope = { organizationId: user.organizationId, userId: user.id };

  const run = async () => {
    if (body.action === 'cancel') {
      await cancelTask(prisma, scope, id, 'cancelada pelo usuário');
      return { ok: true, status: 'canceled' as const };
    }
    if (body.action === 'resume') {
      await resumeAfterHuman(prisma, scope, id);
      return { ok: true, status: 'running' as const };
    }
    return null;
  };

  try {
    const result = await run();
    if (!result) return NextResponse.json({ error: "action deve ser 'cancel' ou 'resume'" }, { status: 400 });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof TaskQueueUnavailableError) {
      return NextResponse.json({ queueAvailable: false, detail: e.message }, { status: 503 });
    }
    if (e instanceof Error && /inválida|não encontrada/.test(e.message)) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }
}
