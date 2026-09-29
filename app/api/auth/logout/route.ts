import { NextResponse } from 'next/server';
import { createClient } from '../../../../src/lib/supabase/server';

export async function POST() {
  try {
    const supabase = await createClient();

    await supabase.auth.signOut();

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'logout_failed' },
      { status: 500 }
    );
  }
}
