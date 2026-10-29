// POST /api/integrations/openbsp/connect â€” inicia o onboarding do canal
// OFICIAL por tenant (PASSO E / plano OpenBSP).
//
// Fluxo: mint de onboarding token na conta OpenBSP com callback_url +
// verify_token ÃšNICOS por tenant (a correlaÃ§Ã£o da linha
// `organizations_addresses` de volta ao tenant Ã© por verify_token â€” o id do
// token nÃ£o aparece lÃ¡). PrÃ©-provisiona whatsapp_channels como PENDING e
// devolve a URL do popup Embedded Signup.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAuthenticatedUser } from '../../../../../src/lib/auth';
import { mintOnboardingToken, upsertChannelPending } from '../../../../../src/integrations/whatsapp';
import { createServiceRoleClient } from '../../../../../src/lib/supabase/server';

export const dynamic = 'force-dynamic';

const APP_BASE = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://revolutionx.com.br').replace(/\/+$/, '');

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgBsp = process.env.OPENBSP_ORG_ID;
  if (!orgBsp) {
    return NextResponse.json({ error: 'openbsp_not_configured' }, { status: 503 });
  }

  const verifyToken = crypto.randomBytes(24).toString('hex');
  const callbackUrl = `${APP_BASE()}/api/integrations/openbsp/incoming?org=${user.organizationId}`;

  const mint = await mintOnboardingToken({
    name: `rx-org-${user.organizationId.slice(0, 8)}`,
    orgId: orgBsp,
    callbackUrl,
    verifyToken,
  });
  if (!mint.ok || !mint.tokenId || !mint.popupUrl) {
    return NextResponse.json(
      { error: 'openbsp_mint_failed', detail: mint.errorDetail ?? mint.error },
      { status: 502 },
    );
  }

  try {
    await upsertChannelPending(createServiceRoleClient(), {
      organizationId: user.organizationId,
      verifyToken,
      callbackUrl,
      onboardingTokenId: mint.tokenId,
    });
  } catch {
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  console.info('[openbsp] onboarding iniciado', { org: user.organizationId, tokenId: mint.tokenId });
  return NextResponse.json({ popupUrl: mint.popupUrl, tokenId: mint.tokenId });
}
