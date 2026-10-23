// FASE 17 — Executor de campanhas (orquestra repo + motor + sender).
//
// `executeCampaignBatch` corrige UM LOTE da fila: lê os destinatários
// pendentes, compõe o texto por contato (interpolação ESCAPADA, §9) e
// delega o envio ao `sender` INJETADO (testes usam fake sender + fake
// timers, sem tocar a Meta, §16). O resultado REAL de cada destinatário é
// persistido (métricas nunca fictícias, §10) e a transição de estado da
// campanha é derivada apenas das contagens reais.

import { campaignRepoReal } from '@/repositories/campaignRepoReal';
import {
  buildRecipientVars,
  interpolateVars,
  runCampaignBatch,
  type CampaignStatus,
} from './campaignService';
import type { SendResult } from './campaignService';

export interface CampaignRowLike {
  id: string;
  organizationId: string;
  channel: string;
  status: string;
  message: string;
  accountId: string | null;
  resultKind: string | null;
  variables: unknown;
  audienceJson: unknown;
  batchJson: unknown;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
}

export interface ExecuteResult {
  sent: number;
  failed: number;
  remaining: number;
  /** Estado final derivado das contagens reais (não assumido). */
  nextStatus: CampaignStatus;
}

export interface ExecuteOpts {
  campaign: CampaignRowLike;
  /** (id, to, text) → resultado real do provedor. `text` já interpolado/escapado. */
  sender: (id: string, to: string, text: string) => Promise<SendResult>;
  repo?: typeof campaignRepoReal;
  maxPerRun?: number;
  delayMs?: number;
  maxAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
}

function readBatch(c: CampaignRowLike): { maxPerRun?: number; delayMs?: number; maxAttempts?: number } {
  const b = (c.batchJson ?? {}) as { maxPerRun?: number; delayMs?: number; maxAttempts?: number };
  return b;
}

/**
 * Executa um lote da fila e persiste os resultados. Devolve o resumo e o
 * `nextStatus` (running / completed / completed_partial / failed) — quem
 * decide gravar o estado é a rota (após validar a transição).
 */
export async function executeCampaignBatch(opts: ExecuteOpts): Promise<ExecuteResult> {
  const repo = opts.repo ?? campaignRepoReal;
  const c = opts.campaign;
  const org = c.organizationId;
  const batch = readBatch(c);
  const maxPerRun = opts.maxPerRun ?? batch.maxPerRun ?? 100;
  const delayMs = opts.delayMs ?? batch.delayMs ?? 1000;
  const maxAttempts = opts.maxAttempts ?? batch.maxAttempts ?? 3;

  const pending = await repo.pendingRecipients(org, c.id, maxPerRun);
  if (pending.length === 0) {
    // Fila vazia: nada foi executado nesta rodada (no-op). Não fabricamos
    // estado terminal (§10: métricas reais) — o estado segue o que já estava;
    // a rota decide se a audiência vazia vira 'queued' com nota explicativa.
    const next: CampaignStatus =
      c.totalCount > 0 ? (c.failedCount > 0 ? 'completed_partial' : 'completed') : (c.status as CampaignStatus);
    return { sent: 0, failed: 0, remaining: 0, nextStatus: next };
  }

  // Texto por contato: variáveis da campanha (defaults) + do contato
  // (prioridade), com ESCAPE (§9) + fallback vazio para ausentes.
  const campVars: Record<string, unknown> =
    c.variables && typeof c.variables === 'object' && !Array.isArray(c.variables)
      ? (c.variables as Record<string, unknown>)
      : {};
  const texts: Record<string, string> = {};
  const recipients: Array<{ id: string; to: string }> = [];
  for (const p of pending) {
    const vars = { ...campVars, ...buildRecipientVars(p.contact) };
    const { text } = interpolateVars(c.message, vars, '');
    texts[p.contactId] = text;
    recipients.push({
      id: p.contactId,
      to: c.channel === 'whatsapp' ? (p.contact.phone ?? '') : (p.contact.email ?? ''),
    });
  }

  const res = await runCampaignBatch(
    recipients,
    (id, to) => opts.sender(id, to, texts[id] ?? ''),
    { maxPerRun, delayMs, maxAttempts, sleep: opts.sleep },
  );

  // Persiste o resultado REAL por destinatário (idempotente por contactId).
  await repo.markRecipients(
    org,
    c.id,
    res.perRecipient.map((pr) => ({
      contactId: pr.id,
      status: pr.ok ? 'sent' : 'failed',
      attempts: pr.attempts,
      externalMessageId: pr.externalMessageId ?? null,
      lastError: pr.error ?? null,
    })),
  );

  const remaining = await repo.pendingCount(org, c.id);
  let nextStatus: CampaignStatus;
  if (remaining === 0) {
    nextStatus = res.failed > 0 ? 'completed_partial' : 'completed';
  } else {
    nextStatus = 'running'; // ainda há fila; pausa/cancelamento é outra ação.
  }

  return { sent: res.sent, failed: res.failed, remaining, nextStatus };
}

/** Soma contagens incrementais num registro de campanha (para patch). */
export function mergeCounts(c: CampaignRowLike, delta: { sent: number; failed: number }): {
  sentCount: number;
  failedCount: number;
  totalCount: number;
} {
  return {
    sentCount: c.sentCount + delta.sent,
    failedCount: c.failedCount + delta.failed,
    totalCount: c.totalCount,
  };
}
