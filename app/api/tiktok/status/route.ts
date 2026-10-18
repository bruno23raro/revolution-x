// FASE 2 · slice 3 — Consultar o estado de um `publish_id` do TikTok
// (Content Posting API oficial). É um TRACKING leve: o estado do vídeo
// (INIT → READY_TO_PUBLISH → PUBLISHED | FAILED).
//
// GET /api/tiktok/status?publishId=... → { ok, publishId, status }

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTikTokPostStatus } from '@/integrations/tiktok/tiktokPublisher';
import { resolveTenantTikTokAccess } from '@/integrations/tiktok/resolveAccess';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const scope = { organizationId: user.organizationId, userId: user.id };

  const publishId = (req.nextUrl.searchParams.get('publishId') ?? '').trim();
  if (!publishId) {
    return NextResponse.json(
      { ok: false, error: 'no_video_source', detail: 'publishId é obrigatório' },
      { status: 400 },
    );
  }

  const resolved = await resolveTenantTikTokAccess(prisma, scope);
  if (!resolved.ok) {
    const status = resolved.reason === 'queue_unavailable' ? 503 : 409;
    return NextResponse.json({ ok: false, error: resolved.reason }, { status });
  }

  const result = await getTikTokPostStatus(resolved.access, publishId);
  if (result.ok) {
    return NextResponse.json({ ok: true, publishId, status: result.status }, { status: 200 });
  }
  return NextResponse.json(
    { ok: false, error: result.error, detail: result.errorDetail },
    { status: 502 },
  );
}
