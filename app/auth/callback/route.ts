import { NextResponse } from 'next/server';
import { createClient } from '../../../src/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const next = url.searchParams.get('next');
    if (!code) {
      return NextResponse.redirect(new URL('/verify-email', request.url));
    }
    const safeNext = (next && next.startsWith('/') && !next.startsWith('//')) ? next : '/verify-email';
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL('/verify-email', request.url));
    }
    return NextResponse.redirect(new URL(safeNext, request.url));
  } catch {
    return NextResponse.redirect(new URL('/verify-email', request.url));
  }
}
