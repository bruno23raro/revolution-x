// FASE 3 — CRM Base
// Modelo: contact, lead, deal, pipeline
// Status: 🟡 MOCK (banco local ativo; real aguarda Supabase)

export interface Contact {
  id: string;
  organizationId: string;
  email?: string;
  name: string;
  phone?: string;
  createdAt: string;
}

export interface Lead {
  id: string;
  organizationId: string;
  contactId?: string;
  source: string; // meta, google, orgânico
  status: "new" | "contacted" | "qualified" | "lost";
  createdAt: string;
}

export interface Deal {
  id: string;
  organizationId: string;
  leadId?: string;
  title: string;
  value: number;
  stage: "prospecting" | "proposal" | "negotiation" | "won" | "lost";
  createdAt: string;
}

export interface Pipeline {
  id: string;
  organizationId: string;
  name: string;
  stages: string[];
}
