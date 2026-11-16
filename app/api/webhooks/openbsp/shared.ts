// Handlers unificados para webhooks OpenBSP
// Processa eventos das tabelas: messages, accounts, contacts

import crypto from 'crypto';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getChannelByPhoneNumberId } from '@/integrations/whatsapp';

/** Palavras-chave de opt-out (case-insensitive) */
const OPT_OUT_KEYWORDS = ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'PARAR', 'SAIR'];

/** Detecta se o texto contém opt-out */
function isOptOut(text: string): boolean {
  const normalized = text.trim().toUpperCase();
  return OPT_OUT_KEYWORDS.some((kw) => normalized === kw || normalized.includes(kw));
}

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

  // Resolver organizationId via phoneNumberId do payload
  const organizationId = await resolveOrganizationId(payload);

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
          await handleMessageEvent(payload, organizationId);
          break;
        case 'accounts':
          await handleAccountEvent(payload, organizationId);
          break;
        case 'contacts':
          await handleContactEvent(payload, organizationId);
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

/**
 * Resolve o organizationId a partir do phoneNumberId no payload.
 * Usa a mesma lógica que app/api/integrations/openbsp/incoming/route.ts
 */
async function resolveOrganizationId(payload: unknown): Promise<string | null> {
  try {
    const p = payload as Record<string, unknown>;
    // Try to extract phone_number_id from various payload structures
    let phoneNumberId: string | undefined;

    if (Array.isArray(p.entry) && p.entry.length > 0) {
      const entry = p.entry[0] as Record<string, unknown>;
      if (Array.isArray(entry.changes) && entry.changes.length > 0) {
        const change = entry.changes[0] as Record<string, unknown>;
        const value = change?.value as Record<string, unknown> | undefined;
        phoneNumberId = value?.phone_number_id as string | undefined;
      }
    }

    if (!phoneNumberId) {
      phoneNumberId = (payload as Record<string, unknown>).phone_number_id as string | undefined;
    }

    if (!phoneNumberId) {
      phoneNumberId = (payload as Record<string, unknown>).id as string | undefined;
    }

    if (phoneNumberId) {
      const channel = await getChannelByPhoneNumberId(createServiceRoleClient(), phoneNumberId);
      return channel?.organizationId ?? null;
    }
  } catch (e) {
    console.warn('[openbsp-webhook] failed to resolve organizationId:', (e as Error).message);
  }
  return null;
}

async function handleMessageEvent(payload: unknown, organizationId: string | null): Promise<void> {
  const p = payload as Record<string, unknown>;
  const entry = Array.isArray(p.entry) ? p.entry[0] : null;
  const changes = entry?.changes as Array<Record<string, unknown>> | undefined;
  const change = changes?.[0];
  const value = change?.value as Record<string, unknown> | undefined;

  // FAIL-CLOSED: Se não conseguiu resolver organizationId, NÃO prossegue
  if (!organizationId) {
    console.error('[openbsp-webhook:messages] FAIL-CLOSED: organizationId não resolvido — abortando upsert para evitar vazamento cross-tenant');
    return;
  }

  const svc = createServiceRoleClient();
  const orgIdForUpsert = organizationId;

  // --- DETECÇÃO DE OPT-OUT (PROCESSAR ANTES DE TUDO) ---
  const messages = value?.messages as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(messages)) {
    for (const msg of messages) {
      const from = (msg.from as string) ?? '';
      const bodyObj = (msg as Record<string, unknown>).body;
      const body = typeof bodyObj === 'object' && bodyObj !== null && typeof (bodyObj as Record<string, unknown>).text === 'string'
        ? String((bodyObj as Record<string, unknown>).text)
        : '';
      if (body && isOptOut(body)) {
        // Atualizar Contact com optOut=true e consentMarketing=false
        await svc.from('contacts').updateMany({
          where: {
            organizationId: orgIdForUpsert,
            OR: [{ waId: { equals: from } }, { phone: { equals: from } }],
          },
          data: {
            optOut: true,
            consentMarketing: false,
            updatedAt: new Date(),
          },
        });
        console.log(`[openbsp-webhook:messages] opt-out detectado para ${from} (org: ${orgIdForUpsert})`);
      }
    }
  }

  // Contacts (vêm como array no payload de mensagens, conforme contrato OpenBSP)
  // c.id é o WhatsApp ID (waId), c.profile.name é o nome
  const contacts = value?.contacts as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(contacts)) {
    for (const c of contacts) {
      // O ID do contato é o WhatsApp ID (waId)
      const waId = (c.id as string) ?? crypto.randomUUID();
      const profile = c.profile as Record<string, unknown> | undefined;
      // CORRIGIDO: Usar organizationId resolvido, não null
      await svc.from('crm_contacts').upsert({
        phone_number: waId,
        name: typeof profile?.name === 'string' ? profile.name : '',
        email: (profile as Record<string, unknown>)?.email ?? null,
        organization_id: orgIdForUpsert,
        metadata: c,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    console.log('[openbsp-webhook:messages] inserted', contacts.length, 'contacts (org:', orgIdForUpsert, ')');
  }

  // Messages inserção
  if (Array.isArray(messages)) {
    for (const msg of messages) {
      const id = (msg.id as string) ?? crypto.randomUUID();
      const from = (msg.from as string) ?? '';
      const type = (msg.type as string) ?? 'unknown';
      await svc.from('inbound_messages').insert({
        message_id: id,
        from_number: from,
        type,
        organization_id: orgIdForUpsert,
        payload: msg,
        received_at: new Date().toISOString(),
      });
    }
    console.log('[openbsp-webhook:messages] inserted', messages.length, 'messages (org:', orgIdForUpsert, ')');
  }

  // Status updates
  const statuses = value?.statuses as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(statuses)) {
    for (const st of statuses) {
      await svc.from('message_status').insert({
        message_id: (st.id as string) ?? '',
        status: (st.status as string) ?? 'unknown',
        organization_id: orgIdForUpsert,
        timestamp: st.timestamp ? new Date(parseInt(st.timestamp as string) * 1000).toISOString() : new Date().toISOString(),
        error_code: (st.errors as Array<{ code: string }> | undefined)?.[0]?.code ?? null,
        payload: st,
      });
    }
    console.log('[openbsp-webhook:messages] updated', statuses.length, 'statuses (org:', orgIdForUpsert, ')');
  }
}

async function handleAccountEvent(payload: unknown, organizationId: string | null): Promise<void> {
  const p = payload as Record<string, unknown>;
  const row = p.data as Record<string, unknown> | undefined ?? p as Record<string, unknown>;

  // FAIL-CLOSED: Se não conseguiu resolver organizationId, NÃO prossegue
  if (!organizationId) {
    console.error('[openbsp-webhook:accounts] FAIL-CLOSED: organizationId não resolvido — abortando upsert para evitar vazamento cross-tenant');
    return;
  }

  const svc = createServiceRoleClient();
  const orgIdForUpsert = organizationId;
  await svc.from('whatsapp_channels').upsert({
    external_account_label: (row.phone_number_id as string) ?? (row.id as string) ?? '',
    status: (row.status as string) ?? 'connected',
    tier_limit_per_24h: typeof row.tier_limit_per_24h === 'number' ? row.tier_limit_per_24h : 250,
    sent_window_24h: typeof row.sent_window_24h === 'number' ? row.sent_window_24h : 0,
    last_synced_at: new Date().toISOString(),
    organization_id: orgIdForUpsert,
    payload: row,
  });
  console.log('[openbsp-webhook:accounts] upserted account', (row.id as string) ?? (row.phone_number_id as string), '(org:', orgIdForUpsert, ')');
}

async function handleContactEvent(payload: unknown, organizationId: string | null): Promise<void> {
  const p = payload as Record<string, unknown>;
  const row = p.data as Record<string, unknown> | undefined ?? p as Record<string, unknown>;

  // FAIL-CLOSED: Se não conseguiu resolver organizationId, NÃO prossegue
  if (!organizationId) {
    console.error('[openbsp-webhook:contacts] FAIL-CLOSED: organizationId não resolvido — abortando upsert para evitar vazamento cross-tenant');
    return;
  }

  const svc = createServiceRoleClient();
  const orgIdForUpsert = organizationId;
  await svc.from('crm_contacts').upsert({
    phone_number: (row.phone_number as string) ?? (row.wid as string) ?? '',
    name: (row.name as string) ?? '',
    email: (row.email as string) ?? null,
    organization_id: orgIdForUpsert,
    metadata: row,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  console.log('[openbsp-webhook:contacts] upserted contact', (row.phone_number as string) ?? (row.wid as string), '(org:', orgIdForUpsert, ')');
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