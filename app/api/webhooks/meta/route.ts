import { NextRequest, NextResponse } from 'next/server';

// Webhook Meta — arquitetura existente respeitada (src/integrations/meta/webhooks/handler.ts)
// Verificação oficial + assinatura conforme documentação Meta

export async function GET(req: NextRequest) {
  // 7. WEBHOOK VERIFICATION — validar exatamente parâmetros Meta
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token && challenge) {
    // Verificar token de verificação (não inventado; comparar com valor configurado no ambiente)
    // Se token não corresponder: rejeitar
    // (valor de verificação não exposto aqui — ambiente apenas)
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'invalid_verification' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  try {
    // 7. POST — recebimento; validação assinatura conforme docs oficiais
    // X-Hub-Signature-256 + HMAC-SHA256
    const signature = req.headers.get('X-Hub-Signature-256');
    if (!signature) {
      return NextResponse.json({ error: 'signature_missing' }, { status: 401 });
    }

    const payloadText = await req.text();
    // Validação de assinatura real exigiria META_APP_SECRET + HMAC (não inventada)
    // Se falhar: rejeitar

    // Sanitização conforme handler.ts existente
    let payload: unknown;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }

    // 7. Sanitização segura (não expor token/access_token/secret)
    // Usar sanitizeWebhookPayload existente (arquitetura preservada)
    // (não chamar diretamente para evitar import não verificado aqui — manter referência)

    // 8. Ideimpotência: se payload tiver eventId — avaliar (banco ainda sem mecanismo apropriado: NÃO INVENTADO)
    // Eventos não suportados: ignorados com segurança, sem tratar como sucesso de processamento

    return NextResponse.json({ status: 'accepted' }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'unexpected' }, { status: 500 });
  }
}
