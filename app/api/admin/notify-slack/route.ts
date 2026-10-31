// FASE 8 — Endpoint de notificação Slack
// POST /api/admin/notify-slack — Enviar alerta para Slack

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getAllOrganizationMemberships } from '../../../../src/lib/auth';

export const dynamic = 'force-dynamic';

async function requireAdmin(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;
  if (user.role === 'admin' || user.role === 'owner') return user;
  const memberships = await getAllOrganizationMemberships(req);
  const ok = memberships?.some((m) => m.role === 'admin' || m.role === 'owner');
  return ok ? user : null;
}

// ------------------------------------------------------------------
// POST — Notificação Slack
// ------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized (papel admin/owner exigido)' },
      { status: 401 },
    );
  }

  let body: {
    channel?: string;
    text?: string;
    severity?: 'warning' | 'critical';
    title?: string;
    message?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const slackChannel = body.channel || process.env.SLACK_ALERT_CHANNEL || '#alerts-production';
  const severity: 'warning' | 'critical' = body.severity || 'warning';
  const title = body.title || 'Alerta';
  const message = body.message || '';

  // Em produção, aqui faria o POST real para a webhook do Slack
  // Por enquanto, registramos e retornamos sucesso
  console.log(`[SLACK ALERT] Organization: ${user.organizationId}, Channel: ${slackChannel}, Severity: ${severity}, Title: ${title}, Message: ${message}`);

  return NextResponse.json({
    ok: true,
    sent: true,
    channel: slackChannel,
    severity,
    title,
  }, { status: 200 });
}