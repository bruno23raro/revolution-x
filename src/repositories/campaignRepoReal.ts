// FASE 17 — Repositório de campanhas e destinatários (tenant-scoped).
//
// Mesma convenção do crmRepoReal: todo acesso roda dentro de
// `withTenantContext(orgId, tx)` → o GUC `app.current_org` fica setado na
// transação e o RLS FORCED (migration 017) confina as linhas ao tenant.
// Nada de organizaçãoId vindo do cliente: a org é SEMPRE server-derived.
//
// Idempotência (§10): `replacePendingRecipients` só encerra linhas `pending`
// e a unique (campaignId, contactId) impede duplicar destinatário.

import { prisma, withTenantContext } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

const RECIPIENT_CHUNK = 500;

export interface CampaignCreateInput {
  userId: string;
  title: string;
  channel: string;
  resultKind?: string | null;
  accountId?: string | null;
  message: string;
  variables: unknown;
  audience: unknown;
  batch: unknown;
  scheduledFor?: string | null;
}

export interface CampaignCounts {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
}

/** Resultado POR DESTINATÁRIO (§10) — dados reais, sem PII além do nome. */
export interface RecipientRow {
  contactId: string;
  name: string | null;
  phone: string | null;
  status: string;
  attempts: number;
  externalMessageId: string | null;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string | null;
}

export function mapCounts(rows: Array<{ status: string; _count: { _all: number } }>): CampaignCounts {
  const out: CampaignCounts = { total: 0, sent: 0, failed: 0, skipped: 0 };
  for (const r of rows) {
    out.total += r._count._all;
    if (r.status === 'sent') out.sent += r._count._all;
    else if (r.status === 'failed') out.failed += r._count._all;
    else if (r.status === 'skipped') out.skipped += r._count._all;
  }
  return out;
}

export const campaignRepoReal = {
  async create(orgId: string, data: CampaignCreateInput) {
    return await withTenantContext(orgId, async (tx) => {
      const row = await tx.campaign.create({
        data: {
          organizationId: orgId,
          userId: data.userId,
          title: data.title,
          channel: data.channel,
          status: 'draft',
          resultKind: data.resultKind ?? null,
          accountId: data.accountId ?? null,
          message: data.message,
          variables: data.variables as Prisma.InputJsonValue,
          audienceJson: data.audience as Prisma.InputJsonValue,
          batchJson: data.batch as Prisma.InputJsonValue,
          scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : null,
        },
      });
      return { ...row, scheduledFor: row.scheduledFor?.toISOString() ?? null } as unknown as Record<string, unknown>;
    });
  },

  async get(orgId: string, id: string) {
    return await withTenantContext(orgId, async (tx) => {
      const row = await tx.campaign.findFirst({
        where: { id, organizationId: orgId },
      });
      return row;
    });
  },

  async list(orgId: string) {
    return await withTenantContext(orgId, async (tx) => {
      const items = await tx.campaign.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
      });
      return items;
    });
  },

  /** Contagem de destinatários por status (métricas reais, §10). */
  async recipientCounts(orgId: string, campaignId: string): Promise<CampaignCounts> {
    return await withTenantContext(orgId, async (tx) => {
      const rows = await tx.campaignRecipient.groupBy({
        by: ['status'],
        where: { campaignId, organizationId: orgId },
        _count: { _all: true },
      });
      return mapCounts(rows as unknown as Array<{ status: string; _count: { _all: number } }>);
    });
  },

  /**
   * Resultados POR DESTINATÁRIO (§10): nome/telefone do contato + status
   * real da fila, paginado. Somente linhas da MESMA org (RLS FORCED +
   * filter explícito). `status` opcional: pending|sent|failed|skipped.
   */
  async listRecipients(
    orgId: string,
    campaignId: string,
    opts: { status?: string; limit?: number; offset?: number } = {},
  ): Promise<{ items: RecipientRow[]; total: number }> {
    return await withTenantContext(orgId, async (tx) => {
      const status =
        opts.status && ['pending', 'sent', 'failed', 'skipped'].includes(opts.status)
          ? opts.status
          : undefined;
      const where = {
        campaignId,
        organizationId: orgId,
        ...(status ? { status } : {}),
      };
      const [rows, total] = await Promise.all([
        tx.campaignRecipient.findMany({
          where,
          include: { contact: { select: { name: true, phone: true } } },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: Math.min(100, Math.max(1, opts.limit ?? 50)),
          skip: Math.max(0, opts.offset ?? 0),
        }),
        tx.campaignRecipient.count({ where }),
      ]);
      const items: RecipientRow[] = rows.map((r) => ({
        contactId: r.contactId,
        name: r.contact?.name ?? null,
        phone: r.contact?.phone ?? null,
        status: r.status,
        attempts: r.attempts,
        externalMessageId: r.externalMessageId,
        lastError: r.lastError,
        sentAt: r.sentAt ? r.sentAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
      }));
      return { items, total };
    });
  },

  /**
   * Replaneia a fila: remove destinatários `pending` (reabertura de
   * audiência) e grava a nova lista. Linhas `sent`/`failed`/`skipped`
   * permanecem — histórico nunca se apaga. Contatos que JÁ possuem linha
   * em qualquer estado são preservados (única `campaignId+contactId`):
   * só entram na fila os ainda sem registro.
   */
  async replacePendingRecipients(
    orgId: string,
    campaignId: string,
    contactIds: string[],
  ): Promise<{ planned: number }> {
    return await withTenantContext(orgId, async (tx) => {
      await tx.campaignRecipient.deleteMany({
        where: { campaignId, organizationId: orgId, status: 'pending' },
      });
      const existing = await tx.campaignRecipient.findMany({
        where: { campaignId, organizationId: orgId },
        select: { contactId: true },
      });
      const seen = new Set(existing.map((r) => r.contactId));
      const fresh = contactIds.filter((c) => !seen.has(c));
      for (let i = 0; i < fresh.length; i += RECIPIENT_CHUNK) {
        const chunk = fresh.slice(i, i + RECIPIENT_CHUNK);
        await tx.campaignRecipient.createMany({
          data: chunk.map((contactId) => ({
            campaignId,
            organizationId: orgId,
            contactId,
            status: 'pending',
          })),
        });
      }
      return { planned: fresh.length };
    });
  },

  /** Próximos destinatários pendentes (fila persistente, resumo por lote). */
  async pendingRecipients(
    orgId: string,
    campaignId: string,
    limit: number,
  ): Promise<
    Array<{
      contactId: string;
      contact: {
        id: string;
        name: string;
        phone: string | null;
        email: string | null;
        firstName: string | null;
        lastName: string | null;
        company: string | null;
        source: string | null;
        tags: unknown;
        customFields: unknown;
      };
    }>
  > {
    return await withTenantContext(orgId, async (tx) => {
      const rows = await tx.campaignRecipient.findMany({
        where: { campaignId, organizationId: orgId, status: 'pending' },
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              firstName: true,
              lastName: true,
              company: true,
              source: true,
              tags: true,
              customFields: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });
      return rows;
    });
  },

  /** Persiste o resultado REAL de cada destinatário do lote (idempotente). */
  async markRecipients(
    orgId: string,
    campaignId: string,
    updates: Array<{
      contactId: string;
      status: 'sent' | 'failed';
      attempts: number;
      externalMessageId?: string | null;
      lastError?: string | null;
    }>,
  ): Promise<void> {
    await withTenantContext(orgId, async (tx) => {
      const now = new Date();
      const marked = updates.map((u) => ({
        ...u,
        status: u.status,
      }));
      for (let i = 0; i < marked.length; i += RECIPIENT_CHUNK) {
        for (const u of marked.slice(i, i + RECIPIENT_CHUNK)) {
          await tx.campaignRecipient.updateMany({
            where: { campaignId, organizationId: orgId, contactId: u.contactId },
            data: {
              status: u.status,
              attempts: u.attempts,
              externalMessageId: u.externalMessageId ?? null,
              lastError: u.lastError ?? null,
              sentAt: u.status === 'sent' ? now : null,
            },
          });
        }
      }
    });
  },

  /** Encerra pendências (cancelamento): vira `skipped`, sem apagar. */
  async markPendingSkipped(orgId: string, campaignId: string): Promise<number> {
    return await withTenantContext(orgId, async (tx) => {
      const res = await tx.campaignRecipient.updateMany({
        where: { campaignId, organizationId: orgId, status: 'pending' },
        data: { status: 'skipped' },
      });
      return res.count;
    });
  },

  /** Transição de estado + patch de contagens no registro raiz. */
  async setStatus(
    orgId: string,
    campaignId: string,
    status: string,
    patch: Partial<{
      errorText: string;
      manualNotes: string;
      startedAt: Date;
      completedAt: Date;
      sentCount: number;
      failedCount: number;
      skippedCount: number;
      totalCount: number;
      progress: number;
    }> = {},
  ): Promise<void> {
    await withTenantContext(orgId, async (tx) => {
      await tx.campaign.updateMany({
        where: { id: campaignId, organizationId: orgId },
        data: {
          status,
          errorText: patch.errorText,
          manualNotes: patch.manualNotes,
          startedAt: patch.startedAt,
          completedAt: patch.completedAt,
          sentCount: patch.sentCount,
          failedCount: patch.failedCount,
          skippedCount: patch.skippedCount,
          totalCount: patch.totalCount,
          progress: patch.progress,
        },
      });
    });
  },

  /** Únicos destinatários ainda pendentes (para `remaining`/`progress`). */
  async pendingCount(orgId: string, campaignId: string): Promise<number> {
    return await withTenantContext(orgId, async (tx) => {
      const c = await tx.campaignRecipient.count({
        where: { campaignId, organizationId: orgId, status: 'pending' },
      });
      return c;
    });
  },
};

export type CampaignRepo = typeof campaignRepoReal;

// Evita `unused import` quando o singleton não é consumido direto.
void prisma;
