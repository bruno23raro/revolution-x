import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { DEMO_IDENTITIES, demoModeEnabled } from '@/lib/demoMode';
import crypto from 'crypto';

/**
 * Rota de login para ambiente de demonstração sem login real.
 *
 * SEGURANÇA CRÍTICA:
 * - Só funciona quando demoModeEnabled() === true
 * - Rejeita NODE_ENV === 'production' (sempre false em produção)
 * - Rejeita conexão com stack de produção (ardpabjoepzhkpmkgwgu)
 * - Não expõe tokens reais do Supabase - usa JWT mock
 * - Fail-closed: rejeita se DEMO_JWT_SECRET não configurado
 *
 * Uso:
 *   POST /api/dev/demo-login
 *
 * Resposta em produção ou quando demo mode desativado:
 *   403 Forbidden - { error: 'demo_mode_disabled' }
 */
export async function POST() {
  // Guard de segurança ABSOLUTO - nunca permitir em produção
  if (!demoModeEnabled()) {
    return NextResponse.json(
      { error: 'demo_mode_disabled', message: 'Demo mode is not enabled. Set RX_DEMO_MODE=1 and use local development environment.' },
      { status: 403 }
    );
  }

  // Fail-closed: DEMO_JWT_SECRET deve estar definido
  if (!process.env.DEMO_JWT_SECRET) {
    return NextResponse.json(
      {
        error: 'config_error',
        message: 'DEMO_JWT_SECRET is not configured. Generate a secure key and add it to .env.local'
      },
      { status: 500 }
    );
  }

  const cookieStore = await cookies();

  // Gerar tokens JWT mock para sessão demo
  // Estes tokens são apenas placeholders - a middleware deve detectar que é demo
  const demoToken = generateDemoToken();
  const refreshToken = generateDemoRefreshToken();

  // Configurar cookies de sessão (mesmos nomes que o Supabase usa)
  cookieStore.set('sb:token', demoToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 dias
  });

  cookieStore.set('sb-refresh-token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 dias
  });

  // Cookie de organização (usado pelo middleware)
  cookieStore.set('x-organization-id', DEMO_IDENTITIES.ORG_ID, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.json({
    user: {
      id: DEMO_IDENTITIES.USER_ID,
      email: DEMO_IDENTITIES.EMAIL,
      organizationId: DEMO_IDENTITIES.ORG_ID,
      role: 'admin',
    },
    demo: true,
    message: 'Entrou no modo demonstração. Dados são fictícios.',
  });
}

/**
 * Converte string para Base64URL (formato JWT).
 */
function toBase64Url(str: string): string {
  return Buffer.from(str).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Gera uma assinatura HMAC-SHA256 válida para o token demo.
 */
function signDemoToken(header: string, payload: string): string {
  const signData = `${header}.${payload}`;
  // Acessar DEMO_JWT_SECRET do process.env diretamente (já verificado fail-closed no POST)
  const secret = process.env.DEMO_JWT_SECRET;
  if (!secret) {
    throw new Error('DEMO_JWT_SECRET não configurado');
  }
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signData)
    .digest('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return signature;
}

/**
 * Gera um token JWT com assinatura HMAC-SHA256 para sessão demo.
 *
 * IMPORTANTE: A validação do token demo NÃO depende da assinatura criptográfica
 * para funcionamento, mas a assinatura PROVEM a integridade do token.
 * A segurança real vem de:
 * 1. demoModeEnabled() retorna false em produção
 * 2. isDemoToken() verifica sub/org_id PINNED contra valores constantes
 */
function generateDemoToken(): string {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = toBase64Url(JSON.stringify({
    sub: DEMO_IDENTITIES.USER_ID,
    email: DEMO_IDENTITIES.EMAIL,
    org_id: DEMO_IDENTITIES.ORG_ID,
    role: 'admin',
    is_demo: true,
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7), // 7 dias
    iat: Math.floor(Date.now() / 1000),
  }));
  // Assinatura HMAC-SHA256 - verificável
  const signature = signDemoToken(header, payload);
  return `${header}.${payload}.${signature}`;
}

/**
 * Gera um refresh token mock para sessão demo.
 */
function generateDemoRefreshToken(): string {
  return `demo_refresh_${DEMO_IDENTITIES.USER_ID}_${Date.now()}`;
}