// Acesso às tabelas 019 (whatsapp_channels / whatsapp_templates).
//
// `client` é injetável (padrão dos crons/testes); no app passa-se
// createServiceRoleClient() — as rotas já autenticam o usuário e derivam o
// tenant; RLS FORCE continua valendo para qualquer leitura por anon key.
//
// Criptografia do access_token: META_TOKEN_ENCRYPTION_KEY (AES-GCM,
// src/lib/encryption.ts) — server-side e decryptável por cron sem usuário.

import { encryptToken, decryptToken } from '@/lib/encryption';

export interface WhatsappChannelRow {
  id: string;
  organizationId: string;
  provider: string;
  status: string;
  onboardingTokenId: string | null;
  callbackUrl: string | null;
  verifyToken: string;
  wabaId: string | null;
  phoneNumberId: string | null;
  phoneNumber: string | null;
  verifiedName: string | null;
  accessTokenEnc: string | null;
  tierLimitPer24h: number;
  sentWindow24h: number;
  windowStartedAt: string | null;
  lastError: string | null;
}

type Query = {
  from: (table: string) => {
    select: (cols: string) => any;
    upsert: (row: unknown, opts?: Record<string, unknown>) => any;
    update: (patch: Record<string, unknown>) => any;
  };
};

export interface ChannelDecrypted extends WhatsappChannelRow {
  accessToken: string | null;
  isOpenBSPConnected: boolean;
}

async function findOrg(client: Query, organizationId: string): Promise<WhatsappChannelRow | null> {
  const { data, error } = await client
    .from('whatsapp_channels')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error || !data) return null;
  // PostgREST retorna snake_case, precisamos transformar para a interface camelCase
  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    provider: row.provider as string,
    status: row.status as string,
    onboardingTokenId: row.onboarding_token_id as string | null,
    callbackUrl: row.callback_url as string | null,
    verifyToken: row.verify_token as string,
    wabaId: row.waba_id as string | null,
    phoneNumberId: row.phone_number_id as string | null,
    phoneNumber: row.phone_number as string | null,
    verifiedName: row.verified_name as string | null,
    accessTokenEnc: row.access_token_enc as string | null,
    tierLimitPer24h: row.tier_limit_per_24h as number,
    sentWindow24h: row.sent_window_24h as number,
    windowStartedAt: row.window_started_at as string | null,
    lastError: row.last_error as string | null,
  } as WhatsappChannelRow;
}

/** Canal do tenant com o access_token decifrado (null se não conectado). */
export async function getChannelDecrypted(client: Query, organizationId: string): Promise<ChannelDecrypted | null> {
  const row = await findOrg(client, organizationId);
  if (!row) return null;

  // Verifica se há conexão Meta (wabaId + accessToken) OU OpenBSP (phoneNumberId presente)
  const isMetaConnected = !!row.wabaId && row.accessTokenEnc ? true : false;
  const isOpenBSPConnected = row.phoneNumberId;

  let accessToken: string | null = null;
  if (isMetaConnected) {
    try {
      const decrypted = row.accessTokenEnc ? decryptToken(row.accessTokenEnc) : null;
      accessToken = decrypted ?? null;
    } catch {
      accessToken = null;
    }
  }

  return { ...row, accessToken: accessToken ?? null, isOpenBSPConnected: !!isOpenBSPConnected };
}

/** Canal pelo phone_number_id (roteamento do webhook Meta → tenant). */
export async function getChannelByPhoneNumberId(client: Query, phoneNumberId: string): Promise<WhatsappChannelRow | null> {
  const { data, error } = await client
    .from('whatsapp_channels')
    .select('*')
    .eq('phone_number_id', phoneNumberId)
    .maybeSingle();
  if (error || !data) return null;
  // PostgREST retorna snake_case, precisamos transformar para a interface camelCase
  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    provider: row.provider as string,
    status: row.status as string,
    onboardingTokenId: row.onboarding_token_id as string | null,
    callbackUrl: row.callback_url as string | null,
    verifyToken: row.verify_token as string,
    wabaId: row.waba_id as string | null,
    phoneNumberId: row.phone_number_id as string | null,
    phoneNumber: row.phone_number as string | null,
    verifiedName: row.verified_name as string | null,
    accessTokenEnc: row.access_token_enc as string | null,
    tierLimitPer24h: row.tier_limit_per_24h as number,
    sentWindow24h: row.sent_window_24h as number,
    windowStartedAt: row.window_started_at as string | null,
    lastError: row.last_error as string | null,
  } as WhatsappChannelRow;
}

/** Pré-provisiona o canal no connect (verify_token único por tenant). */
export async function upsertChannelPending(
  client: Query,
  input: { organizationId: string; verifyToken: string; callbackUrl: string; onboardingTokenId: string },
): Promise<void> {
  await client
    .from('whatsapp_channels')
    .upsert(
      {
        organization_id: input.organizationId,
        provider: 'openbsp',
        status: 'PENDING',
        verify_token: input.verifyToken,
        callback_url: input.callbackUrl,
        onboarding_token_id: input.onboardingTokenId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id' },
    );
}

/** Confirma conexão: credenciais do plano OpenBSP, token cifrado em repouso. */
export async function markChannelConnected(
  client: Query,
  organizationId: string,
  creds: { wabaId?: string | null; phoneNumberId: string; phoneNumber?: string | null; verifiedName?: string | null; accessToken: string },
): Promise<void> {
  await client
    .from('whatsapp_channels')
    .update({
      status: 'CONNECTED',
      waba_id: creds.wabaId ?? null,
      phone_number_id: creds.phoneNumberId,
      phone_number: creds.phoneNumber ?? null,
      verified_name: creds.verifiedName ?? null,
      access_token_enc: encryptToken(creds.accessToken),
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', organizationId);
}

export async function setChannelStatus(
  client: Query,
  organizationId: string,
  status: 'PENDING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR',
  lastError?: string | null,
): Promise<void> {
  await client
    .from('whatsapp_channels')
    .update({ status, last_error: lastError ?? null, updated_at: new Date().toISOString() })
    .eq('organization_id', organizationId);
}

/** Contador da janela móvel de 24h do tier (250/24h em número novo). */
export async function bumpSentWindow(client: Query, channel: WhatsappChannelRow, n = 1): Promise<void> {
  const start = channel.windowStartedAt ? new Date(channel.windowStartedAt).getTime() : 0;
  const fresh = Date.now() - start > 86_400_000;
  await client
    .from('whatsapp_channels')
    .update({
      sent_window_24h: fresh ? n : channel.sentWindow24h + n,
      window_started_at: fresh ? new Date().toISOString() : channel.windowStartedAt,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', channel.organizationId);
}

// ── whatsapp_templates (espelho local do status Meta) ────────────────────────

export interface WhatsappTemplateRow {
  id: string;
  organizationId: string;
  metaTemplateId: string | null;
  name: string;
  language: string;
  category: string;
  status: string;
  componentsJson: unknown;
  rejectionReason: string | null;
  lastCheckedAt: string | null;
}

export async function listTemplateRows(client: Query, organizationId: string): Promise<WhatsappTemplateRow[]> {
  const { data, error } = await client
    .from('whatsapp_templates')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true });
  if (error || !Array.isArray(data)) return [];
  // PostgREST retorna snake_case, precisamos transformar para a interface camelCase
  return (data as Record<string, unknown>[]).map(row => ({
    id: row.id as string,
    organizationId: row.organization_id as string,
    metaTemplateId: row.meta_template_id as string | null,
    name: row.name as string,
    language: row.language as string,
    category: row.category as string,
    status: row.status as string,
    componentsJson: row.components_json,
    rejectionReason: row.rejection_reason as string | null,
    lastCheckedAt: row.last_checked_at as string | null,
  }));
}

export async function upsertTemplateRow(
  client: Query,
  row: { organizationId: string; name: string; language: string; category: string; status: string; metaTemplateId?: string | null; componentsJson?: unknown; rejectionReason?: string | null },
): Promise<void> {
  await client
    .from('whatsapp_templates')
    .upsert({
      organization_id: row.organizationId,
      name: row.name,
      language: row.language,
      category: row.category,
      status: row.status,
      meta_template_id: row.metaTemplateId,
      components_json: row.componentsJson,
      rejection_reason: row.rejectionReason,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,name,language' });
}

/** Gate 2: só template local APROVADO libera disparo em massa. */
export async function getApprovedTemplate(
  client: Query,
  organizationId: string,
  name: string,
  language: string,
): Promise<WhatsappTemplateRow | null> {
  const { data, error } = await client
    .from('whatsapp_templates')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('name', name)
    .eq('language', language)
    .eq('status', 'APPROVED')
    .maybeSingle();
  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    metaTemplateId: row.meta_template_id as string | null,
    name: row.name as string,
    language: row.language as string,
    category: row.category as string,
    status: row.status as string,
    componentsJson: row.components_json,
    rejectionReason: row.rejection_reason as string | null,
    lastCheckedAt: row.last_checked_at as string | null,
  };
}
