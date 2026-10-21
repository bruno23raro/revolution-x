// FASE 1 — Resolver a credencial Meta (WhatsApp) de um tenant.
//
// Lê a linha da tabela REAL `meta_integrations` (snake_case — ver dual-schema
// drift) via service_role (lookup privilegiado/leitura), descriptografa o
// access token (AES-256-GCM) e devolve um `MetaWABAccess` pronto para o
// sender. `createServiceRoleClient` é injetável para testes sem Supabase.

import { createServiceRoleClient } from '@/lib/supabase/server';
import { decryptToken } from '@/lib/encryption';
import type { PrismaClient } from '@prisma/client';
import { TaskQueueUnavailableError } from '@/lib/taskQueue';
import type { OrgScope } from '@/lib/taskQueue';
import { getProviderConfig } from '@/integrations/configStore';
import type { TemplatesAccess } from './whatsappTemplates';
import type { InstagramAccess } from './instagramPublisher';
import type { FacebookPageAccess } from './facebookPublisher';
import type { MetaAdsAccess } from './adsInsights';

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
  | {
      ok: false;
      reason: 'not_connected' | 'no_token' | 'decrypt_failed' | 'account_not_found';
    };

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
  accountId?: string,
): Promise<ResolveResult> {
  const service = deps.serviceRole ?? createServiceRoleClient();
  // MULTICONTAS — seleção determinística: a mais recente (`connected_at` desc)
  // evita o `.limit(1)` não-ordenado (ordem arbitrária). `accountId` (row id)
  // ancora a conta específica; ausente → conta padrão.
  let q = service
    .from('meta_integrations')
    .select('id, provider, phone_number_id, whatsapp_business_account_id, meta_app_id, encrypted_access_token, token_expires_at, status')
    .eq('organization_id', organizationId)
    .in('provider', ['whatsapp', 'facebook'])
    .neq('status', 'DISCONNECTED')
    .order('connected_at', { ascending: false });
  if (accountId) q = q.eq('id', accountId);
  const { data, error } = await q.limit(1).maybeSingle();

  if (error || !data) {
    return { ok: false, reason: accountId ? 'account_not_found' : 'not_connected' };
  }

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
      reason: 'not_connected' | 'no_token' | 'decrypt_failed' | 'no_ig_account' | 'account_not_found';
    };

/**
 * Resolve o access token + `instagram_account_id` de um tenant para publicar
 * via Graph API oficial. Mesma linha privilegiada (`meta_integrations`) e
 * descriptografia do WhatsApp, mas seleciona também os IDs de Instagram.
 * Injetável (`serviceRole`) para testes. Não altera `resolveTenantMetaAccess`.
 * MULTICONTAS: `accountId` (row id) ancora a conta específica; seleção
 * determinística por `connected_at desc`.
 */
export async function resolveTenantPublisherAccess(
  organizationId: string,
  deps: ResolveDeps = {},
  accountId?: string,
): Promise<ResolvePublisherResult> {
  const service = deps.serviceRole ?? createServiceRoleClient();
  let q = service
    .from('meta_integrations')
    .select(
      'id, provider, meta_page_id, instagram_account_id, encrypted_access_token, token_expires_at, status',
    )
    .eq('organization_id', organizationId)
    .in('provider', ['instagram', 'facebook', 'whatsapp'])
    .neq('status', 'DISCONNECTED')
    .order('connected_at', { ascending: false });
  if (accountId) q = q.eq('id', accountId);
  const { data, error } = await q.limit(1).maybeSingle();

  if (error || !data) {
    return { ok: false, reason: accountId ? 'account_not_found' : 'not_connected' };
  }

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

// ---------------------------------------------------------------------------
// FASE 2 — Resolver a credencial para publicar em Página do Facebook.
// ---------------------------------------------------------------------------

export type ResolveFacebookPageResult =
  | { ok: true; access: FacebookPageAccess; row: PublisherRow }
  | {
      ok: false;
      reason: 'not_connected' | 'no_token' | 'decrypt_failed' | 'no_fb_page' | 'account_not_found';
    };

/**
 * Resolve o access token + `meta_page_id` de um tenant para publicar/agendar
 * posts de Página via Graph API oficial. Mesma linha privilegiada
 * (`meta_integrations`) e descriptografia do WhatsApp; seleciona o ID da
 * Página. Injetável (`serviceRole`) para testes. Não altera as demais funções.
 * MULTICONTAS: `accountId` (row id) ancora a conta específica; seleção
 * determinística por `connected_at desc`.
 */
export async function resolveTenantFacebookPageAccess(
  organizationId: string,
  deps: ResolveDeps = {},
  accountId?: string,
): Promise<ResolveFacebookPageResult> {
  const service = deps.serviceRole ?? createServiceRoleClient();
  let q = service
    .from('meta_integrations')
    .select(
      'id, provider, meta_page_id, instagram_account_id, encrypted_access_token, token_expires_at, status',
    )
    .eq('organization_id', organizationId)
    .in('provider', ['facebook', 'whatsapp'])
    .neq('status', 'DISCONNECTED')
    .order('connected_at', { ascending: false });
  if (accountId) q = q.eq('id', accountId);
  const { data, error } = await q.limit(1).maybeSingle();

  if (error || !data) {
    return { ok: false, reason: accountId ? 'account_not_found' : 'not_connected' };
  }

  const row = data as unknown as PublisherRow;
  if (!row.encrypted_access_token) return { ok: false, reason: 'no_token' };

  let accessToken: string;
  try {
    accessToken = decryptToken(row.encrypted_access_token);
  } catch {
    return { ok: false, reason: 'decrypt_failed' };
  }

  const facebookPageId = row.meta_page_id ?? '';
  if (!facebookPageId) return { ok: false, reason: 'no_fb_page' };

  const access: FacebookPageAccess = { accessToken, facebookPageId };
  return { ok: true, access, row };
}

// ---------------------------------------------------------------------------
// FASE 3 · slice 1 — Ads: resolve a credencial do Gerenciador de Anúncios
// (Meta Ad Manager / Marketing API) de um tenant.
//
// O token vem da linha privilegiada `meta_integrations` (OAuth, MESMO fluxo
// do WhatsApp); o ID da conta de anúncios (ACT) fica no AgentMemory
// (provider `meta_ads`), porque a tabela Supabase não tem essa coluna. A
// permissão `ads_read` (ou `read_insights`) no app da Meta é pré-requisito.
// ---------------------------------------------------------------------------

export type ResolveMetaAdsReason =
  | 'not_connected'
  | 'no_token'
  | 'decrypt_failed'
  | 'no_ad_account'
  | 'queue_unavailable'
  | 'account_not_found';

export type ResolveMetaAdsResult =
  | { ok: true; access: MetaAdsAccess }
  | { ok: false; reason: ResolveMetaAdsReason };

/**
 * Compõe o `MetaAdsAccess` de um tenant: token (meta_integrations,
 * descriptografado) + ID da conta de anúncios (AgentMemory `meta_ads`).
 * Injetável: `client` (Prisma) e `serviceRole` (Supabase) entram por
 * argumento/dep — testável sem rede nem banco.
 */
export async function resolveTenantMetaAdsAccess(
  client: PrismaClient,
  scope: OrgScope,
  deps: ResolveDeps = {},
  accountId?: string,
): Promise<ResolveMetaAdsResult> {
  let adAccountId: string | undefined;
  try {
    const cfg = await getProviderConfig(client, scope, 'meta_ads');
    adAccountId =
      cfg && typeof cfg.adAccountId === 'string' && cfg.adAccountId.trim()
        ? cfg.adAccountId.trim()
        : undefined;
  } catch (e) {
    if (e instanceof TaskQueueUnavailableError) return { ok: false, reason: 'queue_unavailable' };
    throw e;
  }

  const base = await resolveTenantMetaAccess(scope.organizationId, deps, accountId);
  if (!base.ok) return { ok: false, reason: base.reason };
  if (!adAccountId) return { ok: false, reason: 'no_ad_account' };

  const access: MetaAdsAccess = { accessToken: base.access.accessToken, adAccountId };
  return { ok: true, access };
}
