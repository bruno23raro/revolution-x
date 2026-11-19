import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withTenantContext } from '@/lib/prisma';
import type { Pipeline, Contact, Lead, Deal } from '@/lib/types';

const MAX_STAGES = 50;
function normalizeStages(stages: unknown): string[] {
  if (Array.isArray(stages)) {
    return stages.filter((s): s is string => typeof s === 'string').slice(0, MAX_STAGES);
  }
  if (typeof stages === 'string') {
    try {
      const parsed = JSON.parse(stages);
      if (Array.isArray(parsed)) {
        return parsed.filter((s): s is string => typeof s === 'string').slice(0, MAX_STAGES);
      }
    } catch {
      return ['prospecting', 'proposal', 'negotiation', 'won', 'lost'];
    }
  }
  return ['prospecting', 'proposal', 'negotiation', 'won', 'lost'];
}

export const pipelineRepoReal = {
  async list(organizationId: string): Promise<Pipeline[]> {
    return await withTenantContext(organizationId, async (tx) => {
      const rows = await tx.pipeline.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map((row) => ({
        id: row.id,
        organizationId: row.organizationId,
        name: row.name,
        stages: normalizeStages(row.stages),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    });
  },

  async create(data: { organizationId: string; name: string; stages?: string[] }): Promise<Pipeline> {
    return await withTenantContext(data.organizationId, async (tx) => {
      const row = await tx.pipeline.create({
        data: {
          organizationId: data.organizationId,
          name: data.name || 'Untitled',
          stages: data.stages ?? ['prospecting', 'proposal', 'negotiation', 'won', 'lost'],
        },
      });
      return {
        id: row.id,
        organizationId: row.organizationId,
        name: row.name,
        stages: normalizeStages(row.stages),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  },
};

export const contactRepoReal = {
  async findByOrganization(organizationId: string): Promise<Contact[]> {
    return await withTenantContext(organizationId, async (tx) => {
      const rows = await tx.contact.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map((row) => ({
        id: row.id,
        organizationId: row.organizationId,
        email: row.email ?? null,
        name: row.name,
        firstName: row.firstName ?? null,
        lastName: row.lastName ?? null,
        company: row.company ?? null,
        phone: row.phone ?? null,
        waId: row.waId ?? null,
        externalId: row.externalId ?? null,
        source: row.source ?? null,
        tags: row.tags as string[] ?? [],
        customFields: row.customFields as Record<string, unknown> ?? {},
        preferences: row.preferences as Record<string, unknown> ?? {},
        consentMarketing: row.consentMarketing,
        consentSource: row.consentSource ?? null,
        consentAt: row.consentAt?.toISOString() ?? null,
        optOut: row.optOut,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    });
  },

  async create(data: { organizationId: string; email: string; name: string; phone?: string; company?: string; firstName?: string; lastName?: string; source?: string; tags?: string[]; customFields?: Record<string, unknown>; preferences?: Record<string, unknown> }): Promise<Contact> {
    return await withTenantContext(data.organizationId, async (tx) => {
      const row = await tx.contact.create({
        data: {
          organizationId: data.organizationId,
          email: data.email,
          name: data.name,
          phone: data.phone,
          company: data.company,
          firstName: data.firstName,
          lastName: data.lastName,
          source: data.source,
          tags: data.tags ?? [],
          customFields: toPrismaJson(data.customFields ?? {}),
          preferences: toPrismaJson(data.preferences ?? {}),
        },
      });
      return {
        id: row.id,
        organizationId: row.organizationId,
        email: row.email ?? null,
        name: row.name,
        firstName: row.firstName ?? null,
        lastName: row.lastName ?? null,
        company: row.company ?? null,
        phone: row.phone ?? null,
        waId: row.waId ?? null,
        externalId: row.externalId ?? null,
        source: row.source ?? null,
        tags: row.tags as string[] ?? [],
        customFields: row.customFields as Record<string, unknown> ?? {},
        preferences: row.preferences as Record<string, unknown> ?? {},
        consentMarketing: row.consentMarketing,
        consentSource: row.consentSource ?? null,
        consentAt: row.consentAt?.toISOString() ?? null,
        optOut: row.optOut,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  },
};

export const leadRepoReal = {
  async findByOrganization(organizationId: string): Promise<Lead[]> {
    return await withTenantContext(organizationId, async (tx) => {
      const rows = await tx.lead.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map((row) => ({
        id: row.id,
        organizationId: row.organizationId,
        contactId: row.contactId ?? null,
        source: row.source,
        status: row.status,
        metadata: row.metadata as Record<string, unknown>,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    });
  },

  async create(data: { organizationId: string; source?: string; status?: string; contactId?: string; metadata?: Record<string, unknown> }): Promise<Lead> {
    return await withTenantContext(data.organizationId, async (tx) => {
      const row = await tx.lead.create({
        data: {
          organizationId: data.organizationId,
          source: data.source,
          status: data.status ?? 'new',
          contactId: data.contactId,
          metadata: toPrismaJson(data.metadata ?? {}),
        },
      });
      return {
        id: row.id,
        organizationId: row.organizationId,
        contactId: row.contactId ?? null,
        source: row.source,
        status: row.status,
        metadata: row.metadata as Record<string, unknown>,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  },
};

export const dealRepoReal = {
  async findByOrganization(organizationId: string): Promise<Deal[]> {
    return await withTenantContext(organizationId, async (tx) => {
      const rows = await tx.deal.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map((row) => ({
        id: row.id,
        organizationId: row.organizationId,
        contactId: row.contactId ?? null,
        pipelineId: row.pipelineId ?? null,
        title: row.title,
        value: row.value ? Number(row.value) : 0,
        stage: row.stage,
        metadata: row.metadata as Record<string, unknown>,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        leadId: row.leadId ?? null,
      }));
    });
  },

  async create(data: { organizationId: string; title: string; value?: number; stage?: string; pipelineId?: string; contactId?: string; leadId?: string; metadata?: Record<string, unknown> }): Promise<Deal> {
    return await withTenantContext(data.organizationId, async (tx) => {
      const row = await tx.deal.create({
        data: {
          organizationId: data.organizationId,
          title: data.title,
          value: data.value ?? 0,
          stage: data.stage ?? 'prospecting',
          pipelineId: data.pipelineId,
          contactId: data.contactId,
          leadId: data.leadId,
          metadata: toPrismaJson(data.metadata ?? {}),
        },
      });
      return {
        id: row.id,
        organizationId: row.organizationId,
        contactId: row.contactId ?? null,
        pipelineId: row.pipelineId ?? null,
        title: row.title,
        value: row.value ? Number(row.value) : 0,
        stage: row.stage,
        metadata: row.metadata as Record<string, unknown>,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        leadId: row.leadId ?? null,
      };
    });
  },
};

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  if (value === undefined || value === null) return Prisma.JsonNull as unknown as Prisma.InputJsonValue;
  return value as Prisma.InputJsonValue;
}