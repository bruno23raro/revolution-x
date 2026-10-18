// FASE 1 — Resolver a credencial Meta (WhatsApp) de um tenant.
//
// Lê a linha da tabela REAL `meta_integrations` (snake_case — ver dual-schema
// drift) via service_role (lookup privilegiado/leitura), descriptografa o
// access token (AES-256-GCM) e devolve um `MetaWABAccess` pronto para o
// sender. `createServiceRoleClient` é injetável para testes sem Supabase.

import { createServiceRoleClient } from '@/lib/supabase/server';
import { decryptToken } from '@/lib/encryption';
import type { TemplatesAccess } from './whatsappTemplates';

/** Linha real da tabela `meta_integrations` (nomes snake_case). */
export interface MetaIntegrationRow {
  id?: string;
  provider?: string;
  phone_number_id?: string | null;
  whatsapp_business_account_id?: string | null;
  meta_app_id?: string | null;
  encrypted_access_token?: string | null;
  token_expires_at?: string | null;
  status?: string;
}

export type ResolveResult =
  | { ok: true; access: TemplatesAccess; row: MetaIntegrationRow }
  | { ok: false; reason: 'not_connected' | 'no_token' | 'decrypt_failed' };

interface FetcherLike {
  from: (table: string) => any;
}

export interface ResolveDeps {
  /** Injetável para testes. Padrão: `createServiceRoleClient()`. */
  serviceRole?: FetcherLike;
}

export async function resolveTenantMetaAccess(
  organizationId: string,
  deps: ResolveDeps = {},
): Promise<ResolveResult> {
  const service = deps.serviceRole ?? createServiceRoleClient();
  const { data, error } = await service
    .from('meta_integrations')
    .select('id, provider, phone_number_id, whatsapp_business_account_id, meta_app_id, encrypted_access_token, token_expires_at, status')
    .eq('organization_id', organizationId)
    .in('provider', ['whatsapp', 'facebook'])
    .neq('status', 'DISCONNECTED')
    .limit(1)
    .maybeSingle();

  if (error || !data) return { ok: false, reason: 'not_connected' };

  const row = data as unknown as MetaIntegrationRow;
  if (!row.encrypted_access_token) return { ok: false, reason: 'no_token' };

  let accessToken: string;
  try {
    accessToken = decryptToken(row.encrypted_access_token);
  } catch {
    return { ok: false, reason: 'decrypt_failed' };
  }

  const access: TemplatesAccess = {
    accessToken,
    phoneNumberId: row.phone_number_id ?? '',
    wabaId: row.whatsapp_business_account_id ?? undefined,
  };
  return { ok: true, access, row };
}
