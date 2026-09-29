export function validateContact(data: Partial<{ email?: string; name?: string; phone?: string }>): string[] {
  const errors: string[] = [];
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('invalid_email');
  if (!data.name || !data.name.trim()) errors.push('name_required');
  return errors;
}

export function validateLead(data: Partial<{ status?: string; source?: string }>): string[] {
  const errors: string[] = [];
  if (data.status && !['new', 'contacted', 'qualified', 'lost'].includes(data.status)) errors.push('invalid_status');
  return errors;
}

export function validateDeal(data: Partial<{ title?: string; value?: number; stage?: string }>): string[] {
  const errors: string[] = [];
  if (!data.title || !data.title.trim()) errors.push('title_required');
  if (data.value !== undefined && data.value < 0) errors.push('value_negative');
  if (data.stage && !['prospecting', 'proposal', 'negotiation', 'won', 'lost'].includes(data.stage)) errors.push('invalid_stage');
  return errors;
}

export function validatePipeline(data: Partial<{ name?: string; stages?: string[] }>): string[] {
  const errors: string[] = [];
  if (!data.name || !data.name.trim()) errors.push('name_required');
  return errors;
}
