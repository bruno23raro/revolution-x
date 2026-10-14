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

    const { data: integrations, error } = await supabase
      .from('meta_integrations')
      .select(
        'id, provider, meta_page_id, instagram_account_id, whatsapp_business_account_id, phone_number_id, token_expires_at, connected_at, disconnected_at, status, last_error'
      )
      .eq('organization_id', user.organizationId)
      .maybeSingle();

    if (error || !integrations) {
      return NextResponse.json({ connected: false, integrations: [] });
    }

    // Retornar apenas informações não sensíveis
    return NextResponse.json({
      connected: true,
      integrations: [
        {
          provider: integrations.provider,
          metaPageId: integrations.meta_page_id,
          instagramAccountId: integrations.instagram_account_id,
          whatsappBusinessAccountId: integrations.whatsapp_business_account_id,
          phoneNumberId: integrations.phone_number_id,
          tokenExpiresAt: integrations.token_expires_at,
          connectedAt: integrations.connected_at,
          disconnectedAt: integrations.disconnected_at,
          status: integrations.status,
          lastError: integrations.last_error,
        },
      ],
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
