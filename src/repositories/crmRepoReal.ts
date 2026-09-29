// REPOSITORIES REAIS — substituem mocks do crmRepo.ts quando DB confirmado
import { ContactRepo, LeadRepo, DealRepo, PipelineRepo } from "./crmRepo";
// Baseado em: migrations/003_fase3_crm.sql (tabelas contacts/leads/deals/pipelines)
// Padrão: same interfaces (ContactRepo, LeadRepo, DealRepo, PipelineRepo)
// Usa pg diretamente (instalado; regra 13) — NÃO inventa tabela/coluna
// NÃO executa migration — tabelas já confirmadas no PostgreSQL

import { Pool } from 'pg';
import type { Contact, Lead, Deal, Pipeline } from '../models/crm';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const contactRepoReal: ContactRepo = {
  async findByOrganization(orgId: string): Promise<Contact[]> {
    const res = await pool.query('SELECT * FROM contacts WHERE organization_id = $1', [orgId]);
    return res.rows.map((r: any) => ({ id: r.id, organizationId: r.organization_id, email: r.email, name: r.name, phone: r.phone, createdAt: r.created_at.toISOString() }));
  },
  async create(data: Omit<Contact, 'id' | 'createdAt'>): Promise<Contact> {
    const res = await pool.query('INSERT INTO contacts (organization_id, email, name, phone) VALUES ($1,$2,$3,$4) RETURNING *', [data.organizationId, data.email, data.name, data.phone || null]);
    const r = res.rows[0];
    return { id: r.id, organizationId: r.organization_id, email: r.email, name: r.name, phone: r.phone || null, createdAt: r.created_at.toISOString() };
  }
};

export const leadRepoReal: LeadRepo = {
  async findByOrganization(orgId: string): Promise<Lead[]> {
    const res = await pool.query('SELECT * FROM leads WHERE organization_id = $1', [orgId]);
    return res.rows.map((r: any) => ({ id: r.id, organizationId: r.organization_id, contactId: r.contact_id, source: r.source, status: r.status, createdAt: r.created_at.toISOString() }));
  },
  async create(data: Omit<Lead, 'id' | 'createdAt'>): Promise<Lead> {
    const res = await pool.query('INSERT INTO leads (organization_id, contact_id, source, status) VALUES ($1,$2,$3,$4) RETURNING *', [data.organizationId, (data as any).contactId || null, data.source || 'organic', data.status || 'new']);
    const r = res.rows[0];
    return { id: r.id, organizationId: r.organization_id, contactId: r.contact_id, source: r.source, status: r.status, createdAt: r.created_at.toISOString() };
  }
};

export const dealRepoReal: DealRepo = {
  async findByOrganization(orgId: string): Promise<Deal[]> {
    const res = await pool.query('SELECT * FROM deals WHERE organization_id = $1', [orgId]);
    return res.rows.map((r: any) => ({ id: r.id, organizationId: r.organization_id, title: r.title, value: Number(r.value), stage: r.stage, createdAt: r.created_at.toISOString(), leadId: r.lead_id }));
  },
  async create(data: Omit<Deal, 'id' | 'createdAt'>): Promise<Deal> {
    const res = await pool.query('INSERT INTO deals (organization_id, lead_id, title, value, stage) VALUES ($1,$2,$3,$4,$5) RETURNING *', [data.organizationId, (data as any).leadId || null, data.title, data.value || 0, data.stage || 'prospecting']);
    const r = res.rows[0];
    return { id: r.id, organizationId: r.organization_id, title: r.title, value: Number(r.value), stage: r.stage, createdAt: r.created_at.toISOString(), leadId: r.lead_id };
  }
};

export const pipelineRepoReal: PipelineRepo = {
  async findByOrganization(orgId: string): Promise<Pipeline[]> {
    const res = await pool.query('SELECT * FROM pipelines WHERE organization_id = $1', [orgId]);
    return res.rows.map((r: any) => ({ id: r.id, organizationId: r.organization_id, name: r.name, stages: r.stages || [] }));
  },
  async create(data: Partial<Pipeline> & { organizationId: string }): Promise<Pipeline> {
    const res = await pool.query('INSERT INTO pipelines (organization_id, name, stages) VALUES ($1,$2,$3) RETURNING *', [data.organizationId, data.name, JSON.stringify(data.stages || [])]);
    const r = res.rows[0];
    return { id: r.id, organizationId: r.organization_id, name: r.name, stages: r.stages || [] };
  }
};
