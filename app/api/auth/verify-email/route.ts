import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { withUserContext } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const rawToken = String(body?.token ?? '').trim();
  if (!rawToken) {
    return NextResponse.json({ error: 'missing_token' }, { status: 400 });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const now = new Date();

    const svc = createServiceRoleClient();
    const { data: validToken } = await svc
      .from('EmailVerificationToken')
      .select('id, userId, expiresAt, usedAt')
      .eq('tokenHash', tokenHash)
      .is('usedAt', null)
      .gt('expiresAt', now.toISOString())
      .maybeSingle();

    if (!validToken) {
      return NextResponse.json({ error: 'invalid_token' }, { status: 400 });
    }

    const userId = validToken.userId;

    // Update user email verification status and mark token as used
    // respecting RLS via withUserContext (app.current_user_id context)
    await withUserContext(userId, async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { emailVerified: true },
      });

      await tx.emailVerificationToken.update({
        where: { id: validToken.id },
        data: { usedAt: now },
      });
    });

    // Also confirm email in Supabase Auth (admin operation — service role)
    try {
      const { error: authErr } = await svc.auth.admin.updateUserById(userId, {
        email_confirmed_at: new Date().toISOString(),
      });
      if (authErr) {
        console.error('[verify-email] Auth confirm failed:', authErr);
        // Best-effort: our local record is already updated
      }
    } catch {
      // Non-fatal: our local record is already updated
    }

    return NextResponse.json({ message: 'Email verified successfully.' });
  } catch {
    return NextResponse.json({ error: 'verification_failed' }, { status: 500 });
  }
}
