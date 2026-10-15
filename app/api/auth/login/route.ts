import { NextResponse } from 'next/server';
import { createClient } from '../../../../src/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    const normalizedPassword = String(password ?? '');

    if (!normalizedEmail || !normalizedPassword) {
      return NextResponse.json(
        { error: 'invalid_credentials' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: normalizedPassword,
    });

    if (error || !data.user || !data.session) {
      return NextResponse.json(
        { error: 'invalid_credentials' },
        { status: 401 }
      );
    }

    // Persist session (SSR create-client emits Set-Cookie via cookies.setAll)
    try {
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
    } catch (setSessionError) {
      // If we can't persist the session, still return user data but 401
      // so the client knows auth is not fully established.
      return NextResponse.json(
        { error: 'invalid_credentials' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      user: {
        id: data.user.id,
        email: data.user.email ?? null,
        email_verified: Boolean(data.user.email_confirmed_at),
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'invalid_credentials' },
      { status: 401 }
    );
  }
}
