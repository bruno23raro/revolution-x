// app/api/integrations/manual/verify/route.ts
// POST /api/integrations/manual/verify — valida a credencial salva de uma conta MANUAL.
// Corpo: { integrationId }. Só contas MANUAL do próprio usuário.
// Atualiza status: CONNECTED (válida) | ERROR (recusada) | PENDING (sem verificação remota).

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { decryptToken } from '@/lib/encryption';
import { verifyManualCredential, type CredentialKind, type ManualChannel } from '@/integrations/manual';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { integrationId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (!body.integrationId) {
    return NextResponse.json({ error: 'integrationId obrigatório' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data: row, error: fetchError } = await supabase
    .from('integrations')
    .select('id, channel, mode, access_token, metadata, status')
    .eq('id', body.integrationId)
    .eq('user_id', user.id)
    .eq('mode', 'MANUAL')
    .single();

  if (fetchError || !row) {
    return NextResponse.json({ error: 'Integração manual não encontrada' }, { status: 404 });
  }

  let credential: string;
  try {
    credential = decryptToken(row.access_token ?? '');
  } catch {
    return NextResponse.json({ error: 'credencial ilegível', valid: false }, { status: 422 });
  }

  const kind: CredentialKind = (row.metadata as { kind?: string } | null)?.kind === 'token' ? 'token' : 'cookie';
  const outcome = await verifyManualCredential(row.channel as ManualChannel, credential, undefined, undefined, kind);

  const newStatus = outcome.valid ? 'CONNECTED' : outcome.reason === 'invalid_credential' ? 'ERROR' : row.status;
  await supabase
    .from('integrations')
    .update({
      status: newStatus,
      last_error: outcome.valid ? null : (outcome as { detail?: string }).detail ?? outcome.reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id);

  return NextResponse.json({
    valid: outcome.valid,
    status: newStatus,
    reason: outcome.valid ? undefined : outcome.reason,
    detail: (outcome as { detail?: string }).detail,
  });
}
