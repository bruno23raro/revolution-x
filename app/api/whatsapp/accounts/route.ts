// FASE 17 — GET /api/whatsapp/accounts (§7/§11).
//
// Lista as contas (números) de WhatsApp do tenant para o seletor de conta
// da campanha. A rota JÁ exige autenticação (401 sem sessão) e SEMPRE
// deriva `organizationId` do usuário autenticado — nunca aceita do body.
//
// NENHUM segredo na resposta: o select NUNCA inclui
// `encrypted_access_token` / refresh token / access token. Apenas metadados
// administrativos (id, display_name, phone_number_id, waba id, status).
//
// Degração honesta (§18): Supabase não configurado / erro de query →
// `accounts: []` + `available: false` (nunca inventa contas).

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { listTenantWhatsAppAccounts } from '@/integrations/meta/accounts';

export async function GET(_req: NextRequest) {
  const user = await getAuthenticatedUser(_req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await listTenantWhatsAppAccounts(user.organizationId);
  if (!result.ok) {
    return NextResponse.json(
      { available: false, accounts: [], reason: result.reason },
      { status: 200 },
    );
  }

  return NextResponse.json({
    available: true,
    accounts: result.accounts,
    displayNameAvailable: result.displayNameAvailable,
  });
}