// POST /api/integrations/sync-contacts/{channel}
// Sincroniza contatos de um canal para a CRM local
//
// WhatsApp OpenBSP: Busca contatos da tabela 'contacts' via API
// Instagram/Facebook: Busca via Graph API
// Retorna: { synced: number, upserted: number, total: number, error?: string }

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

type Provider = 'openbsp';
interface ResolvedAccount {
  ok: true;
  provider: Provider;
  accessToken: string;
  phoneNumberId: string;
  row: Record<string, unknown>;
}
interface ResolveFailure {
  ok: false;
  reason: 'not_connected' | 'no_token' | 'account_not_found';
}

/** Resolve conta OpenBSP para sync-contacts (versão local). */
async function resolveTenantOpenBSPAccess(
  organizationId: string,
  accountId?: string,
): Promise<ResolvedAccount | ResolveFailure> {
  const service = createServiceRoleClient();
  let q = service
    .from('whatsapp_channels')
    .select('id, provider, status, wabaId, phoneNumberId, phoneNumber, verifiedName, accessTokenEnc, lastError, tierLimitPer24h, sentWindow24h, windowStartedAt')
    .eq('organizationId', organizationId)
    .eq('provider', 'openbsp')
    .neq('status', 'DISCONNECTED');

  if (accountId) q = q.eq('id', accountId);
  const { data: channelData, error: channelError } = await q.limit(1).maybeSingle();

  if (channelError || !channelData) {
    return { ok: false, reason: accountId ? 'account_not_found' : 'not_connected' };
  }

  const channel = channelData as Record<string, unknown>;
  const accessToken = channel.accessTokenEnc as string || '';

  return {
    ok: true,
    provider: 'openbsp',
    accessToken,
    phoneNumberId: channel.phoneNumberId as string || '',
    row: channel,
  };
}

export const dynamic = 'force-dynamic';

type Channel = 'whatsapp';

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const channel = url.searchParams.get('channel') || url.pathname.split('/').pop();

  if (channel !== 'whatsapp') {
    return NextResponse.json({
      error: 'Channel não suportado para sync-contacts',
      supported: ['whatsapp']
    }, { status: 400 });
  }

  // Resolver conta OpenBSP
  const resolved = await resolveTenantOpenBSPAccess(user.organizationId);
  if (!resolved.ok) {
    return NextResponse.json({
      error: 'Conta não conectada',
      detail: resolved.reason,
      synced: 0,
      upserted: 0,
      total: 0
    }, { status: 409 });
  }

  try {
    // Buscar contatos via OpenBSP API
    const contacts = await fetchContactsFromOpenBSP(resolved);

    // Upsert na CRM local
    const { synced, upserted } = await upsertContacts(user.organizationId, contacts);

    return NextResponse.json({
      ok: true,
      synced: contacts.length,
      upserted,
      total: contacts.length,
      channel,
    }, { status: 200 });
  } catch (e) {
    console.error('[sync-contacts] Erro:', e);
    return NextResponse.json({
      error: 'Falha ao sincronizar contatos',
      detail: e instanceof Error ? e.message : 'Unknown error',
      synced: 0,
      upserted: 0,
      total: 0,
    }, { status: 500 });
  }
}

async function fetchContactsFromOpenBSP(resolved: Awaited<ReturnType<typeof resolveTenantOpenBSPAccess>>) {
  if (!resolved.ok) throw new Error('Conta não conectada');

  // Usar o cliente OpenBSP para buscar contatos
  // A API do OpenBSP tem uma tabela 'contacts' via PostgREST
  const { createClient } = await import('@supabase/supabase-js');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    resolved.accessToken,
    {
      global: {
        headers: {
          'apikey': resolved.accessToken,
        },
      },
    }
  );

  // Buscar contatos via PostgREST do OpenBSP
  const { data, error } = await supabase
    .from('contacts')
    .select('id,name,phone_numbers,email,profile_picture_url,created_at,updated_at')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) {
    throw new Error(`Erro OpenBSP API: ${error.message}`);
  }

  return data || [];
}

async function upsertContacts(organizationId: string, contacts: any[]) {
  const service = createServiceRoleClient();

  let upserted = 0;
  let total = contacts.length;
  for (const contact of contacts) {
    const phone = Array.isArray(contact.phone_numbers)
      ? contact.phone_numbers[0]
      : contact.phone_numbers;

    if (!phone) continue;

    const { error } = await service
      .from('crm_contacts')
      .upsert({
        organization_id: organizationId,
        external_id: contact.id,
        name: contact.name,
        phone: phone,
        email: contact.email,
        profile_picture_url: contact.profile_picture_url,
        last_synced_at: new Date().toISOString(),
      }, {
        onConflict: 'organization_id,external_id',
      });

    if (!error) upserted++;
  }

  return { synced: total, upserted, total };
}