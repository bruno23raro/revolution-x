// FASE 4 · slice 3 — GATILHO DE SISTEMA do cron do agendador TikTok
// (multi-tenant: descobre todos os usuários com intenção pendente e roda
// um tick por escopo, cada um no próprio contexto RLS de usuário).
//
// Segurança: a rota é pública mas exigem segredo — o header `x-cron-secret`
// precisa bater com a env `CRON_SECRET` (comparação em tempo constante,
// mesmo padrão dos webhooks Meta). Sem a env → 503 `cron_not_configured`
// (degradação honesta, NUNCA inventa segredo). O segredo nunca é revelado
// nas respostas — só o código de erro.
//
// [HUMANO] definir `CRON_SECRET` no hpanel (Hostinger env vars) e registrar
// o job de cron do hpanel chamando POST /api/cron/tiktok (ex.: a cada 5
// min). A rota já está pronta; só o agendador externo é do usuário.
//
// NUNCA lança: qualquer falha vira JSON de erro com código honesto.

import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runTikTokCronForAll } from '@/jobs/tiktokScheduler';

export const dynamic = 'force-dynamic';

/** Comparação em tempo constante com guarda de tamanho (estilo dos webhooks Meta). */
function secretsEqual(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected || expected.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'cron_not_configured', detail: 'CRON_SECRET ausente no ambiente' },
      { status: 503 },
    );
  }
  if (!secretsEqual(req.headers.get('x-cron-secret'), expected)) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized', detail: 'x-cron-secret ausente ou inválido' },
      { status: 401 },
    );
  }

  let result: Awaited<ReturnType<typeof runTikTokCronForAll>>;
  try {
    result = await runTikTokCronForAll(prisma);
  } catch (e) {
    // O runner nunca lança; isto é só contenção defensiva (mesmo padrão).
    return NextResponse.json(
      { ok: false, error: 'tick_failed', detail: String((e as Error)?.message ?? e) },
      { status: 500 },
    );
  }

  if (result.error === 'queue_unavailable') {
    return NextResponse.json(
      { ok: false, error: 'queue_unavailable', detail: result.detail, reasons: result.reasons },
      { status: 503 },
    );
  }
  if (result.error === 'list_failed') {
    return NextResponse.json(
      { ok: false, error: 'list_failed', detail: result.detail, reasons: result.reasons },
      { status: 500 },
    );
  }

  // 200 mesmo com falhas por tenant: o cron executou; a agregação é o payload.
  return NextResponse.json({
    ok: result.ok,
    tenants: result.tenants,
    published: result.published,
    failed: result.failed,
    retried: result.retried,
    reasons: result.reasons,
    error: result.error,
  });
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: 'method_not_allowed', detail: 'use POST /api/cron/tiktok com x-cron-secret' },
    { status: 405 },
  );
}
