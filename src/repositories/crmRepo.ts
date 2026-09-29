import { Contact, Lead, Deal, Pipeline } from '../models/crm';

// DEPENDÊNCIA DE BANCO — NÃO VALIDADA
// Repository criado localmente; integração com PostgreSQL aguardando SELECT 1 + Migration 001

export interface ContactRepo {
  findByOrganization(orgId: string): Promise<Contact[]>;
  create(data: Omit<Contact, 'id' | 'createdAt'>): Promise<Contact>;
}

export interface LeadRepo {
  findByOrganization(orgId: string): Promise<Lead[]>;
  create(data: Omit<Lead, 'id' | 'createdAt'>): Promise<Lead>;
}

export interface DealRepo {
  findByOrganization(orgId: string): Promise<Deal[]>;
  create(data: Omit<Deal, 'id' | 'createdAt'>): Promise<Deal>;
}

export interface PipelineRepo {
  findByOrganization(orgId: string): Promise<Pipeline[]>;
  create(data: Partial<Pipeline> & { organizationId: string }): Promise<Pipeline>;
}

// Mock implementations — não acessam DB real; substitua quando banco confirmado
export const contactRepo: ContactRepo = {
  async findByOrganization(orgId: string) {
    return [{ id: 'c-mock', organizationId: orgId, email: 'mock@test.com', name: 'Mock', createdAt: new Date().toISOString() }];
  },
  async create(data) {
    return { ...data, id: 'c-' + Date.now(), createdAt: new Date().toISOString() } as Contact;
  }
};

export const leadRepo: LeadRepo = {
  async findByOrganization(orgId: string) {
    return [{ id: 'l-mock', organizationId: orgId, source: 'organic', status: 'new', createdAt: new Date().toISOString() }];
  },
  async create(data) {
    return { ...data, id: 'l-' + Date.now(), createdAt: new Date().toISOString() } as Lead;
  }
};

export const dealRepo: DealRepo = {
  async findByOrganization(orgId: string) {
    return [{ id: 'd-mock', organizationId: orgId, title: 'Mock Deal', value: 0, stage: 'prospecting', createdAt: new Date().toISOString() }];
  },
  async create(data) {
    return { ...data, id: 'd-' + Date.now(), createdAt: new Date().toISOString() } as Deal;
  }
};

export const pipelineRepo: PipelineRepo = {
  async findByOrganization(orgId: string) {
    return [{ id: 'p-mock', organizationId: orgId, name: 'Default Pipeline', stages: ['new', 'contacted', 'qualified', 'won', 'lost'], createdAt: new Date().toISOString() }];
  },
  async create(data) {
    return { ...data, id: 'p-' + Date.now(), stages: (data as Pipeline).stages ?? [] } as Pipeline;
  }
};
