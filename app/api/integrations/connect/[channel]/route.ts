// POST /api/integrations/connect/{channel}
// Inicia o onboarding de um canal de integração
//
// Suporta: whatsapp, instagram, facebook
// Usa o fluxo OpenBSP quando disponível, fallback para manual/QR

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { mintOnboardingToken, upsertChannelPending } from '@/integrations/whatsapp';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const APP_BASE = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://revolutionx.com.br').replace(/\/+$/, '');

type Channel = 'whatsapp' | 'instagram' | 'facebook';

interface ConnectRequest {
  mode?: 'official' | 'non_official';
  accountName?: string;
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const channel = url.pathname.split('/').pop() as Channel;
  if (!channel || !['whatsapp', 'instagram', 'facebook'].includes(channel)) {
    return NextResponse.json({ error: 'Channel inválido' }, { status: 400 });
  }

  const body: ConnectRequest = await req.json().catch(() => ({}));
  const mode: 'official' | 'non_official' = body.mode === 'non_official' ? 'non_official' : 'official';

  const orgBsp = process.env.OPENBSP_ORG_ID;

  // Para não-oficial, sempre usar QR/Evolution
  if (mode === 'non_official') {
    const redirect = `/api/integrations/manual/connect?channel=${channel}`;
    return NextResponse.json({ mode, redirect, channel }, { status: 200 });
  }

  // Modo oficial - usar OpenBSP quando disponível
  if (!orgBsp) {
    return NextResponse.json({
      error: 'openbsp_not_configured',
      detail: 'Configure OPENBSP_ORG_ID para usar API oficial'
    }, { status: 503 });
  }

  const verifyToken = crypto.randomBytes(24).toString('hex');
  const callbackUrl = `${APP_BASE()}/api/integrations/openbsp/incoming?org=${user.organizationId}&channel=${channel}`;

  // Mint onboarding token
  const mint = await mintOnboardingToken({
    name: body.accountName ?? `rx-${channel}-${user.organizationId.slice(0, 8)}`,
    orgId: orgBsp,
    callbackUrl,
    verifyToken,
  });

  if (!mint.ok || !mint.tokenId) {
    return NextResponse.json(
      { error: 'openbsp_mint_failed', detail: mint.errorDetail ?? mint.error, channel },
      { status: 502 },
    );
  }

  // Pré-provisionar canal como PENDING
  const service = createServiceRoleClient();
  try {
    await upsertChannelPending(service, {
      organizationId: user.organizationId,
      verifyToken,
      callbackUrl,
      onboardingTokenId: mint.tokenId,
      channel,
      accountName: body.accountName,
    });
  } catch (e) {
    console.error('[connect] Erro ao pré-provisionar canal:', e);
    return NextResponse.json({ error: 'db_error', channel }, { status: 500 });
  }

  console.info('[connect] onboarding iniciado', { org: user.organizationId, channel, tokenId: mint.tokenId });
  return NextResponse.json({
    popupUrl: mint.popupUrl,
    tokenId: mint.tokenId,
    mode: 'official',
    channel
  }, { status: 200 });
}

// GET para verificar status da conexão
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const channel = url.searchParams.get('channel') || url.pathname.split('/').pop();
  if (!channel || !['whatsapp', 'instagram', 'facebook'].includes(channel)) {
    return NextResponse.json({ error: 'Channel inválido' }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { data: channelData } = await service
    .from('whatsapp_channels')
    .select('id, provider, status, verifiedName, lastError')
    .eq('organizationId', user.organizationId)
    .in('provider', ['openbsp', channel === 'whatsapp' ? 'openbsp' : 'manual'])
    .neq('status', 'DISCONNECTED')
    .limit(1)
    .maybeSingle();

  if (!channelData) {
    return NextResponse.json({ connected: false, channel }, { status: 200 });
  }

  return NextResponse.json({
    connected: true,
    channel,
    accountId: channelData.id,
    name: channelData.verifiedName,
    status: channelData.status,
    error: channelData.lastError,
  }, { status: 200 });
}