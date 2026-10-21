// FASE 2 — Publicar/agendar post de Página do Facebook via Graph API oficial.
//
// POST /api/facebook/publish
//   { message?, link?, scheduledAt? }
//   → { ok, postId?, scheduled?, error?, detail? }
//
// `message` ou `link` é obrigatório. Se `scheduledAt` estiver presente (dentro
// de 10 min a 75 dias), o post é agendado; caso contrário, publica agora.
// Degrada de forma honesta quando a Página não está conectada ou a credencial
// não está pronta.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import {
  publishFacebookPagePost,
  toScheduledStartSeconds,
  MAX_SCHEDULE_AHEAD_SECONDS,
  type CreatePagePostSpec,
} from '@/integrations/meta/facebookPublisher';
import { resolveTenantFacebookPageAccess } from '@/integrations/meta/resolveAccess';

export const dynamic = 'force-dynamic';

const MIN_SCHEDULE_AHEAD_SECONDS = 10 * 60;

function parsePagePost(body: Record<string, unknown>): {
  spec: CreatePagePostSpec;
  sourceError?: string;
} {
  const message = body.message ? String(body.message).trim() : undefined;
  const link = body.link ? String(body.link).trim() : undefined;
  const scheduledAt = body.scheduledAt ? String(body.scheduledAt).trim() : undefined;

  if (!message && !link) {
    return { spec: {}, sourceError: 'message ou link é obrigatório' };
  }
  return { spec: { message, link, scheduledAt } };
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

  const { spec, sourceError } = parsePagePost(body);
  if (sourceError) {
    return NextResponse.json({ ok: false, error: 'no_content_source', detail: sourceError }, { status: 400 });
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

  // MULTICONTAS — `account` (row id da meta_integrations) ancora a Página;
  // ausente → conta padrão (mais recente). 409 quando o id não existe no tenant.
  const account = body.account ? String(body.account).trim() : undefined;

  const resolved = await resolveTenantFacebookPageAccess(user.organizationId, {}, account);
  if (!resolved.ok) {
    if (resolved.reason === 'no_fb_page') {
      return NextResponse.json(
        {
          ok: false,
          error: 'no_fb_page',
          detail: 'Nenhuma Página do Facebook vinculada. Conecte via OAuth em /integrations.',
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

  const result = await publishFacebookPagePost(resolved.access, spec);

  if (result.ok) {
    return NextResponse.json(
      {
        ok: true,
        postId: result.postId,
        scheduled: Boolean(result.scheduled),
      },
      { status: 200 },
    );
  }
  if (result.error === 'no_content_source') {
    return NextResponse.json({ ok: false, error: 'no_content_source' }, { status: 400 });
  }
  return NextResponse.json(
    { ok: false, error: result.error, detail: result.errorDetail },
    { status: 502 },
  );
}
