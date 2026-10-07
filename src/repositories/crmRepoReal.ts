// REPOSITORIES REAIS — substituem mocks do crmRepo.ts quando DB confirmado
// FASE 3: Contact, Lead, Deal, Pipeline (tabelas PascalCase canônicas)
// Padrão: mesma interface (ContactRepo, LeadRepo, DealRepo, PipelineRepo)
// Usa Prisma client (@prisma/client) injetado via lib/prisma.ts
// Isolamento multi-tenant garantido por organizationId em todas as queries

import { prisma } from '../lib/prisma';
import type { Contact, Lead, Deal, Pipeline } from '../models/crm';
import type { ContactRepo, LeadRepo, DealRepo, PipelineRepo } from './crmRepo';

export const contactRepoReal: ContactRepo = {
  async findByOrganization(orgId: string): Promise<Contact[]> {
    const rows = await prisma.contact.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r: any) => ({
      id: r.id,
      organizationId: r.organizationId,
      email: r.email ?? undefined,
      name: r.name,
      phone: r.phone ?? undefined,
      createdAt: r.createdAt.toISOString(),
    }));
  },
  async create(data: Omit<Contact, 'id' | 'createdAt'>): Promise<Contact> {
    const row = await prisma.contact.create({
      data: {
        organizationId: data.organizationId,
        email: data.email ?? null,
        name: data.name,
        phone: data.phone ?? null,
      },
    });
    return {
      id: row.id,
      organizationId: row.organizationId,
      email: row.email ?? undefined,
      name: row.name,
      phone: row.phone ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  },
};

export const leadRepoReal: LeadRepo = {
  async findByOrganization(orgId: string): Promise<Lead[]> {
    const rows = await prisma.lead.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r: any) => ({
      id: r.id,
      organizationId: r.organizationId,
      contactId: r.contactId ?? undefined,
      source: r.source,
      status: r.status as Lead['status'],
      createdAt: r.createdAt.toISOString(),
    }));
  },
  async create(data: Omit<Lead, 'id' | 'createdAt'>): Promise<Lead> {
    const row = await prisma.lead.create({
      data: {
        organizationId: data.organizationId,
        contactId: (data as any).contactId || null,
        source: data.source || 'organic',
        status: data.status || 'new',
      },
    });
    return {
      id: row.id,
      organizationId: row.organizationId,
      contactId: row.contactId ?? undefined,
      source: row.source,
      status: row.status as Lead['status'],
      createdAt: row.createdAt.toISOString(),
    };
  },
};

export const dealRepoReal: DealRepo = {
  async findByOrganization(orgId: string): Promise<Deal[]> {
    const rows = await prisma.deal.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r: any) => ({
      id: r.id,
      organizationId: r.organizationId,
      leadId: r.leadId ?? undefined,
      title: r.title,
      value: Number(r.value),
      stage: r.stage as Deal['stage'],
      createdAt: r.createdAt.toISOString(),
    }));
  },
  async create(data: Omit<Deal, 'id' | 'createdAt'>): Promise<Deal> {
    const row = await prisma.deal.create({
      data: {
        organizationId: data.organizationId,
        leadId: (data as any).leadId || null,
        title: data.title,
        value: data.value || 0,
        stage: data.stage || 'prospecting',
      },
    });
    return {
      id: row.id,
      organizationId: row.organizationId,
      leadId: row.leadId ?? undefined,
      title: row.title,
      value: Number(row.value),
      stage: row.stage as Deal['stage'],
      createdAt: row.createdAt.toISOString(),
    };
  },
};

export const pipelineRepoReal: PipelineRepo = {
  async findByOrganization(orgId: string): Promise<Pipeline[]> {
    const rows = await prisma.pipeline.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r: any) => ({
      id: r.id,
      organizationId: r.organizationId,
      name: r.name,
      stages: (r.stages as string[] | null) ?? [],
    }));
  },
  async create(data: Partial<Pipeline> & { organizationId: string }): Promise<Pipeline> {
    const row = await prisma.pipeline.create({
      data: {
        organizationId: data.organizationId,
        name: data.name || 'Untitled',
        stages: JSON.stringify(data.stages ?? []),
      },
    });
    return {
      id: row.id,
      organizationId: row.organizationId,
      name: row.name,
      stages: (row.stages as string[] | null) ?? [],
    };
  },
};
