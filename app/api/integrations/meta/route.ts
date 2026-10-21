import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

// GET /api/integrations/meta — status da integração Meta (informações não sensíveis)
// NUNCA retornar: access_token, ciphertext, encryption key, Authorization, refresh token

export async function GET(req: NextRequest) {
  // Autenticação robusta: validação via Supabase Auth + membership no banco
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Usa o client com anon key (sujeito a RLS) — nunca service_role em rotas autenticadas
    const supabase = await createClient();

    // MULTICONTAS — retorna a LISTA de linhas conectadas (não `.maybeSingle()`,
    // que quebra com mais de uma linha por tenant). Id `id` exposto para o
    // seletor de contas ancorar operações específicas.
    const { data: rows, error } = await supabase
      .from('meta_integrations')
      .select(
        'id, provider, meta_page_id, instagram_account_id, whatsapp_business_account_id, phone_number_id, token_expires_at, connected_at, disconnected_at, status, last_error',
      )
      .eq('organization_id', user.organizationId)
      .neq('status', 'DISCONNECTED')
      .order('connected_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'internal_error' }, { status: 500 });
    }

    const integrations = (rows ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      provider: r.provider,
      metaPageId: r.meta_page_id,
      instagramAccountId: r.instagram_account_id,
      whatsappBusinessAccountId: r.whatsapp_business_account_id,
      phoneNumberId: r.phone_number_id,
      tokenExpiresAt: r.token_expires_at,
      connectedAt: r.connected_at,
      disconnectedAt: r.disconnected_at,
      status: r.status,
      lastError: r.last_error,
    }));

    // Retornar apenas informações não sensíveis
    return NextResponse.json({
      connected: integrations.length > 0,
      integrations,
    });
  } catch {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

// DELETE /api/integrations/meta — desconectar integração
export async function DELETE(req: NextRequest) {
  // Autenticação robusta: validação via Supabase Auth + membership no banco
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get('provider');
  if (!provider) {
    return NextResponse.json({ error: 'provider_missing' }, { status: 400 });
  }

  try {
    // Usa o client com anon key (sujeito a RLS) — nunca service_role em rotas autenticadas
    const supabase = await createClient();

    await supabase
      .from('meta_integrations')
      .update({
        status: 'DISCONNECTED',
        disconnected_at: new Date().toISOString(),
      })
      .eq('organization_id', user.organizationId)
      .eq('provider', provider);

    return NextResponse.json({ disconnected: true });
  } catch {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
