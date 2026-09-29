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

    if (error || !data.user) {
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
