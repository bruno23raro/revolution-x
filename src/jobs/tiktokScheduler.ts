// FASE 4 · slice 1 — Executor de agendamento de TikTok (fila de jobs).
//
// A API oficial do TikTok NÃO tem `scheduled_start_time`: o agendamento em
// `/api/tiktok/publish` persiste a INTENÇÃO em AgentMemory (key
// `pending:tiktok_posts`, kind `preference`). Este módulo é o EXECUTOR dessa
// fila: num tick, encontra os itens com prazo vencido, publica via Content
// Posting API oficial e marca o resultado (published/failed) na própria fila.
//
// Design:
//  • Núcleo puro (`selectDuePosts`, `runDueTikTokPosts`) com dependências
//    injetáveis (`TickDeps`) — testável sem rede nem banco, no padrão da casa.
//  • Backend persistente sobre a infra EXISTENTE (AgentMemory/Postgres c/ RLS
//    de tenant) — zero dependências novas (sem Redis/BullMQ/Inngest obrigatórios).
//    O contrato `TickDeps` é o ponto de extensão: um adaptador BullMQ (com
//    `REDIS_URL` [HUMANO]) ou Inngest (`INNGEST_*` [HUMANO]) alimenta o mesmo
//    executor, sem tocar nele.
//
// NUNCA lança: devolve `{ ok, due, published, failed, reasons, error?, detail? }`
// e degrada com honestidade (fila ausente → `queue_unavailable`; acesso TikTok
// indisponível → os itens permanecem pendentes e o tick reporta o motivo).

import { Prisma, PrismaClient } from '@prisma/client';
import type { OrgScope } from '@/lib/taskQueue';
import { saveMemory, TaskQueueUnavailableError } from '@/lib/taskQueue';
import {
  markPendingTikTokPost,
  publishTikTokVideo,
  type PendingTikTokPost,
  type PublishVideoResult,
  type PublishVideoSpec,
  type TikTokAccess,
} from '@/integrations/tiktok/tiktokPublisher';
import {
  PENDING_KEY,
  listPendingTikTokPosts,
  resolveTenantTikTokAccess,
  type ResolveTikTokResult,
} from '@/integrations/tiktok/resolveAccess';

// ---------------------------------------------------------------------------
// Contrato de dependências (injetável / backend-agnóstico)
// ---------------------------------------------------------------------------

export interface TickDeps {
  /** Lê a fila atual de posts pendentes (vazia se ausente). */
  listPending: () => Promise<PendingTikTokPost[]>;
  /** Persiste a fila inteira (upsert no mesmo key de AgentMemory). */
  savePending: (items: PendingTikTokPost[]) => Promise<void>;
  /** Resolve a credencial TikTok do tenant (não lança — retorna ok/reason). */
  getAccess: () => Promise<ResolveTikTokResult>;
  /** Publica um vídeo pela API oficial (não lança — retorna ok/error). */
  publish: (access: TikTokAccess, spec: PublishVideoSpec) => Promise<PublishVideoResult>;
}

export interface TickOptions {
  /** Relógio determinístico (padrão: new Date()). */
  now?: () => Date;
  /** Máx. de itens por tick (padrão: 10). */
  limit?: number;
}

export interface TickResult {
  ok: boolean;
  /** Itens com prazo vencido e pendentes no tick. */
  due: number;
  published: number;
  failed: number;
  /** Motivos honestos por item/acesso (sem segredos). */
  reasons: string[];
  /** Código de erro de topo (quando `ok: false`). */
  error?: 'queue_unavailable' | 'list_failed' | 'access_failed' | 'save_failed' | string;
  detail?: string;
}

// ---------------------------------------------------------------------------
// Núcleo puro
// ---------------------------------------------------------------------------

/**
 * Seleciona, de forma determinística, os posts com prazo vencido:
 * `status === 'pending'` (ou ausente) e `scheduledAt <= nowMs`, ordenados do
 * mais antigo para o mais novo, limitado a `limit`. Não modifica a entrada.
 */
export function selectDuePosts(
  list: PendingTikTokPost[] | null | undefined,
  nowMs: number,
  limit = 10,
): PendingTikTokPost[] {
  const cap = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10;
  const due: Array<{ p: PendingTikTokPost; t: number }> = [];
  for (const p of list ?? []) {
    if ((p.status ?? 'pending') !== 'pending') continue;
    const t = Date.parse(p.scheduledAt);
    if (Number.isNaN(t) || t > nowMs) continue;
    due.push({ p, t });
  }
  due.sort((a, b) => a.t - b.t);
  return due.slice(0, cap).map((x) => x.p);
}

// ---------------------------------------------------------------------------
// Executor (tick)
// ---------------------------------------------------------------------------

/**
 * Executa UM tick do agendador. Fluxo:
 *   1. Lê a fila (fila ausente → `queue_unavailable`, sem lançar).
 *   2. Seleciona os vencidos (vencidos vazios → `ok` com `due: 0`, sem salvar).
 *   3. Resolve o acesso TikTok — indisponível → itens permanecem pendentes
 *      (o agendamento continua esperando) e o tick reporta o motivo.
 *   4. Publica item a item; sucesso → marca `published` + `publishId`;
 *      falha → marca `failed` + motivo em `reasons`.
 *   5. Salva a fila UMA vez (evita N escritas; estado parcial é honesto).
 */
export async function runDueTikTokPosts(deps: TickDeps, opts: TickOptions = {}): Promise<TickResult> {
  const nowMs = (opts.now ?? (() => new Date()))().getTime();
  const limit = opts.limit ?? 10;

  let list: PendingTikTokPost[];
  try {
    list = await deps.listPending();
  } catch (e) {
    if (e instanceof TaskQueueUnavailableError) {
      return { ok: false, due: 0, published: 0, failed: 0, reasons: [], error: 'queue_unavailable', detail: e.message };
    }
    return { ok: false, due: 0, published: 0, failed: 0, reasons: [], error: 'list_failed', detail: String((e as Error)?.message ?? e) };
  }

  const due = selectDuePosts(list, nowMs, limit);
  if (due.length === 0) {
    return { ok: true, due: 0, published: 0, failed: 0, reasons: [] };
  }

  let resolved: ResolveTikTokResult;
  try {
    resolved = await deps.getAccess();
  } catch (e) {
    return { ok: false, due: due.length, published: 0, failed: 0, reasons: [], error: 'access_failed', detail: String((e as Error)?.message ?? e) };
  }
  if (!resolved.ok) {
    // Acesso indisponível: os itens seguem pendentes (o agendamento espera o
    // provedor) — não marcamos como failed para não perder a intenção.
    return {
      ok: false,
      due: due.length,
      published: 0,
      failed: 0,
      reasons: [`TikTok indisponível (${resolved.reason}) — ${due.length} post(s) seguem pendentes`],
      error: resolved.reason,
    };
  }

  let next = list;
  let published = 0;
  let failed = 0;
  const reasons: string[] = [];
  for (const item of due) {
    const r = await deps.publish(resolved.access, item.spec);
    if (r.ok) {
      next = markPendingTikTokPost(next, item.id, { status: 'published', publishId: r.publishId });
      published += 1;
    } else {
      next = markPendingTikTokPost(next, item.id, { status: 'failed' });
      failed += 1;
      reasons.push(`post ${item.id}: ${r.error}${r.errorDetail ? ` (${r.errorDetail})` : ''}`);
    }
  }

  try {
    await deps.savePending(next);
  } catch (e) {
    const detail = e instanceof TaskQueueUnavailableError ? e.message : String((e as Error)?.message ?? e);
    return {
      ok: false,
      due: due.length,
      published,
      failed,
      reasons,
      error: e instanceof TaskQueueUnavailableError ? 'queue_unavailable' : 'save_failed',
      detail,
    };
  }

  return { ok: failed === 0, due: due.length, published, failed, reasons };
}

// ---------------------------------------------------------------------------
// Visão para UI (sem segredos — apenas campos públicos da intenção)
// ---------------------------------------------------------------------------

export interface PendingTikTokView {
  id: string;
  scheduledAt: string;
  status: 'pending' | 'published' | 'failed';
  publishId?: string;
  videoUrl?: string;
  caption?: string;
}

/** Projeta a fila para a UI (últimos 50 itens, do mais antigo ao mais novo). */
export function projectPending(list: PendingTikTokPost[] | null | undefined): PendingTikTokView[] {
  const items = list ?? [];
  return items.slice(-50).map((p) => ({
    id: p.id,
    scheduledAt: p.scheduledAt,
    status: p.status ?? 'pending',
    publishId: p.publishId,
    videoUrl: p.spec?.videoUrl,
    caption: p.spec?.caption,
  }));
}

// ---------------------------------------------------------------------------
// Adaptador para o backend persistente atual (AgentMemory via Prisma)
// ---------------------------------------------------------------------------

/**
 * Vincula `TickDeps` ao backend AgentMemory (mesmo armazenamento da fila de
 * agendamento escrita em `/api/tiktok/publish`). Se um backend BullMQ/Inngest
 * (credenciais [HUMANO]) substituir a persistência, troca-se APENAS este
 * adaptador — o executor não muda.
 */
export function bindTikTokSchedulerDeps(client: PrismaClient, scope: OrgScope): TickDeps {
  return {
    listPending: () => listPendingTikTokPosts(client, scope),
    savePending: (items) =>
      saveMemory(client, scope, 'preference', PENDING_KEY, items as unknown as Prisma.JsonValue),
    getAccess: () => resolveTenantTikTokAccess(client, scope),
    publish: (access, spec) => publishTikTokVideo(access, spec),
  };
}

/** Lista a fila pendente projetada para UI (propaga `TaskQueueUnavailableError`). */
export async function listPendingTikTokView(client: PrismaClient, scope: OrgScope): Promise<PendingTikTokView[]> {
  const list = await listPendingTikTokPosts(client, scope);
  return projectPending(list);
}
