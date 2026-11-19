// Acesso às tabelas 019 (whatsapp_channels / whatsapp_templates).
//
// Refatorado para usar Prisma (snake_case via @@map).
// As rotas já autenticam o usuário e derivam o tenant; RLS FORCE continua valendo
// para qualquer leitura por anon key.
//
// Criptografia do access_token: META_TOKEN_ENCRYPTION_KEY (AES-GCM,
// src/lib/encryption.ts) — server-side e decryptável por cron sem usuário.

import { prisma } from '@/lib/prisma';
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
  windowStartedAt: Date | null;
  lastError: string | null;
}

export interface ChannelDecrypted extends WhatsappChannelRow {
  accessToken: string | null;
  isOpenBSPConnected: boolean;
}

/** Canal do tenant com o access_token decifrado (null se não conectado). */
export async function getChannelDecrypted(organizationId: string): Promise<ChannelDecrypted | null> {
  const row = await prisma.whatsappChannel.findUnique({
    where: { organizationId },
  });
  if (!row) return null;

  // Verifica se há conexão Meta (wabaId + accessToken) OU OpenBSP (phoneNumberId presente)
  const isMetaConnected = !!row.wabaId && row.accessTokenEnc ? true : false;
  const isOpenBSPConnected = !!row.phoneNumberId;

  let accessToken: string | null = null;
  if (isMetaConnected) {
    try {
      const decrypted = row.accessTokenEnc ? decryptToken(row.accessTokenEnc) : null;
      accessToken = decrypted ?? null;
    } catch {
      accessToken = null;
    }
  }

  return {
    ...row,
    accessToken: accessToken ?? null,
    isOpenBSPConnected: !!isOpenBSPConnected,
  };
}

/** Canal pelo phone_number_id (roteamento do webhook Meta → tenant). */
export async function getChannelByPhoneNumberId(phoneNumberId: string): Promise<WhatsappChannelRow | null> {
  const row = await prisma.whatsappChannel.findFirst({
    where: { phoneNumberId },
  });
  return row ?? null;
}

/** Pré-provisiona o canal no connect (verify_token único por tenant). */
export async function upsertChannelPending(
  input: { organizationId: string; verifyToken: string; callbackUrl: string; onboardingTokenId: string },
): Promise<void> {
  await prisma.whatsappChannel.upsert({
    where: { organizationId: input.organizationId },
    create: {
      organizationId: input.organizationId,
      provider: 'openbsp',
      status: 'PENDING',
      verifyToken: input.verifyToken,
      callbackUrl: input.callbackUrl,
      onboardingTokenId: input.onboardingTokenId,
    },
    update: {
      status: 'PENDING',
      verifyToken: input.verifyToken,
      callbackUrl: input.callbackUrl,
      onboardingTokenId: input.onboardingTokenId,
      updatedAt: new Date(),
    },
  });
}

/** Confirma conexão: credenciais do plano OpenBSP, token cifrado em repouso. */
export async function markChannelConnected(
  organizationId: string,
  creds: { wabaId?: string | null; phoneNumberId: string; phoneNumber?: string | null; verifiedName?: string | null; accessToken: string },
): Promise<void> {
  await prisma.whatsappChannel.update({
    where: { organizationId },
    data: {
      status: 'CONNECTED',
      wabaId: creds.wabaId ?? null,
      phoneNumberId: creds.phoneNumberId,
      phoneNumber: creds.phoneNumber ?? null,
      verifiedName: creds.verifiedName ?? null,
      accessTokenEnc: encryptToken(creds.accessToken),
      lastError: null,
      updatedAt: new Date(),
    },
  });
}

export async function setChannelStatus(
  organizationId: string,
  status: 'PENDING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR',
  lastError?: string | null,
): Promise<void> {
  await prisma.whatsappChannel.update({
    where: { organizationId },
    data: { status, lastError: lastError ?? null, updatedAt: new Date() },
  });
}

/** Remove todas as linhas de whatsapp_channels para um organizationId específico. */
export async function deleteAllChannels(organizationId: string): Promise<void> {
  await prisma.whatsappChannel.deleteMany({
    where: { organizationId },
  });
}

/** Contador da janela móvel de 24h do tier (250/24h em número novo). */
export async function bumpSentWindow(channel: WhatsappChannelRow, n = 1): Promise<void> {
  const start = channel.windowStartedAt ? new Date(channel.windowStartedAt).getTime() : 0;
  const fresh = Date.now() - start > 86_400_000;
  await prisma.whatsappChannel.update({
    where: { organizationId: channel.organizationId },
    data: {
      sentWindow24h: fresh ? n : channel.sentWindow24h + n,
      windowStartedAt: fresh ? new Date() : channel.windowStartedAt,
      updatedAt: new Date(),
    },
  });
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
  lastCheckedAt: Date | null;
}

export async function listTemplateRows(organizationId: string): Promise<WhatsappTemplateRow[]> {
  const rows = await prisma.whatsappTemplate.findMany({
    where: { organizationId },
    orderBy: { name: 'asc' },
  });
  return rows;
}

export async function upsertTemplateRow(
  row: { organizationId: string; name: string; language: string; category: string; status: string; metaTemplateId?: string | null; componentsJson?: unknown; rejectionReason?: string | null },
): Promise<void> {
  await prisma.whatsappTemplate.upsert({
    where: {
      organizationId_name_language: {
        organizationId: row.organizationId,
        name: row.name,
        language: row.language,
      },
    },
    create: {
      organizationId: row.organizationId,
      name: row.name,
      language: row.language,
      category: row.category,
      status: row.status,
      metaTemplateId: row.metaTemplateId,
      componentsJson: row.componentsJson ?? [],
      rejectionReason: row.rejectionReason,
      updatedAt: new Date(),
    },
    update: {
      status: row.status,
      metaTemplateId: row.metaTemplateId,
      componentsJson: row.componentsJson ?? [],
      rejectionReason: row.rejectionReason,
      updatedAt: new Date(),
    },
  });
}

/** Gate 2: só template local APROVADO libera disparo em massa. */
export async function getApprovedTemplate(
  organizationId: string,
  name: string,
  language: string,
): Promise<WhatsappTemplateRow | null> {
  const row = await prisma.whatsappTemplate.findFirst({
    where: {
      organizationId,
      name,
      language,
      status: 'APPROVED',
    },
  });
  return row ?? null;
}