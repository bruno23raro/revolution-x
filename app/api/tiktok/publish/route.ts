// FASE 2 · slice 3 — Publicar/agendar vídeo via Content Posting API oficial do
// TikTok (open.tiktokapis.com).
//
// POST /api/tiktok/publish
//   { videoUrl, caption?, privacyLevel?, scheduledAt?, ... }
//   → { ok, publishId?, scheduled?, error?, detail?, note? }
//
// • Sem `scheduledAt`: publica AGORA (PULL_FROM_URL com `video_url`).
// • Com `scheduledAt`: a API oficial do TikTok NÃO tem horário de publicação,
//   então a INTENÇÃO é persistida em AgentMemory (fila) — a execução em hora
//   marcada é do agendador (FASE 4). O produto é honesto sobre isso.
// Degrada de forma honesta quando o provedor não está conectado (409) ou a
// fila/memória não está disponível no ambiente (503).
//
// O segredo (access token) vive SÓ no banco (AgentMemory), nunca no front-end.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TaskQueueUnavailableError } from '@/lib/taskQueue';
import {
  publishTikTokVideo,
  TIKTOK_PRIVACY_LEVELS,
  type PublishVideoSpec,
  type PendingTikTokPost,
} from '@/integrations/tiktok/tiktokPublisher';
import {
  resolveTenantTikTokAccess,
  addPendingTikTokPost,
} from '@/integrations/tiktok/resolveAccess';

export const dynamic = 'force-dynamic';

function parseSpec(body: Record<string, unknown>): { spec: PublishVideoSpec; sourceError?: string } {
  const videoUrl = body.videoUrl ? String(body.videoUrl).trim() : undefined;
  if (!videoUrl) return { spec: {}, sourceError: 'videoUrl é obrigatório (URL pública do vídeo)' };

  const spec: PublishVideoSpec = { videoUrl };
  const caption = body.caption ? String(body.caption).trim() : undefined;
  if (caption) spec.caption = caption;

  const privacy = body.privacyLevel ? String(body.privacyLevel).trim() : undefined;
  if (privacy && (TIKTOK_PRIVACY_LEVELS as readonly string[]).includes(privacy)) {
    spec.privacyLevel = privacy as PublishVideoSpec['privacyLevel'];
  }
  if (typeof body.disableComment === 'boolean') spec.disableComment = body.disableComment;
  if (typeof body.disableDuet === 'boolean') spec.disableDuet = body.disableDuet;
  if (typeof body.disableStitch === 'boolean') spec.disableStitch = body.disableStitch;
  if (typeof body.brandContent === 'boolean') spec.brandContent = body.brandContent;
  if (typeof body.aigc === 'boolean') spec.aigc = body.aigc;
  if (typeof body.videoCoverTimestampMs === 'number') spec.videoCoverTimestampMs = body.videoCoverTimestampMs;
  return { spec };
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const scope = { organizationId: user.organizationId, userId: user.id };

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { spec, sourceError } = parseSpec(body);
  if (sourceError) {
    return NextResponse.json(
      { ok: false, error: 'no_video_source', detail: sourceError },
      { status: 400 },
    );
  }

  // MULTICONTAS — `account` (openId do TikTok) seleciona a conta; ausente →
  // conta padrão (mais recente). `default` é um valor válido explícito.
  const account = body.account ? String(body.account).trim() : '';

  const resolved = await resolveTenantTikTokAccess(prisma, scope, account);
  if (!resolved.ok) {
    const status = resolved.reason === 'queue_unavailable' ? 503 : 409;
    const detail =
      resolved.reason === 'not_connected'
        ? 'Provedor TikTok não conectado. Preencha clientKey/clientSecret/accessToken em /integrations.'
        : resolved.reason === 'no_token'
          ? 'accessToken do TikTok ausente. Conecte em /integrations.'
          : resolved.reason === 'account_not_found'
            ? `Conta TikTok "${account}" não encontrada neste usuário/tenant.`
            : undefined;
    return NextResponse.json({ ok: false, error: resolved.reason, detail }, { status });
  }

  const scheduledAt = body.scheduledAt ? String(body.scheduledAt).trim() : undefined;

  // Agendamento: a API oficial não publica em hora marcada → persiste intenção.
  if (scheduledAt) {
    const t = Date.parse(scheduledAt);
    if (Number.isNaN(t)) {
      return NextResponse.json(
        { ok: false, error: 'bad_schedule', detail: 'scheduledAt inválida (use ISO 8601)' },
        { status: 400 },
      );
    }
    const item: PendingTikTokPost = {
      id: `tt_${user.id.slice(0, 10)}_${Date.now()}`,
      createdAt: new Date().toISOString(),
      scheduledAt,
      spec,
      status: 'pending',
      // MULTICONTAS — registra a conta resolvida para o agendador publicar lá.
      account: resolved.selectedAccount?.openId || undefined,
    };
    try {
      await addPendingTikTokPost(prisma, scope, item);
    } catch (e) {
      if (e instanceof TaskQueueUnavailableError) {
        return NextResponse.json({ detail: e.message }, { status: 503 });
      }
      throw e;
    }
    return NextResponse.json(
      {
        ok: true,
        scheduled: true,
        intentId: item.id,
        scheduledAt,
        note: 'A API oficial do TikTok não publica em hora marcada. A intenção foi guardada; a execução agendada fica no agendador (FASE 4).',
      },
      { status: 200 },
    );
  }

  // Publicação imediata.
  const result = await publishTikTokVideo(resolved.access, spec);
  if (result.ok) {
    return NextResponse.json({ ok: true, publishId: result.publishId }, { status: 200 });
  }
  if (result.error === 'no_video_source') {
    return NextResponse.json({ ok: false, error: 'no_video_source' }, { status: 400 });
  }
  return NextResponse.json(
    { ok: false, error: result.error, detail: result.errorDetail },
    { status: 502 },
  );
}
