// Verificação do token de serviço (ADMIN_ALERT_TOKEN) usada pelos endpoints
// que o n8n chama sem sessão Supabase (WF-02/03/04/05).
// Comparação timing-safe (mesma técnica de app/api/admin/alerts/route.ts, C1).
import type { NextRequest } from 'next/server';

const RAW = (process.env.ADMIN_ALERT_TOKEN ?? '').replace(/^Bearer\s+/i, '');

export function verifyAdminBearer(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return false;
  // C2 tolerante: n8n monta "Bearer {{ $env.ADMIN_ALERT_TOKEN }}" e o valor
  // do env já carrega o prefixo → aceita "Bearer Bearer x" (strip repetido).
  const a = Buffer.from(auth.replace(/^(?:Bearer\s+)+/i, ''), 'utf8');
  const b = Buffer.from(RAW, 'utf8');
  if (a.length === 0 || b.length === 0) return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
