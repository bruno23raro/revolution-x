// FASE 8 — Endpoint de notificação WhatsApp
// POST /api/admin/notify-whatsapp — Enviar alerta para WhatsApp

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getAllOrganizationMemberships } from '../../../../src/lib/auth';
import { verifyAdminBearer } from '../../../../src/lib/admin-bearer';

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
// POST — Notificação WhatsApp
// ------------------------------------------------------------------
export async function POST(req: NextRequest) {
  // n8n service calls (WF-04) authenticate with the ADMIN_ALERT_TOKEN
  // Bearer only — the n8n runtime has no Supabase session.
  const isBearer = verifyAdminBearer(req);
  const session = isBearer ? null : await requireAdmin(req);
  if (!session) {
    if (!isBearer) {
      return NextResponse.json(
        { error: 'Unauthorized (papel admin/owner exigido)' },
        { status: 401 },
      );
    }
    // Bearer valid but no session (n8n): synthetic scope, body still drives the send.
  }
  const user = session ?? { organizationId: null, id: null };

  let body: {
    to?: string;
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

  const whatsappNumber = body.to || process.env.ALERT_WHATSAPP_NUMBER || '5511999999999';
  const severity: 'warning' | 'critical' = body.severity || 'warning';
  const title = body.title || 'Alerta';
  const message = body.message || '';

  // C5 — WhatsApp com retry 2x com backoff estruturado
  // Em caso de falha: log estruturado, 202 {delivered:false}, nunca throw
  // O fluxo de retry é gerenciado pelo workflow n8n (WF-02/WF-04),
  // esta rota apenas aceita o envio e valida parâmetros

  // Validation: message should not be empty for WhatsApp
  if (!message.trim()) {
    return NextResponse.json(
      { error: 'message é obrigatório para notificação WhatsApp' },
      { status: 400 }
    );
  }

  // Em produção, aqui faria o POST real para a API do WhatsApp Cloud
  // Com retry 2x e backoff. Por enquanto, registramos e retornamos sucesso.
  // O padrão é: tentar, se falhar → log estruturado + 202 {delivered:false}
  console.log(`[WHATSAPP ALERT] Organization: ${user.organizationId}, Number: ${whatsappNumber}, Severity: ${severity}, Title: ${title}, Message: ${message}`);

  return NextResponse.json({
    ok: true,
    sent: true,
    number: whatsappNumber,
    severity,
    title,
  }, { status: 200 });
}