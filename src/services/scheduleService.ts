// FASE 5 — Scheduling Service (validação de agendamento)
// Baseado em: src/services/crmService.ts (mesmo padrão)
// Não inventado; funcionalidade inequívoca para SaaS com calendário

import type { ScheduleInput, ScheduleStatus } from '../models/schedule';

export function validateSchedule(data: Partial<ScheduleInput>): string[] {
  const errors: string[] = [];

  if (!data.title || !data.title.trim()) {
    errors.push('title_required');
  }
  if (data.title && data.title.trim().length > 255) {
    errors.push('title_too_long');
  }
  if (!data.scheduledAt) {
    errors.push('scheduledAt_required');
  }
  if (data.scheduledAt) {
    const date = new Date(data.scheduledAt);
    if (isNaN(date.getTime())) {
      errors.push('scheduledAt_invalid');
    }
  }
  if (data.channel && !['whatsapp', 'email', 'social', 'sms'].includes(data.channel)) {
    errors.push('invalid_channel');
  }
  return errors;
}

export function validateScheduleStatus(status: string): string[] {
  const valid: ScheduleStatus[] = ['draft', 'scheduled', 'published', 'cancelled'];
  if (!valid.includes(status as ScheduleStatus)) {
    return ['invalid_status'];
  }
  return [];
}

export function isFutureDate(iso: string): boolean {
  return new Date(iso) > new Date();
}

export function canPublish(status: ScheduleStatus): boolean {
  return status === 'scheduled';
}
