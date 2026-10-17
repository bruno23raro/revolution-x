import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../src/lib/supabase/server';
import { getAuthenticatedUser } from '../../../../src/lib/auth';

export async function GET(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      { authenticated: false },
      { status: 401 }
    );
  }

  // Papel + organização (para a navegação por permissões). O fallback mantém a
  // sessão GoTrue válida mesmo se o banco estiver indisponível.
  let role: string | null = null;
  let organizationId: string | null = null;
  try {
    const authUser = await getAuthenticatedUser(req);
    role = authUser?.role ?? null;
    organizationId = authUser?.organizationId ?? null;
  } catch {
    // Banco indisponível: devolve a sessão GoTrue sem role (menu não mostra
    // itens administrativos, mas a conta segue logada).
  }

  return NextResponse.json({
    authenticated: true,
    role,
    organizationId,
    user: {
      id: user.id,
      email: user.email ?? null,
      email_verified: Boolean(user.email_confirmed_at),
    },
  });
}
