import { NextResponse } from 'next/server';
import { createClient } from '../../../../src/lib/supabase/server';
export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }
    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    const normalizedPassword = String(password ?? '');
    if (!normalizedEmail || !normalizedPassword) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }
    const supabase = await createClient();
    const host = request.headers.get('host') ?? 'localhost:3000';
    const isLocalhost = host.includes('localhost');
    const siteOrigin = `${isLocalhost ? 'http' : 'https'}://${host}`;
    const emailRedirectTo = `${siteOrigin}/auth/callback?next=/verify-email`;
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: normalizedPassword,
      options: {
        emailRedirectTo,
        data: { name: String(name ?? '').trim() }
        // ATENÇÃO (skill supabase): user_metadata / raw_user_meta_data é editável pelo usuário.
        // Dados de autorização devem vir de app_metadata; não usar raw_user_meta_data em políticas RLS.
      }
    });
    if (error) {
      return NextResponse.json({ error: 'registration_failed' }, { status: 400 });
    }
    if (!data || !data.user) {
      return NextResponse.json({ error: 'registration_failed' }, { status: 400 });
    }
    return NextResponse.json({
      user: {
        id: data.user.id,
        email: data.user.email || normalizedEmail,
        // NÃO usar user_metadata para decisão de autorização (skill supabase: raw_user_meta_data é editável).
        // Se precisar de claim de auth, usar app_metadata (raw_app_meta_data) via admin/updateUser.
        name: (data.user.app_metadata && typeof data.user.app_metadata === 'object' && data.user.app_metadata.name) || (data.user.user_metadata && typeof data.user.user_metadata === 'object' && data.user.user_metadata.name) || String(name ?? '').trim(),
        email_verified: !!data.user.email_confirmed_at
      }
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'registration_failed' }, { status: 500 });
  }
}
