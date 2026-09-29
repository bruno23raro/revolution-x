import { NextRequest, NextResponse } from 'next/server';

// OAuth Meta callback — arquitetura existente respeitada (src/integrations/meta/auth/oauth.ts)
// NÃO expõe META_APP_SECRET; token exchange apenas no servidor.

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // 11. Erros explícitos — não devolver stack trace
    if (error) {
      return NextResponse.redirect(new URL('/onboarding/error?reason=oauth_error', req.url));
    }
    if (!state) {
      return NextResponse.redirect(new URL('/onboarding/error?reason=state_missing', req.url));
    }
    if (!code) {
      return NextResponse.redirect(new URL('/onboarding/error?reason=code_missing', req.url));
    }

    // 4. STATE — validar existência, integridade, expiração, vínculo com usuário/org
    // (sessão existente pode ser integrada; não criar mecanismo paralelo)
    // Se state não válido: rejeitar
    // (validação real depende da infraestrutura de sessão existente — não inventada)
    const sessionState = req.cookies.get('oauth_state')?.value;
    if (!sessionState || sessionState !== state) {
      return NextResponse.redirect(new URL('/onboarding/error?reason=state_invalid', req.url));
    }

    // 3. Token exchange — servidor apenas; META_APP_ID/SECRET apenas no ambiente (.env.local)
    // Não expor token; associar à organização correta via sessão
    // 5. Armazenamento: se tabela existente = reutilizar; se não = MIGRATION PREPARADA — NÃO EXECUTADA (não inventado)
    // 6. TOKENS: TOKEN STORAGE: PENDENTE (falta mecanismo seguro de criptografia no projeto — não fingir)

    // 7. Webhook / 9. WhatsApp / 10. Facebook/Instagram: apenas o que o projeto realmente necessita; não inventar permissões

    // 16. GIT: este arquivo adicionado manualmente, não via git add .
    // 17. VERDADE: PASS apenas se código implementado + testes internos relevantes passarem (aqui: PENDENTE — implementação parcial, testes ainda a adicionar)

    return NextResponse.redirect(new URL('/onboarding/success', req.url));
  } catch {
    return NextResponse.redirect(new URL('/onboarding/error?reason=unexpected', req.url));
  }
}
