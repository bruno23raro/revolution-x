// FASE 1 — Hub de Integrações: armazenamento seguro e tenant-scoped de
// configurações de provedores (n8n, Zapier, Make, Resend, TikTok, ...) e do
// chatbot, sobre AgentMemory (RLS de tenant/usuário).
//
// Segue o MESMO padrão da config de IA (ai-config): os segredos vivem SOMENTE
// no banco, nunca no frontend/localStorage. Quem decide o que expor é a rota
// (GET nunca retorna segredo). BYPASSRLS hoje; o padrão é RLS-correto para a
// futura restrição de papel.
//
// Leitura org-wide (getChatbotConfigForOrg) é um lookup somente-leitura usado
// pelo webhook, alinhado ao padrão service_role de lookups do webhook Meta.

import type { PrismaClient, Prisma } from '@prisma/client';
import { saveMemory, listMemory } from '../lib/taskQueue';
import type { OrgScope } from '../lib/taskQueue';

const KIND = 'preference';

export const providerConfigKey = (provider: string) => `integration:${provider}`;
export const CHATBOT_KEY = 'chatbot_config';
export const TEMPLATE_SNAPSHOT_KEY = 'whatsapp_templates';

/** Valor livre por provedor (cada um define seus campos no registry). */
export type ProviderConfigValue = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Provedores — escrita/leitura com escopo de usuário (RLS user-scoped)
// ---------------------------------------------------------------------------

export async function saveProviderConfig(
  client: PrismaClient,
  scope: OrgScope,
  provider: string,
  value: ProviderConfigValue,
): Promise<void> {
  await saveMemory(client, scope, KIND, providerConfigKey(provider), value as Prisma.JsonValue);
}

export async function getProviderConfig(
  client: PrismaClient,
  scope: OrgScope,
  provider: string,
): Promise<ProviderConfigValue | null> {
  const mems = await listMemory(client, scope);
  const hit = mems.find((m) => m.key === providerConfigKey(provider));
  return hit ? (hit.value as ProviderConfigValue) : null;
}

export async function clearProviderConfig(
  client: PrismaClient,
  scope: OrgScope,
  provider: string,
): Promise<void> {
  await client.agentMemory.deleteMany({
    where: {
      organizationId: scope.organizationId,
      userId: scope.userId,
      kind: KIND,
      memoryKey: providerConfigKey(provider),
    },
  });
}

export interface ProviderStatus {
  provider: string;
  configured: boolean;
  updatedAt: Date | null;
}

export async function getProviderStatus(
  client: PrismaClient,
  scope: OrgScope,
  providers: string[],
): Promise<ProviderStatus[]> {
  const mems = await listMemory(client, scope);
  const byKey = new Map(mems.map((m) => [m.key, m] as const));
  return providers.map((p) => {
    const hit = byKey.get(providerConfigKey(p));
    return { provider: p, configured: Boolean(hit), updatedAt: hit ? hit.updatedAt : null };
  });
}

// ---------------------------------------------------------------------------
// Chatbot — escrita user-scoped; leitura org-wide para o webhook
// ---------------------------------------------------------------------------

export type ChatbotConfigValue = Record<string, unknown>;

export async function saveChatbotConfig(
  client: PrismaClient,
  scope: OrgScope,
  config: ChatbotConfigValue,
): Promise<void> {
  await saveMemory(client, scope, KIND, CHATBOT_KEY, config as Prisma.JsonValue);
}

export async function getChatbotConfig(
  client: PrismaClient,
  scope: OrgScope,
): Promise<ChatbotConfigValue | null> {
  const mems = await listMemory(client, scope);
  const hit = mems.find((m) => m.key === CHATBOT_KEY);
  return hit ? (hit.value as ChatbotConfigValue) : null;
}

/**
 * Leitura org-wide (sem escopo de usuário) para o processador de webhook.
 * Pega a configuração mais recente e ativa do tenant. Somente leitura.
 */
export async function getChatbotConfigForOrg(
  client: PrismaClient,
  organizationId: string,
): Promise<ChatbotConfigValue | null> {
  const row = await client.agentMemory.findFirst({
    where: { organizationId, kind: KIND, memoryKey: CHATBOT_KEY, supersededAt: null },
    orderBy: { updatedAt: 'desc' },
    select: { valueJson: true },
  });
  return row ? ((row.valueJson as ChatbotConfigValue) ?? null) : null;
}

// ---------------------------------------------------------------------------
// Snapshot de templates WhatsApp (cache local para o hub de templates)
// ---------------------------------------------------------------------------

export async function saveTemplateSnapshot(
  client: PrismaClient,
  scope: OrgScope,
  snapshot: unknown,
): Promise<void> {
  await saveMemory(client, scope, KIND, TEMPLATE_SNAPSHOT_KEY, snapshot as Prisma.JsonValue);
}

export async function getTemplateSnapshot(
  client: PrismaClient,
  scope: OrgScope,
): Promise<unknown | null> {
  const mems = await listMemory(client, scope);
  const hit = mems.find((m) => m.key === TEMPLATE_SNAPSHOT_KEY);
  return hit ? hit.value : null;
}
