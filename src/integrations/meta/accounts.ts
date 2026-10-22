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

import { createClient } from '@/lib/supabase/server';

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
 * Busca as contas do tenant. `client` injetável (testes sem Supabase):
 * shape mínimo do PostgREST `.from(table).select(...).eq/in/neq/order`.
 * `organizationId` SEMPRE server-derived; nenhum campo vem do cliente.
 */
export async function listTenantWhatsAppAccounts(
  organizationId: string,
  deps: { client?: any } = {},
): Promise<AccountListResult> {
  let client: any;
  try {
    client = deps.client ?? (await createClient());
  } catch {
    // Supabase não configurado no ambiente: degradação honesta (a UI mostra
    // "contas indisponíveis", nunca inventa números).
    return { ok: false, reason: 'client_unavailable' };
  }

  // Selects com/sem `display_name` (migração 016 — gate humano): o fallback
  // mantém o seletor funcionando em ambientes onde 016 ainda não ocorreu.
  const selectCols = (withDisplay: boolean): string =>
    [
      'id',
      'provider',
      ...(withDisplay ? ['display_name'] : []),
      'phone_number_id',
      'whatsapp_business_account_id',
      'status',
      'connected_at',
    ].join(', ');

  const run = async (withDisplay: boolean) => {
    const q = client
      .from('meta_integrations')
      .select(selectCols(withDisplay))
      .eq('organization_id', organizationId)
      .in('provider', ['whatsapp', 'facebook'])
      .neq('status', 'DISCONNECTED')
      .order('connected_at', { ascending: false });
    return await q;
  };

  let rows: Array<Record<string, unknown>> | null = null;
  let displayNameAvailable = true;

  try {
    const { data, error } = await run(true);
    if (error) throw new Error(String(error.message ?? error));
    rows = data;
  } catch {
    try {
      const { data, error } = await run(false);
      if (error) throw new Error(String(error.message ?? error));
      rows = data;
      displayNameAvailable = false;
    } catch {
      return { ok: false, reason: 'query_failed' };
    }
  }

  const accounts: WhatsAppAccountSummary[] = (rows ?? [])
    .filter((r) => typeof r.phone_number_id === 'string' && (r.phone_number_id as string).length > 0)
    .map((r) => ({
      id: String(r.id ?? ''),
      provider: (r.provider as string | null) ?? null,
      displayName: displayNameAvailable ? ((r.display_name as string | null) ?? null) : null,
      phoneNumberId: (r.phone_number_id as string | null) ?? null,
      whatsappBusinessAccountId: (r.whatsapp_business_account_id as string | null) ?? null,
      status: (r.status as string | null) ?? null,
    }));

  return { ok: true, accounts, displayNameAvailable };
}
