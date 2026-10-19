// FASE 4 · slice 1+2 — Executor de agendamento de TikTok (fila de jobs)
// c/ RETRY c/ BACKOFF EXPONENCIAL.
//
// A API oficial do TikTok NÃO tem `scheduled_start_time`: o agendamento em
// `/api/tiktok/publish` persiste a INTENÇÃO em AgentMemory (key
// `pending:tiktok_posts`, kind `preference`). Este módulo é o EXECUTOR dessa
// fila: num tick, encontra os itens com prazo vencido, publica via Content
// Posting API oficial e marca o resultado (published/failed) na própria fila.
//
// slice 2 — RETRY: falha de publicação incrementa `attempts` e, enquanto
// `attempts < maxAttempts` (padrão 3), o item VOLTA a `pending` com
// `scheduledAt` reagendado (`retryBaseDelayMs * 2^(attempts-1)`, base padrão
// 5 min) — só então vira `failed` terminal. O tick relata `retried`
// (reagendados) separado de `failed` (encerrados); `ok` considera só
// encerrados. Item com `attempts` anteriores é re-publicado normalmente no
// próximo tick vencido (retry de verdade, não re-enfileiramento cego).
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
// NUNCA lança: devolve `{ ok, due, published, failed, retried, reasons,
// error?, detail? }` e degrada com honestidade (fila ausente →
// `queue_unavailable`; acesso TikTok indisponível → os itens permanecem
// pendentes e o tick reporta o motivo).

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
  /** slice 2 — máx. de tentativas de publicação; esgotadas → `failed` (padrão: 3). */
  maxAttempts?: number;
  /** slice 2 — base do backoff exponencial (padrão: 5 min; nova tentativa em `now + base * 2^(attempts-1)`). */
  retryBaseDelayMs?: number;
}

export interface TickResult {
  ok: boolean;
  /** Itens com prazo vencido e pendentes no tick. */
  due: number;
  published: number;
  /** Falhas terminais (tentativas esgotadas) — é isso que zera o `ok`. */
  failed: number;
  /** slice 2 — falhas NÃO terminais: reagendadas c/ backoff, seguem `pending`. */
  retried: number;
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
 *      falha → incrementa `attempts` e, até `maxAttempts`, REAGENDA
 *      (`pending` c/ `scheduledAt = now + base * 2^(attempts-1)`); só após
 *      esgotar vira `failed` terminal (slice 2).
 *   5. Salva a fila UMA vez (evita N escritas; estado parcial é honesto).
 */
export async function runDueTikTokPosts(deps: TickDeps, opts: TickOptions = {}): Promise<TickResult> {
  const nowMs = (opts.now ?? (() => new Date()))().getTime();
  const limit = opts.limit ?? 10;
  const maxAttempts = Math.max(1, Math.floor(opts.maxAttempts ?? 3));
  const retryBaseDelayMs = Number.isFinite(opts.retryBaseDelayMs) && (opts.retryBaseDelayMs as number) > 0
    ? (opts.retryBaseDelayMs as number)
    : 5 * 60 * 1000;

  let list: PendingTikTokPost[];
  try {
    list = await deps.listPending();
  } catch (e) {
    if (e instanceof TaskQueueUnavailableError) {
      return { ok: false, due: 0, published: 0, failed: 0, retried: 0, reasons: [], error: 'queue_unavailable', detail: e.message };
    }
    return { ok: false, due: 0, published: 0, failed: 0, retried: 0, reasons: [], error: 'list_failed', detail: String((e as Error)?.message ?? e) };
  }

  const due = selectDuePosts(list, nowMs, limit);
  if (due.length === 0) {
    return { ok: true, due: 0, published: 0, failed: 0, retried: 0, reasons: [] };
  }

  let resolved: ResolveTikTokResult;
  try {
    resolved = await deps.getAccess();
  } catch (e) {
    return { ok: false, due: due.length, published: 0, failed: 0, retried: 0, reasons: [], error: 'access_failed', detail: String((e as Error)?.message ?? e) };
  }
  if (!resolved.ok) {
    // Acesso indisponível: os itens seguem pendentes (o agendamento espera o
    // provedor) — não marcamos como failed para não perder a intenção.
    return {
      ok: false,
      due: due.length,
      published: 0,
      failed: 0,
      retried: 0,
      reasons: [`TikTok indisponível (${resolved.reason}) — ${due.length} post(s) seguem pendentes`],
      error: resolved.reason,
    };
  }

  let next = list;
  let published = 0;
  let failed = 0;
  let retried = 0;
  const reasons: string[] = [];
  for (const item of due) {
    const r = await deps.publish(resolved.access, item.spec);
    if (r.ok) {
      next = markPendingTikTokPost(next, item.id, { status: 'published', publishId: r.publishId });
      published += 1;
    } else {
      // slice 2 — retry c/ backoff: falha não encerra na hora.
      const attempts = (item.attempts ?? 0) + 1;
      const base = `post ${item.id}: ${r.error}${r.errorDetail ? ` (${r.errorDetail})` : ''}`;
      if (attempts < maxAttempts) {
        const delayMs = retryBaseDelayMs * 2 ** (attempts - 1);
        const nextAt = new Date(nowMs + delayMs).toISOString();
        next = markPendingTikTokPost(next, item.id, {
          status: 'pending',
          attempts,
          scheduledAt: nextAt,
        });
        retried += 1;
        reasons.push(`${base} — nova tentativa em ${nextAt} (tentativa ${attempts}/${maxAttempts})`);
      } else {
        next = markPendingTikTokPost(next, item.id, { status: 'failed', attempts });
        failed += 1;
        reasons.push(`${base} — tentativas esgotadas (${attempts}/${maxAttempts})`);
      }
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
      retried,
      reasons,
      error: e instanceof TaskQueueUnavailableError ? 'queue_unavailable' : 'save_failed',
      detail,
    };
  }

  return { ok: failed === 0, due: due.length, published, failed, retried, reasons };
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
  /** slice 2 — tentativas de publicação já feitas (retry c/ backoff). */
  attempts?: number;
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
    attempts: p.attempts,
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
