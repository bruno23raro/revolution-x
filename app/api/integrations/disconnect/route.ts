// app/api/integrations/disconnect/route.ts
// POST /api/integrations/disconnect — Delete integration + optional token revocation
// Remove integração do usuário autenticado; opcionalmente revoga token na Meta.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { decryptToken } from '@/lib/encryption';

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { integrationId?: string; channel?: string; revokeToken?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { integrationId, channel, revokeToken } = body;

  if (!integrationId && !channel) {
    return NextResponse.json({ error: 'integrationId ou channel obrigatório' }, { status: 400 });
  }

  try {
    // Leitura de leitura/ownership: RLS da 018 so libera linhas com a GUC
    // app.current_user_id (exclusiva do Prisma), entao o cliente anon veria 0
    // linhas. Service role + .eq('user_id', user.id) explicito mantem o escopo.
    const supabase = createServiceRoleClient();

    // Buscar integração para validar ownership
    let query = supabase
      .from('integrations')
      .select('id, channel, mode, access_token, meta_account_id, status')
      .eq('user_id', user.id);

    if (integrationId) {
      query = query.eq('id', integrationId);
    } else if (channel) {
      query = query.eq('channel', channel);
    }

    const { data: integrations, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json({ error: 'internal_error' }, { status: 500 });
    }

    if (!integrations || integrations.length === 0) {
      return NextResponse.json({ error: 'Integração não encontrada' }, { status: 404 });
    }

    const serviceSupabase = createServiceRoleClient();
    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const integration of integrations) {
      // Contas MANUAis (sem API): remoção dura — não há token para revogar na
      // plataforma e a credential cifrada não deve permanecer no banco.
      if (integration.mode === 'MANUAL') {
        const { error: deleteError } = await serviceSupabase
          .from('integrations')
          .delete()
          .eq('id', integration.id)
          .eq('user_id', user.id);
        if (deleteError) {
          console.error('[integrations-disconnect] manual delete error:', deleteError);
          results.push({ id: integration.id, success: false, error: 'db_error' });
        } else {
          results.push({ id: integration.id, success: true });
        }
        continue;
      }

      // Revogar token na Meta se solicitado
      if (revokeToken && integration.access_token) {
        try {
          const decryptedToken = decryptToken(integration.access_token);
          await fetch(
            `https://graph.facebook.com/v26.0/me/permissions?access_token=${decryptedToken}`,
            { method: 'DELETE' }
          );
        } catch (revokeErr) {
          console.warn('[integrations-disconnect] token revocation failed:', revokeErr);
          // Não falhar a desconexão por erro de revogação
        }
      }

      // Marcar como DISCONNECTED (soft delete)
      const { error: updateError } = await serviceSupabase
        .from('integrations')
        .update({
          status: 'DISCONNECTED',
          access_token: null,
          refresh_token: null,
          updated_at: new Date().toISOString(),
          last_error: revokeToken ? 'Token revogado pelo usuário' : 'Desconectado pelo usuário',
        })
        .eq('id', integration.id);

      if (updateError) {
        console.error('[integrations-disconnect] db error:', updateError);
        results.push({ id: integration.id, success: false, error: 'db_error' });
      } else {
        results.push({ id: integration.id, success: true });
      }
    }

    return NextResponse.json({ disconnected: true, results });
  } catch {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}