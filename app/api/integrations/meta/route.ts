import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decryptToken } from '@/lib/encryption';

// GET /api/integrations/meta — status da integração Meta (informações não sensíveis)
// NUNCA retornar: access_token, ciphertext, encryption key, Authorization, refresh token

export async function GET(req: NextRequest) {
  // Autenticação via sessão
  const sessionCookie = req.cookies.get('session')?.value;
  if (!sessionCookie) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let organizationId: string;
  try {
    const sessionData = JSON.parse(
      Buffer.from(sessionCookie, 'base64').toString('utf8')
    );
    organizationId = sessionData.organizationId;
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: integrations, error } = await supabase
      .from('meta_integrations')
      .select(
        'id, provider, meta_page_id, instagram_account_id, whatsapp_business_account_id, phone_number_id, token_expires_at, connected_at, disconnected_at, status, last_error'
      )
      .eq('organization_id', organizationId)
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
  const sessionCookie = req.cookies.get('session')?.value;
  if (!sessionCookie) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let organizationId: string;
  try {
    const sessionData = JSON.parse(
      Buffer.from(sessionCookie, 'base64').toString('utf8')
    );
    organizationId = sessionData.organizationId;
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get('provider');

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await supabase
      .from('meta_integrations')
      .update({
        status: 'DISCONNECTED',
        disconnected_at: new Date().toISOString(),
      })
      .eq('organization_id', organizationId)
      .eq('provider', provider);

    return NextResponse.json({ disconnected: true });
  } catch {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}