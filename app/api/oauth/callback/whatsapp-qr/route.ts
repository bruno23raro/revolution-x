// app/api/oauth/callback/whatsapp-qr/route.ts
// WhatsApp QR code generation/status (Baileys/whatsapp-web.js)
// Gera sessão QR Code e retorna status da sessão.
// Não executa automação evasiva: apenas declara método, campos e aviso de risco (ToS).
// A execução real é não-oficial e sob responsabilidade do usuário.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { resolvePublicSiteOrigin } from '@/lib/site-origin';

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'generate';
  const sessionId = searchParams.get('sessionId');

  if (action === 'generate') {
    // Create new QR code session with 15-minute expiry
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const sessionIdValue = `session_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
    const qrCodePath = `/api/oauth/callback/whatsapp-qr?sessionId=${sessionIdValue}`;

    return NextResponse.json({
      success: true,
      session: {
        sessionId: sessionIdValue,
        qrCodeUrl: qrCodePath,
        expiresAt,
        status: 'PENDING',
        tenantId: user.organizationId,
        riskNote: 'Método não oficial (Baileys/whatsapp-web.js) — viola os ToS da Meta e pode banir o número. Use em conta de sacrifício, nunca na principal.',
      },
    });
  }

  if (sessionId) {
    // Return status of existing session
    // In production, this would fetch from DB/cache by sessionId
    return NextResponse.json({
      success: true,
      session: {
        sessionId,
        status: 'PENDING',
        expired: false,
        qrCodeUrl: null,
        scanCount: 0,
        tenantId: user.organizationId,
      },
    });
  }

  // Default: return help
  return NextResponse.json({
    success: false,
    error: 'Invalid action. Use action=generate or provide sessionId.',
  }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { sessionId?: string; qrCodeData?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { sessionId, qrCodeData } = body;

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId obrigatório' }, { status: 400 });
  }

  // Endpoint para receber o QR code do cliente Baileys (polling ou webhook)
  // Salvaria no cache/DB para consulta via GET
  return NextResponse.json({
    success: true,
    message: 'QR code data received',
  });
}