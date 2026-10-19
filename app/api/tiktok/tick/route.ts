// FASE 4 · slice 1 — Tick do agendador de TikTok + fila pendente (UI).
//
// POST /api/tiktok/tick
//   Processa, para o tenant logado, os posts pendentes com prazo vencido em
//   `pending:tiktok_posts` (AgentMemory): publica via API oficial do TikTok e
//   marca o resultado na própria fila. → { ok, due, published, failed,
//   reasons, error?, detail? }
//   401 sem sessão · 503 quando a fila/memória não está disponível no
//   ambiente (tabela não migrada — degradação honesta, como a rota de
//   publicação).
//
// GET /api/tiktok/tick
//   A fila pendente projetada para a UI (últimos 50 itens, sem segredos):
//   { ok, pending: [{ id, scheduledAt, status, publishId?, videoUrl?, caption? }] }
//   401 sem sessão · 503 quando a fila/memória não está disponível.
//
// O segredo (access token TikTok) vive SÓ no banco (AgentMemory), nunca no
// corpo de resposta. A execução é idempotente por item: cada post é
// processado UMA vez no tick (marcado published/failed), então ticks
// repetidos não republicam.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TaskQueueUnavailableError } from '@/lib/taskQueue';
import {
  bindTikTokSchedulerDeps,
  listPendingTikTokView,
  runDueTikTokPosts,
} from '@/jobs/tiktokScheduler';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const scope = { organizationId: user.organizationId, userId: user.id };

  const result = await runDueTikTokPosts(bindTikTokSchedulerDeps(prisma, scope));
  if (result.error === 'queue_unavailable') {
    return NextResponse.json(
      { ok: false, error: result.error, detail: result.detail },
      { status: 503 },
    );
  }
  return NextResponse.json(result, { status: 200 });
}

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const scope = { organizationId: user.organizationId, userId: user.id };

  let pending: Awaited<ReturnType<typeof listPendingTikTokView>>;
  try {
    pending = await listPendingTikTokView(prisma, scope);
  } catch (e) {
    if (e instanceof TaskQueueUnavailableError) {
      return NextResponse.json({ detail: e.message }, { status: 503 });
    }
    throw e;
  }
  return NextResponse.json({ ok: true, pending }, { status: 200 });
}
