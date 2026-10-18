// FASE 1 — Resolver a credencial Meta (WhatsApp) de um tenant.
//
// Lê a linha da tabela REAL `meta_integrations` (snake_case — ver dual-schema
// drift) via service_role (lookup privilegiado/leitura), descriptografa o
// access token (AES-256-GCM) e devolve um `MetaWABAccess` pronto para o
// sender. `createServiceRoleClient` é injetável para testes sem Supabase.

import { createServiceRoleClient } from '@/lib/supabase/server';
import { decryptToken } from '@/lib/encryption';
import type { TemplatesAccess } from './whatsappTemplates';
import type { InstagramAccess } from './instagramPublisher';

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

// ---------------------------------------------------------------------------
// FASE 2 — Resolver a credencial para publicar em Instagram / Facebook.
// ---------------------------------------------------------------------------

/** Linha (subconjunto) usada pelo publicador IG/FB. */
export interface PublisherRow {
  id?: string;
  provider?: string;
  meta_page_id?: string | null;
  instagram_account_id?: string | null;
  encrypted_access_token?: string | null;
  token_expires_at?: string | null;
  status?: string;
}

export type ResolvePublisherResult =
  | { ok: true; access: InstagramAccess; row: PublisherRow }
  | {
      ok: false;
      reason: 'not_connected' | 'no_token' | 'decrypt_failed' | 'no_ig_account';
    };

/**
 * Resolve o access token + `instagram_account_id` de um tenant para publicar
 * via Graph API oficial. Mesma linha privilegiada (`meta_integrations`) e
 * descriptografia do WhatsApp, mas seleciona também os IDs de Instagram.
 * Injetável (`serviceRole`) para testes. Não altera `resolveTenantMetaAccess`.
 */
export async function resolveTenantPublisherAccess(
  organizationId: string,
  deps: ResolveDeps = {},
): Promise<ResolvePublisherResult> {
  const service = deps.serviceRole ?? createServiceRoleClient();
  const { data, error } = await service
    .from('meta_integrations')
    .select(
      'id, provider, meta_page_id, instagram_account_id, encrypted_access_token, token_expires_at, status',
    )
    .eq('organization_id', organizationId)
    .in('provider', ['instagram', 'facebook', 'whatsapp'])
    .neq('status', 'DISCONNECTED')
    .limit(1)
    .maybeSingle();

  if (error || !data) return { ok: false, reason: 'not_connected' };

  const row = data as unknown as PublisherRow;
  if (!row.encrypted_access_token) return { ok: false, reason: 'no_token' };

  let accessToken: string;
  try {
    accessToken = decryptToken(row.encrypted_access_token);
  } catch {
    return { ok: false, reason: 'decrypt_failed' };
  }

  const instagramUserId = row.instagram_account_id ?? '';
  if (!instagramUserId) return { ok: false, reason: 'no_ig_account' };

  const access: InstagramAccess = { accessToken, instagramUserId };
  return { ok: true, access, row };
}
