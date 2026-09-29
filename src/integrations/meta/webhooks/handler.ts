// FASE META — WEBHOOKS (seção 14)
export interface WebhookEvent {
  eventId: string;
  tenantId: string;
  provider: 'whatsapp' | 'facebook' | 'instagram';
  payload: unknown;
  receivedAt: string;
  processed: boolean;
}

export function sanitizeWebhookPayload(payload: unknown): unknown {
  // Remover tokens/chaves de logs internos; nunca expor token no log
  if (payload && typeof payload === 'object') {
    const safe = { ...(payload as any) };
    delete safe.access_token;
    delete safe.token;
    delete safe.secret;
    delete safe.password;
    return safe;
  }
  return payload;
}
