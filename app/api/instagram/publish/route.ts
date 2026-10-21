// FASE 2 — Publicar/agendar post de Instagram via Graph API oficial da Meta.
//
// POST /api/instagram/publish
//   { mediaType?: 'IMAGE'|'REEL', imageUrl?, videoUrl?, caption?, scheduledAt? }
//   → { ok, mediaId?, containerId?, scheduled?, error?, detail? }
//
// Se `scheduledAt` estiver presente (dentro de 10 min a 75 dias), o post é
// agendado; caso contrário, publica agora. Degrada de forma honesta quando a
// conta de Instagram não está conectada ou a credencial não está pronta.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import {
  publishInstagramPost,
  toScheduledStartSeconds,
  MAX_SCHEDULE_AHEAD_SECONDS,
  type CreateMediaSpec,
  type IgMediaType,
} from '@/integrations/meta/instagramPublisher';
import { resolveTenantPublisherAccess } from '@/integrations/meta/resolveAccess';

export const dynamic = 'force-dynamic';

const MIN_SCHEDULE_AHEAD_SECONDS = 10 * 60;

function parseMedia(body: Record<string, unknown>): {
  spec: CreateMediaSpec;
  sourceError?: string;
} {
  const mediaType: IgMediaType =
    body.mediaType === 'REEL' ? 'REEL' : 'IMAGE';
  const imageUrl = body.imageUrl ? String(body.imageUrl).trim() : undefined;
  const videoUrl = body.videoUrl ? String(body.videoUrl).trim() : undefined;
  const caption = body.caption ? String(body.caption).trim() : undefined;
  const scheduledAt = body.scheduledAt ? String(body.scheduledAt).trim() : undefined;

  const hasSource = mediaType === 'REEL' ? Boolean(videoUrl || imageUrl) : Boolean(imageUrl);
  if (!hasSource) {
    return {
      spec: {},
      sourceError: mediaType === 'REEL' ? 'videoUrl (ou imageUrl) é obrigatório para um Reel' : 'imageUrl é obrigatória',
    };
  }
  return {
    spec: { mediaType, imageUrl, videoUrl, caption, scheduledAt },
  };
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { spec, sourceError } = parseMedia(body);
  if (sourceError) {
    return NextResponse.json({ ok: false, error: 'no_media_source', detail: sourceError }, { status: 400 });
  }

  // Validação da janela de agendamento (10 min a 75 dias).
  if (spec.scheduledAt) {
    const start = toScheduledStartSeconds(spec.scheduledAt);
    if (start == null) {
      return NextResponse.json(
        { ok: false, error: 'bad_schedule', detail: 'scheduledAt inválida (use ISO 8601)' },
        { status: 400 },
      );
    }
    const nowS = Math.floor(Date.now() / 1000);
    if (start < nowS + MIN_SCHEDULE_AHEAD_SECONDS) {
      return NextResponse.json(
        { ok: false, error: 'bad_schedule', detail: 'O horário precisa ser em pelo menos 10 minutos' },
        { status: 400 },
      );
    }
    if (start > nowS + MAX_SCHEDULE_AHEAD_SECONDS) {
      return NextResponse.json(
        { ok: false, error: 'bad_schedule', detail: 'Agendamento limitado a 75 dias' },
        { status: 400 },
      );
    }
  }

  // MULTICONTAS — `account` (row id da meta_integrations) ancora a conta;
  // ausente → conta padrão (mais recente). 409 quando o id não existe no tenant.
  const account = body.account ? String(body.account).trim() : undefined;

  const resolved = await resolveTenantPublisherAccess(user.organizationId, {}, account);
  if (!resolved.ok) {
    if (resolved.reason === 'no_ig_account') {
      return NextResponse.json(
        {
          ok: false,
          error: 'no_ig_account',
          detail: 'Nenhuma conta de Instagram vinculada. Conecte via OAuth em /integrations.',
        },
        { status: 409 },
      );
    }
    if (resolved.reason === 'account_not_found') {
      return NextResponse.json(
        {
          ok: false,
          error: 'account_not_found',
          detail: `Conta Meta "${account}" não encontrada neste tenant.`,
        },
        { status: 409 },
      );
    }
    const status = resolved.reason === 'not_connected' ? 409 : 503;
    return NextResponse.json({ ok: false, error: resolved.reason }, { status });
  }

  const result = await publishInstagramPost(resolved.access, spec);

  if (result.ok) {
    return NextResponse.json(
      {
        ok: true,
        mediaId: result.mediaId,
        containerId: result.containerId,
        scheduled: Boolean(result.scheduled),
      },
      { status: 200 },
    );
  }
  if (result.error === 'no_media_source') {
    return NextResponse.json({ ok: false, error: 'no_media_source' }, { status: 400 });
  }
  return NextResponse.json(
    { ok: false, error: result.error, detail: result.errorDetail },
    { status: 502 },
  );
}
