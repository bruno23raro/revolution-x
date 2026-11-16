// Handlers unificados para webhooks OpenBSP
// Processa eventos das tabelas: messages, accounts, contacts

import crypto from 'crypto';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function handleOpenbspEvent(
  tableName: string,
  payload: unknown,
  rawBody: string,
): Promise<void> {
  const openbspEventId = extractEventId(payload);

  // Idempotência
  if (openbspEventId) {
    const svc = createServiceRoleClient();
    const { data: existing } = await svc
      .from('webhook_events')
      .select('event_id')
      .eq('openbsp_event_id', openbspEventId)
      .maybeSingle();

    if (existing) {
      console.log(`[openbsp-webhook:${tableName}] duplicate event`, openbspEventId);
      return;
    }
  }

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (openbspEventId) {
        const svc = createServiceRoleClient();
        const claimed = await svc.$queryRaw`
          INSERT INTO webhook_events (event_id, openbsp_event_id, event_type, payload_hash, processed_at)
          VALUES (gen_random_uuid(), ${openbspEventId}, 'openbsp_${tableName}', sha256(${rawBody}::text), NOW())
          ON CONFLICT (openbsp_event_id) DO NOTHING
          RETURNING event_id
        ` as Array<{ event_id: string }>;
        if (claimed.length === 0) {
          console.log(`[openbsp-webhook:${tableName}] duplicate at claim time`, openbspEventId);
          return;
        }
      }

      switch (tableName) {
        case 'messages':
          await handleMessageEvent(payload);
          break;
        case 'accounts':
          await handleAccountEvent(payload);
          break;
        case 'contacts':
          await handleContactEvent(payload);
          break;
        default:
          console.warn('[openbsp-webhook] unknown table:', tableName);
      }
      return;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error(`[openbsp-webhook:${tableName}] attempt ${attempt}:`, err.message);
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
      } else {
        await logDLQ(tableName, rawBody, err.message);
      }
    }
  }
}

async function handleMessageEvent(payload: unknown): Promise<void> {
  const p = payload as Record<string, unknown>;
  const entry = Array.isArray(p.entry) ? p.entry[0] : null;
  const changes = entry?.changes as Array<Record<string, unknown>> | undefined;
  const change = changes?.[0];
  const value = change?.value as Record<string, unknown> | undefined;

  const svc = createServiceRoleClient();

  // Contacts (vêm como array no payload de mensagens, conforme contrato OpenBSP)
  // c.id é o WhatsApp ID (waId), c.profile.name é o nome
  const contacts = value?.contacts as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(contacts)) {
    for (const c of contacts) {
      // O ID do contato é o WhatsApp ID (waId)
      const waId = (c.id as string) ?? crypto.randomUUID();
      const profile = c.profile as Record<string, unknown> | undefined;
      await svc.from('crm_contacts').upsert({
        phone_number: waId,
        name: typeof profile?.name === 'string' ? profile.name : '',
        email: (profile as Record<string, unknown>)?.email ?? null,
        organization_id: null,
        metadata: c,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    console.log('[openbsp-webhook:messages] inserted', contacts.length, 'contacts');
  }

  // Messages inserção
  const messages = value?.messages as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(messages)) {
    for (const msg of messages) {
      const id = (msg.id as string) ?? crypto.randomUUID();
      const from = (msg.from as string) ?? '';
      const type = (msg.type as string) ?? 'unknown';
      await svc.from('inbound_messages').insert({
        message_id: id,
        from_number: from,
        type,
        payload: msg,
        received_at: new Date().toISOString(),
      });
    }
    console.log('[openbsp-webhook:messages] inserted', messages.length, 'messages');
  }

  // Status updates
  const statuses = value?.statuses as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(statuses)) {
    for (const st of statuses) {
      await svc.from('message_status').insert({
        message_id: (st.id as string) ?? '',
        status: (st.status as string) ?? 'unknown',
        timestamp: st.timestamp ? new Date(parseInt(st.timestamp as string) * 1000).toISOString() : new Date().toISOString(),
        error_code: (st.errors as Array<{ code: string }> | undefined)?.[0]?.code ?? null,
        payload: st,
      });
    }
    console.log('[openbsp-webhook:messages] updated', statuses.length, 'statuses');
  }
}

async function handleAccountEvent(payload: unknown): Promise<void> {
  const p = payload as Record<string, unknown>;
  const row = p.data as Record<string, unknown> | undefined ?? p as Record<string, unknown>;

  const svc = createServiceRoleClient();
  await svc.from('whatsapp_channels').upsert({
    external_account_label: (row.phone_number_id as string) ?? (row.id as string) ?? '',
    status: (row.status as string) ?? 'connected',
    tier_limit_per_24h: typeof row.tier_limit_per_24h === 'number' ? row.tier_limit_per_24h : 250,
    sent_window_24h: typeof row.sent_window_24h === 'number' ? row.sent_window_24h : 0,
    last_synced_at: new Date().toISOString(),
    payload: row,
  });
  console.log('[openbsp-webhook:accounts] upserted account', (row.id as string) ?? (row.phone_number_id as string));
}

async function handleContactEvent(payload: unknown): Promise<void> {
  const p = payload as Record<string, unknown>;
  const row = p.data as Record<string, unknown> | undefined ?? p as Record<string, unknown>;

  const svc = createServiceRoleClient();
  await svc.from('crm_contacts').upsert({
    phone_number: (row.phone_number as string) ?? (row.wid as string) ?? '',
    name: (row.name as string) ?? '',
    email: (row.email as string) ?? null,
    organization_id: null,
    metadata: row,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  console.log('[openbsp-webhook:contacts] upserted contact', (row.phone_number as string) ?? (row.wid as string));
}

function extractEventId(payload: unknown): string | null {
  const p = payload as Record<string, unknown>;
  if (p.id && typeof p.id === 'string') return p.id;
  if (Array.isArray(p.entry)) {
    const entry = p.entry[0] as Record<string, unknown>;
    if (entry.id && typeof entry.id === 'string') return entry.id;
    if (Array.isArray(entry.changes)) {
      const change = entry.changes[0] as Record<string, unknown>;
      const value = change?.value as Record<string, unknown> | undefined;
      if (Array.isArray(value?.messages) && value.messages.length > 0) {
        const msg = value.messages[0] as Record<string, unknown>;
        if (msg.id && typeof msg.id === 'string') return msg.id;
      }
      if (Array.isArray(value?.statuses) && value.statuses.length > 0) {
        const st = value.statuses[0] as Record<string, unknown>;
        if (st.id && typeof st.id === 'string') return st.id;
      }
    }
  }
  return null;
}

async function logDLQ(tableName: string, rawBody: string, error: string): Promise<void> {
  try {
    const svc = createServiceRoleClient();
    await svc.from('webhook_dead_letter').insert({
      event_type: `openbsp_${tableName}`,
      raw_body: rawBody.slice(0, 5000),
      error,
      attempt: 3,
      created_at: new Date().toISOString(),
    });
    console.error(`[openbsp-webhook:${tableName}] DLQ saved`);
  } catch (e) {
    console.error(`[openbsp-webhook:${tableName}] DLQ insert failed:`, (e as Error).message);
  }
}