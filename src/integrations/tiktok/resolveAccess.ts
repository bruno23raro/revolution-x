// FASE 2 · slice 3 — Resolve a credencial do TikTok de um tenant para
// publicar/trackear via Content Posting API oficial.
//
// Diferente dos resolvers da Meta (que leem a tabela Supabase
// `meta_integrations` via service_role), o TikTok mora em AgentMemory
// (Prisma, RLS de tenant/usuário) — o MESMO armazenamento dos outros
// provedores do Hub de Integrações (n8n, Zapier, ...). O segredo (token) vive
// SÓ no banco, nunca no front-end. `client` (PrismaClient) e `scope`
// ({organizationId, userId}) são argumentos, então isto é testável sem rede
// nem banco.
//
// Se a fila/memória não está disponível (tabela não migrada no ambiente),
// `listMemory` lança `TaskQueueUnavailableError` — o chamador (rota) decide
// degradar (503). Não capturamos aqui para não mascarar o erro.

import type { PrismaClient, Prisma } from '@prisma/client';
import type { OrgScope } from '@/lib/taskQueue';
import { listMemory, saveMemory, TaskQueueUnavailableError } from '@/lib/taskQueue';
import { appendPendingTikTokPost } from './tiktokPublisher';
import type { TikTokAccess, PendingTikTokPost } from './tiktokPublisher';

const PROVIDER = 'tiktok';
export const PENDING_KEY = 'pending:tiktok_posts';

export type ResolveTikTokReason = 'not_connected' | 'no_token' | 'queue_unavailable';

export type ResolveTikTokResult =
  | {
      ok: true;
      access: TikTokAccess;
      /** Presença de clientKey/clientSecret (necessária para OAUTH no futuro). */
      hasClientKey: boolean;
      hasClientSecret: boolean;
    }
  | { ok: false; reason: ResolveTikTokReason };

/**
 * Lê a config `tiktok` em AgentMemory e devolve o `TikTokAccess` pronto para
 * o publicador. Não altera outros resolvers. Não lança `TaskQueueUnavailableError`
 * (propaga para a rota).
 */
export async function resolveTenantTikTokAccess(
  client: PrismaClient,
  scope: OrgScope,
): Promise<ResolveTikTokResult> {
  let mems: Awaited<ReturnType<typeof listMemory>>;
  try {
    mems = await listMemory(client, scope);
  } catch (e) {
    if (e instanceof TaskQueueUnavailableError) return { ok: false, reason: 'queue_unavailable' };
    throw e;
  }
  const hit = mems.find((m) => m.key === `integration:${PROVIDER}`);
  if (!hit) return { ok: false, reason: 'not_connected' };

  const cfg = (hit.value ?? {}) as Record<string, unknown>;
  const accessToken = typeof cfg.accessToken === 'string' ? cfg.accessToken.trim() : '';
  if (!accessToken) return { ok: false, reason: 'no_token' };

  const hasClientKey = typeof cfg.clientKey === 'string' && cfg.clientKey.length > 0;
  const hasClientSecret = typeof cfg.clientSecret === 'string' && cfg.clientSecret.length > 0;

  const access: TikTokAccess = { accessToken };
  return { ok: true, access, hasClientKey, hasClientSecret };
}

// ---------------------------------------------------------------------------
// Fila persistente de agendamento (intenção) — a API oficial não tem horário.
// ---------------------------------------------------------------------------

/** Lê a fila atual de posts pendentes (vazia se ausente). */
export async function listPendingTikTokPosts(
  client: PrismaClient,
  scope: OrgScope,
): Promise<PendingTikTokPost[]> {
  const mems = await listMemory(client, scope);
  const hit = mems.find((m) => m.key === PENDING_KEY);
  if (!hit) return [];
  const value = hit.value;
  return Array.isArray(value) ? (value as unknown as PendingTikTokPost[]) : [];
}

/** Acrescenta uma intenção na fila (upsert no mesmo key de AgentMemory). */
export async function addPendingTikTokPost(
  client: PrismaClient,
  scope: OrgScope,
  item: PendingTikTokPost,
): Promise<void> {
  const current = await listPendingTikTokPosts(client, scope);
  const next = appendPendingTikTokPost(current, item);
  await saveMemory(client, scope, 'preference', PENDING_KEY, next as unknown as Prisma.JsonValue);
}
