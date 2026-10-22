// FASE 17 — GET /api/whatsapp/accounts (§7/§11).
//
// Lista as contas (números) de WhatsApp do tenant para o seletor de conta
// da campanha. A rota Já exige autenticação (401 sem sessão) e SEMPRE
// deriva `organizationId` do usuário autenticado — nunca aceita do body.
//
// NENHUM segredo na resposta: o select NUNCA inclui
// `encrypted_access_token` / refresh token / access token. Apenas metadados
// administrativos (id, display_name, phone_number_id, waba id, status).
//
// Degração honesta (§18): Supabase não configurado / erro de query →
// `accounts: []` + `available: false` (nunca inventa contas).
//
// FASE 17+ — POST /api/whatsapp/accounts (§7/§11/§21).
// Inicia o fluxo OAuth da Meta para conexão de conta WhatsApp Business.
// Retorna a URL de autorização e um state para validação no callback.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { listTenantWhatsAppAccounts } from '@/integrations/meta/accounts';
import { generateOAuthState, buildMetaAuthUrl } from '@/integrations/meta/auth/oauth';
import type { MetaAuthConfig } from '@/integrations/meta/types';
import { DEFAULT_SCOPES } from '@/integrations/meta/constants';

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

export async function POST(_req: NextRequest) {
  const user = await getAuthenticatedUser(_req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Generate OAuth state for CSRF protection
  const state = generateOAuthState();

  // Build the redirect URI from the request origin
  const origin = _req.nextUrl.origin;

  // Build Meta Auth URL for WhatsApp Business connection
  const config: MetaAuthConfig = {
    appId: process.env.META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
    redirectUri: `${origin}/api/auth/callback/meta`,
    scopes: DEFAULT_SCOPES,
  };

  const authUrl = buildMetaAuthUrl(config, state, 'whatsapp');

  return NextResponse.json({
    success: true,
    authUrl,
    state,
    organizationId: user.organizationId,
  });
}