import { prisma, withTenantContext } from '../lib/prisma';
import type { Contact, Lead, Deal, Pipeline } from '../models/crm';
import type { ContactRepo, LeadRepo, DealRepo, PipelineRepo } from './crmRepo';

export const contactRepoReal: ContactRepo = {
  async findByOrganization(orgId: string): Promise<Contact[]> {
    return await withTenantContext(orgId, async (tx) => {
      const rows = await tx.contact.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })) as Contact[];
    });
  },
  async create(data: Omit<Contact, 'id' | 'createdAt'> & { organizationId: string }): Promise<Contact> {
    return await withTenantContext(data.organizationId, async (tx) => {
      const row = await tx.contact.create({
        data: {
          organizationId: data.organizationId,
          email: data.email ?? null,
          name: data.name,
          phone: data.phone ?? null,
        },
      });
      return {
        ...row,
        createdAt: row.createdAt.toISOString(),
      } as Contact;
    });
  },
};

export const leadRepoReal: LeadRepo = {
  async findByOrganization(orgId: string): Promise<Lead[]> {
    return await withTenantContext(orgId, async (tx) => {
      const rows = await tx.lead.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })) as Lead[];
    });
  },
  async create(data: Omit<Lead, 'id' | 'createdAt'> & { organizationId: string }): Promise<Lead> {
    return await withTenantContext(data.organizationId, async (tx) => {
      const row = await tx.lead.create({
        data: {
          organizationId: data.organizationId,
          contactId: data.contactId ?? null,
          source: data.source || 'organic',
          status: data.status || 'new',
        },
      });
      return {
        ...row,
        createdAt: row.createdAt.toISOString(),
      } as Lead;
    });
  },
};

export const dealRepoReal: DealRepo = {
  async findByOrganization(orgId: string): Promise<Deal[]> {
    return await withTenantContext(orgId, async (tx) => {
      const rows = await tx.deal.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map((r) => ({
        ...r,
        value: Number(r.value),
        createdAt: r.createdAt.toISOString(),
      })) as Deal[];
    });
  },
  async create(data: Omit<Deal, 'id' | 'createdAt'> & { organizationId: string }): Promise<Deal> {
    return await withTenantContext(data.organizationId, async (tx) => {
      const row = await tx.deal.create({
        data: {
          organizationId: data.organizationId,
          leadId: data.leadId ?? null,
          title: data.title,
          value: data.value || 0,
          stage: data.stage || 'prospecting',
        },
      });
      return {
        ...row,
        value: Number(row.value),
        createdAt: row.createdAt.toISOString(),
      } as Deal;
    });
  },
};

export const pipelineRepoReal: PipelineRepo = {
  async findByOrganization(orgId: string): Promise<Pipeline[]> {
    return await withTenantContext(orgId, async (tx) => {
      const rows = await tx.pipeline.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map((r) => ({
        ...r,
        stages: (r.stages as string[] | null) ?? [],
      })) as Pipeline[];
    });
  },
  async create(data: Partial<Pipeline> & { organizationId: string }): Promise<Pipeline> {
    return await withTenantContext(data.organizationId, async (tx) => {
      const row = await tx.pipeline.create({
        data: {
          organizationId: data.organizationId,
          name: data.name || 'Untitled',
          stages: JSON.stringify(data.stages ?? []),
        },
      });
      return {
        ...row,
        stages: (row.stages as string[] | null) ?? [],
      } as Pipeline;
    });
  },
};
