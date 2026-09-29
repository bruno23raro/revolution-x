export function validateVideo(data: Partial<{ title?: string; url?: string; durationSeconds?: number }>): string[] {
  const errors: string[] = [];
  if (!data.title || !data.title.trim()) errors.push('title_required');
  if (!data.url || !data.url.trim()) errors.push('url_required');
  if (data.durationSeconds !== undefined && data.durationSeconds < 0) errors.push('duration_negative');
  return errors;
}
