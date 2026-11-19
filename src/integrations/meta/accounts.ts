// FASE 17 — Seletor de contas de WhatsApp do tenant (§7/§11).
//
// Lista as contas do provedor Meta que PODEM fazer envio de campanhas
// (`provider` em whatsapp|facebook com `phone_number_id` presente), na
// MESMA ordem do resolver de credencial (`resolveTenantMetaAccess`):
// `connected_at desc`, status != DISCONNECTED. `display_name` vem da
// migration 016 — quando a coluna ainda não foi aplicada no ambiente
// (gate humano), a leitura degrada graciosamente SEM ela (rótulo vira o
// número; `displayNameAvailable=false` registra a degradação honesta).
//
// NENHUM segredo na resposta: os campos de token (encrypted_access_token,
// refresh) NÃO entram no select — só metadados administrativos.

import { prisma } from '@/lib/prisma';

export interface WhatsAppAccountSummary {
  id: string;
  provider: string | null;
  /** Rótulo da conta (migration 016); `null` quando a coluna não existe. */
  displayName: string | null;
  phoneNumberId: string | null;
  whatsappBusinessAccountId: string | null;
  status: string | null;
}

export type AccountListResult =
  | { ok: true; accounts: WhatsAppAccountSummary[]; displayNameAvailable: boolean }
  | { ok: false; reason: 'client_unavailable' | 'query_failed' };

/**
 * Busca as contas do tenant usando Prisma.
 * `organizationId` SEMPRE server-derived; nenhum campo vem do cliente.
 */
export async function listTenantWhatsAppAccounts(
  organizationId: string
): Promise<AccountListResult> {
  try {
    const integrations = await prisma.metaIntegration.findMany({
      where: {
        organizationId,
        provider: { in: ['whatsapp', 'facebook'] },
        status: { not: 'DISCONNECTED' },
      },
      select: {
        id: true,
        provider: true,
        displayName: true,
        phoneNumberId: true,
        whatsappBusinessAccountId: true,
        status: true,
        connectedAt: true,
      },
      orderBy: { connectedAt: 'desc' },
    });

    const accounts: WhatsAppAccountSummary[] = integrations
      .filter((r) => r.phoneNumberId && r.phoneNumberId.length > 0)
      .map((r) => ({
        id: r.id,
        provider: r.provider,
        displayName: r.displayName,
        phoneNumberId: r.phoneNumberId,
        whatsappBusinessAccountId: r.whatsappBusinessAccountId,
        status: r.status,
      }));

    return { ok: true, accounts, displayNameAvailable: true };
  } catch (error) {
    console.error('[listTenantWhatsAppAccounts] error:', error);
    return { ok: false, reason: 'query_failed' };
  }
}