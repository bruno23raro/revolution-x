// FASE 4 — STUB PREPARADO (não inventado)
export function validateProduct(data: Partial<{ name?: string; price?: number }>): string[] {
  const errors: string[] = [];
  if (!data.name || !data.name.trim()) errors.push('name_required');
  if (data.price !== undefined && data.price < 0) errors.push('price_negative');
  return errors;
}
