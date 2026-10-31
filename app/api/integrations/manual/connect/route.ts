// app/api/integrations/manual/connect/route.ts
// POST /api/integrations/manual/connect — conecta conta MANUAL (sem API).
//
// Corpo aceito:
//  A) { channel, credential, kind?: 'token'|'cookie', label? }
//     — credential já extraída (cookie/session/token colado pelo usuário).
//  B) { channel, identifier, password, label? }
//     — login simulado via navegador headless (extrai cookie de sessão).
//
// WhatsApp: apenas modo A (cookie/token colado), máx. 5 canais por usuário.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { connectManualAccount, MANUAL_CHANNELS, type ManualChannel } from '@/integrations/manual';
import { extractSessionByLogin, type LoginPlatform } from '@/integrations/manualLogin';
import { logRisk } from '@/integrations/riskLogger';
import { logRiskEntry } from '@/modules/scrapers/riskLogger';

export const dynamic = 'force-dynamic';
// Login headless pode demorar (navegador + rede da plataforma)
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: {
    channel?: string;
    credential?: string;
    kind?: string;
    label?: string;
    identifier?: string;
    password?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const channel = body.channel as ManualChannel | undefined;
  if (!channel || !MANUAL_CHANNELS.includes(channel)) {
    return NextResponse.json(
      { error: 'channel inválido', allowed: MANUAL_CHANNELS },
      { status: 400 },
    );
  }

  // Auditoria: conexão manual é método não-oficial — sempre logamos.
  logRisk(channel, 'browser_automation', `connect manual canal=${channel}`, body.label ?? body.identifier ?? channel);

  let credential = typeof body.credential === 'string' ? body.credential : '';
  let kind: 'token' | 'cookie' | undefined =
    body.kind === 'cookie' || body.kind === 'token' ? body.kind : undefined;

  // Modo B: login simulado extrai a sessão
  if (!credential && body.identifier && body.password) {
    if (channel === 'whatsapp') {
      return NextResponse.json(
        { error: 'WhatsApp manual aceita apenas cookie/token colado (ou QR)' },
        { status: 400 },
      );
    }
    const login = await extractSessionByLogin(channel as LoginPlatform, String(body.identifier), String(body.password));
    if (!login.ok) {
      await safeAudit(user.id, user.organizationId, channel, 'failed', login.reason);
      const status = login.reason === 'needs_2fa' ? 428 : 401;
      return NextResponse.json({ error: login.reason, detail: login.detail }, { status });
    }
    credential = login.storageState;
    kind = 'cookie';
    await safeAudit(user.id, user.organizationId, channel, 'success', 'login headless → storageState');
  }

  if (!credential) {
    return NextResponse.json({ error: 'credential ou (identifier+password) obrigatório' }, { status: 400 });
  }

  const result = await connectManualAccount({
    userId: user.id,
    channel,
    credential,
    kind,
    label: body.label,
  });

  if (!result.ok) {
    const status = result.error === 'limit_exceeded' ? 409 : 500;
    return NextResponse.json({ error: result.error, detail: result.detail }, { status });
  }

  return NextResponse.json({
    connected: true,
    id: result.id,
    status: result.status,
    metaAccountId: result.metaAccountId,
    mode: 'MANUAL',
  });
}

async function safeAudit(
  userId: string,
  organizationId: string,
  platform: string,
  result: 'success' | 'failed',
  detail: string,
) {
  try {
    await logRiskEntry({
      userId,
      organizationId,
      action: 'manual_login',
      platform: platform === 'google' ? 'google' : (platform as 'instagram' | 'facebook' | 'whatsapp'),
      target: platform,
      riskLevel: 'high',
      context: { detail },
      result,
    });
  } catch {
    // auditoria nunca bloqueia o fluxo principal
  }
}
