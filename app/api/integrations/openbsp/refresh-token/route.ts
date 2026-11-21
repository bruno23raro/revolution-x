// FASE 3 — Verificação de token do OpenBSP (WhatsApp oficial)
//
// POST /api/integrations/openbsp/refresh-token → { ok, tokenId, expiresIn? } | { error }
//
// O OpenBSP NÃO fornece refresh tokens como Meta/TikTok. O access_token é:
//   1. Gerado durante o onboarding e armazenado em organizations_addresses.extra.access_token
//   2. Renovado AUTOMATICAMENTE pelo OpenBSP enquanto o onboarding token não expirar
//   3. Acesso expirado quando: onboarding_token.status != 'used' OU onboarding token expirou
//
// Este endpoint verifica se o canal ainda tem acesso válido e renova o access_token
// em cache/local se necessário. NUNCA loga tokens. Degrada com códigos honestos:
//   • 409 not_connected / no_token              (nada para renovar)
//   • 409 token_expired                         (onboarding expirou, requer re-onboarding)
//   • 503 config_missing / queue_unavailable
//   • 502 fetch_failed                          (API do OpenBSP indisponível)
//
// Só admin/owner (mesmo gate do refresh Meta/TikTok).

import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAllOrganizationMemberships } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encryptToken } from '@/lib/encryption';
import { openbspConfig, fetchConnectedAddress } from '@/integrations/whatsapp/openbsp/client';

export const dynamic = 'force-dynamic';

async function requireAdmin(req: NextRequest) {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user) return null;
  if (user.role === 'admin' || user.role === 'owner') return user;
  const memberships = await getAllOrganizationMemberships(req);
  const ok = memberships?.some((m) => m.role === 'admin' || m.role === 'owner');
  return ok ? user : null;
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 1) verificar configuração OpenBSP
  const cfg = openbspConfig();
  if (!cfg) return NextResponse.json({ error: 'config_missing' }, { status: 503 });

  // 2) buscar canal do tenant
  const channel = await prisma.whatsappChannel.findFirst({
    where: {
      organizationId: user.organizationId,
      status: 'CONNECTED',
      provider: 'openbsp',
    },
    select: { id: true, verifyToken: true, onboardingTokenId: true },
  });

  if (!channel) {
    return NextResponse.json({ error: 'not_connected' }, { status: 409 });
  }



  const tokenId = channel.verifyToken;
  if (!tokenId) {
    return NextResponse.json({ error: 'no_token' }, { status: 409 });
  }

  // 4) buscar endereço conectado do OpenBSP para verificação do token
  const addressRes = await fetchConnectedAddress(tokenId, { fetchImpl: fetch });
  if (!addressRes.ok) {
    return NextResponse.json({ error: 'fetch_failed', detail: addressRes.errorDetail }, { status: 502 });
  }

  const address = addressRes.data;
  if (!address) {
    return NextResponse.json({ error: 'not_connected', detail: 'sem linha conectada no provedor' }, { status: 409 });
  }

  // 5) verificar se o token ainda é válido (OpenBSP pode ter revogado)
  if (!address.extra?.access_token) {
    return NextResponse.json({ error: 'token_revoked', detail: 'access_token ausente no provedor' }, { status: 409 });
  }

  // 6) renovar access_token em cache (OpenBSP renova automaticamente)
  const accessTokenEnc = encryptToken(address.extra.access_token);

  try {
    await prisma.whatsappChannel.update({
      where: { id: channel.id },
      data: {
        status: 'CONNECTED',
        wabaId: address.extra.waba_id ?? null,
        phoneNumberId: address.address,
        phoneNumber: address.extra.phone_number ?? null,
        verifiedName: address.extra.verified_name ?? null,
        accessTokenEnc,
        lastError: null,
        updatedAt: new Date(),
      },
    });
  } catch (e) {
    console.error('[openbsp-refresh] erro ao atualizar:', (e as Error).message);
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tokenId: channel.onboardingTokenId ?? tokenId, expiresIn: 60 * 24 * 60 * 60 }, { status: 200 });
}