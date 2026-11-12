import { NextResponse } from 'next/server';
import { clearDemoSessionCookies } from '@/middleware/demo-auth';

/**
 * Rota para limpar sessão de demonstração.
 * Usado para sair do modo demo e voltar ao login normal.
 */
export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Sessão demo limpa' });
  return clearDemoSessionCookies(response);
}