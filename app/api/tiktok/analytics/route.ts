// FASE 2 · slice 3 — Tracking real de vídeos do TikTok via Content Posting API
// oficial (GET /v2/post/publish/video/data/, máx. 5 por chamada). Devolve
// métricas por vídeo (plays, curtidas, compartilhamentos, downloads,
// comentários) + estado. É o "tracking" oficial do canal.
//
// GET /api/tiktok/analytics?publishIds=a,b,c → { ok, items }

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTikTokVideoAnalytics } from '@/integrations/tiktok/tiktokPublisher';
import { resolveTenantTikTokAccess } from '@/integrations/tiktok/resolveAccess';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const scope = { organizationId: user.organizationId, userId: user.id };

  const raw = req.nextUrl.searchParams.get('publishIds') ?? '';
  const publishIds = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);
  if (publishIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'no_video_source', detail: 'publishIds é obrigatório (máx. 5, separados por vírgula)' },
      { status: 400 },
    );
  }

  const resolved = await resolveTenantTikTokAccess(prisma, scope);
  if (!resolved.ok) {
    const status = resolved.reason === 'queue_unavailable' ? 503 : 409;
    return NextResponse.json({ ok: false, error: resolved.reason }, { status });
  }

  const result = await getTikTokVideoAnalytics(resolved.access, publishIds);
  if (result.ok) {
    return NextResponse.json({ ok: true, items: result.items }, { status: 200 });
  }
  return NextResponse.json(
    { ok: false, error: result.error, detail: result.errorDetail },
    { status: 502 },
  );
}
