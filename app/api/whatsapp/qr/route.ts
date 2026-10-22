// FASE 22 — Rota de QR Code para WhatsApp Business.
//
// Gera session temporária e serve informações sobre o QR Code.
// O QR Code em si depende de biblioteca externa (qrcode, canvas, etc.)
// ou da API oficial da Meta. Este endpoint fornece a sessionId e
// o frontend deve usar uma biblioteca de geração de QR Code para
// renderizar a imagem.
//
// Endpoints:
//   GET /api/whatsapp/qr?action=generate — Cria nova sessão QR Code
//   GET /api/whatsapp/qr?sessionId=xxx — Retorna status da sessão

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';

export async function GET(_req: NextRequest) {
  const user = await getAuthenticatedUser(_req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(_req.url);
  const action = searchParams.get('action') || 'generate';
  const sessionId = searchParams.get('sessionId');

  if (action === 'generate') {
    // Create new QR code session with 15-minute expiry
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    // Generate session ID using a simple approach
    const sessionIdValue = `session_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
    const qrCodePath = `/api/whatsapp/qr/${sessionIdValue}`;

    return NextResponse.json({
      success: true,
      session: {
        sessionId: sessionIdValue,
        qrCodeUrl: qrCodePath,
        expiresAt,
        status: 'PENDING',
        tenantId: user.organizationId,
      },
    });
  }

  if (sessionId) {
    // Return status of existing session
    // In production, this would fetch from DB by sessionId
    // For now return the session info we know
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

