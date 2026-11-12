import { NextRequest, NextResponse } from 'next/server';
import { AuthenticatedUser } from '../lib/auth';
import { isDemoToken, decodeDemoToken, DEMO_IDENTITIES } from '../lib/demoMode';

/**
 * Detecta se a requisição contém uma sessão de demonstração.
 * Retorna o usuário demo se detectado, null caso contrário.
 *
 * SEGURANÇA: Esta função só deve ser usada quando demoModeEnabled() for true.
 */
export async function getDemoUserFromRequest(request: NextRequest): Promise<AuthenticatedUser | null> {
  const sbToken = request.cookies.get('sb:token')?.value;

  if (!isDemoToken(sbToken ?? null)) {
    return null;
  }

  const claims = decodeDemoToken(sbToken ?? null);
  if (!claims) {
    return null;
  }

  return {
    id: claims.userId,
    email: claims.email,
    organizationId: claims.organizationId,
    role: claims.role,
  };
}

/**
 * Verifica se a requisição tem sessão demo válida.
 */
export function hasDemoSession(request: NextRequest): boolean {
  const sbToken = request.cookies.get('sb:token')?.value;
  return isDemoToken(sbToken ?? null);
}

/**
 * Limpa os cookies de sessão demo.
 * Deve ser chamado por uma rota API que retorna uma response com os cookies marcados para remoção.
 */
export function clearDemoSessionCookies(response: NextResponse): NextResponse {
  // Excluir cookies de sessão demo
  response.cookies.delete('sb:token');
  response.cookies.delete('sb-refresh-token');
  response.cookies.delete('x-organization-id');
  return response;
}