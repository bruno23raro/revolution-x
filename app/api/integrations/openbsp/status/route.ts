// POST /api/integrations/openbsp/status — verifica status do onboarding
// Polling controlado para aguardar conclusão do popup/QR/code.
//
// Autenticação: pelo usuário autenticado (tenant).
// Retorna:
//   - status: 'pending' | 'connected' | 'expired' | 'error'
//   - tokenId: ID do onboarding token (se existir)
//   - reason: motivo da estado (se houver erro/expiração)
//   - wabaId / phoneNumberId: quando conectado
//
// O frontend deve fazer polling até o status deixar de ser 'pending'.
// Após conclusão, a tela deve atualizar automaticamente usando os dados
// retornados (WABA, número, etc.) e habilitar os recursos WhatsApp.
//
// Regras de segurança:
//   - A consulta está limitada ao tenant autenticado.
//   - Não fazer polling diretamente do navegador contra o OpenBSP usando chaves secretas.
//   - O backend correlaciona usando o verify_token gravado na row integrations.meta.
//
// O verifyToken é recuperado exclusivamente do backend (banco de dados),
// nunca exigido ou aceito do frontend. Isso elimina o risco de exposição
// de segredos no navegador e permite isolamento multi-tenant seguro.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '../../../../../src/lib/auth';
import { prisma } from '../../../../../src/lib/prisma';
import { fetchConnectedAddress } from '../../../../../src/integrations/whatsapp/openbsp/client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Recupera o verifyToken do banco usando a organização do usuário autenticado
  // Isso elimina a necessidade de o frontend transportar esse segredo
  let whatsappChannel;
  try {
    whatsappChannel = await prisma.whatsappChannel.findUnique({
      where: { organizationId: user.organizationId },
      select: { verifyToken: true, onboardingTokenId: true, status: true, callbackUrl: true },
    });
  } catch {
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  const storedVerifyToken = whatsappChannel?.verifyToken;
  const storedOnboardingTokenId = whatsappChannel?.onboardingTokenId;
  const channelStatus = whatsappChannel?.status;

  // Verifica via OpenBSP se a conta conectou
  // Apenas usa o verifyToken armazenado no backend (autoridade real)
  // O frontend nunca deve transportar verifyToken — ele é um segredo backend-only
  const verifyTokenToUse = storedVerifyToken;

  if (verifyTokenToUse) {
    // Busca o registro do onboarding token no OpenBSP
    const cfg = process.env.OPENBSP_BASE_URL
      ? {
          base: process.env.OPENBSP_BASE_URL.replace(/\/+$/, ''),
          publishableKey: process.env.OPENBSP_PUBLISHABLE_KEY || '',
          apiKey: process.env.OPENBSP_API_KEY || '',
          orgId: process.env.OPENBSP_ORG_ID || undefined,
        }
      : null;

    if (!cfg?.base || !cfg.publishableKey || !cfg.apiKey) {
      return NextResponse.json({
        status: 'error',
        reason: 'openbsp_not_configured',
      });
    }

    // Consulta organizations_addresses com o verify_token recuperado do backend
    const result = await fetchConnectedAddress(verifyTokenToUse, {
      timeoutMs: 10_000,
    });

    if (result.ok && result.data) {
      const address = result.data;
      return NextResponse.json({
        status: 'connected' as const,
        wabaId: address.extra?.waba_id ?? null,
        phoneNumberId: address.address ?? null,
        displayName: address.extra?.verified_name ?? null,
        callback_url: address.extra?.callback_url ?? null,
      });
    }

    // Se não encontrou conexão ainda, pode ser pending ou expirado
    const errorDetail = result.errorDetail || result.error || 'unknown';
    if (errorDetail?.includes('sem linha') || errorDetail?.includes('não conectado')) {
      return NextResponse.json({
        status: 'pending' as const,
        reason: 'conta_ainda_nao_conectada',
      });
    }

    // Outros erros podem indicar expiração ou falha
    return NextResponse.json({
      status: 'error' as const,
      reason: errorDetail || 'erro_desconhecido',
    });
  }

  // Sem verifyToken disponível (nem do banco nem da requisição): retorna pending
  return NextResponse.json({
    status: 'pending' as const,
    reason: 'aguardando_geracao_token',
  });
}