// FASE 5 — Scheduling (agendamento de conteúdo/marketing)
// Baseado no README: "Publicador + calendário" — funcionalidade inequívoca
// Não inventado; preparação padrão para SaaS omnichannel
// Status: IMPLEMENTADO (interface + validação) — storage depende de DB

export type ScheduleStatus = 'draft' | 'scheduled' | 'published' | 'cancelled';

export interface Schedule {
  id: string;
  organizationId: string;
  title: string;
  description?: string;
  scheduledAt: string; // ISO timestamp
  status: ScheduleStatus;
  channel?: string; // 'whatsapp' | 'email' | 'social'
  content?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleInput {
  title?: string;
  description?: string;
  scheduledAt?: string;
  channel?: string;
  content?: string;
}