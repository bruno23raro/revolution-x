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
}

async function findOrg(client: Query, organizationId: string): Promise<WhatsappChannelRow | null> {
  const { data, error } = await client
    .from('whatsapp_channels')
    .select('*')
    .eq('organizationId', organizationId)
    .maybeSingle();
  if (error || !data) return null;
  return data as WhatsappChannelRow;
}

/** Canal do tenant com o access_token decifrado (null se não conectado). */
export async function getChannelDecrypted(client: Query, organizationId: string): Promise<ChannelDecrypted | null> {
  const row = await findOrg(client, organizationId);
  if (!row) return null;
  let accessToken: string | null = null;
  if (row.accessTokenEnc) {
    try {
      accessToken = decryptToken(row.accessTokenEnc);
    } catch {
      accessToken = null;
    }
  }
  return { ...row, accessToken };
}

/** Canal pelo phone_number_id (roteamento do webhook Meta → tenant). */
export async function getChannelByPhoneNumberId(client: Query, phoneNumberId: string): Promise<WhatsappChannelRow | null> {
  const { data, error } = await client
    .from('whatsapp_channels')
    .select('*')
    .eq('phoneNumberId', phoneNumberId)
    .maybeSingle();
  if (error || !data) return null;
  return data as WhatsappChannelRow;
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
        organizationId: input.organizationId,
        provider: 'openbsp',
        status: 'PENDING',
        verifyToken: input.verifyToken,
        callbackUrl: input.callbackUrl,
        onboardingTokenId: input.onboardingTokenId,
        updatedAt: new Date().toISOString(),
      },
      { onConflict: 'organizationId' },
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
      wabaId: creds.wabaId ?? null,
      phoneNumberId: creds.phoneNumberId,
      phoneNumber: creds.phoneNumber ?? null,
      verifiedName: creds.verifiedName ?? null,
      accessTokenEnc: encryptToken(creds.accessToken),
      lastError: null,
      updatedAt: new Date().toISOString(),
    })
    .eq('organizationId', organizationId);
}

export async function setChannelStatus(
  client: Query,
  organizationId: string,
  status: 'PENDING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR',
  lastError?: string | null,
): Promise<void> {
  await client
    .from('whatsapp_channels')
    .update({ status, lastError: lastError ?? null, updatedAt: new Date().toISOString() })
    .eq('organizationId', organizationId);
}

/** Contador da janela móvel de 24h do tier (250/24h em número novo). */
export async function bumpSentWindow(client: Query, channel: WhatsappChannelRow, n = 1): Promise<void> {
  const start = channel.windowStartedAt ? new Date(channel.windowStartedAt).getTime() : 0;
  const fresh = Date.now() - start > 86_400_000;
  await client
    .from('whatsapp_channels')
    .update({
      sentWindow24h: fresh ? n : channel.sentWindow24h + n,
      windowStartedAt: fresh ? new Date().toISOString() : channel.windowStartedAt,
      updatedAt: new Date().toISOString(),
    })
    .eq('organizationId', channel.organizationId);
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
    .eq('organizationId', organizationId)
    .order('name', { ascending: true });
  if (error || !Array.isArray(data)) return [];
  return data as WhatsappTemplateRow[];
}

export async function upsertTemplateRow(
  client: Query,
  row: { organizationId: string; name: string; language: string; category: string; status: string; metaTemplateId?: string | null; componentsJson?: unknown; rejectionReason?: string | null },
): Promise<void> {
  await client
    .from('whatsapp_templates')
    .upsert({ ...row, updatedAt: new Date().toISOString() }, { onConflict: 'organizationId,name,language' });
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
    .eq('organizationId', organizationId)
    .eq('name', name)
    .eq('language', language)
    .eq('status', 'APPROVED')
    .maybeSingle();
  if (error || !data) return null;
  return data as WhatsappTemplateRow;
}
