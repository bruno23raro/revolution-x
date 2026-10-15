import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { withUserContext } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const rawToken = String(body?.token ?? '').trim();
  const rawPassword = String(body?.password ?? '');

  if (!rawToken || !rawPassword) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  // Validate password strength (same rule as registration)
  if (rawPassword.length < 8 || !/[A-Z]/.test(rawPassword) || !/[0-9]/.test(rawPassword)) {
    return NextResponse.json({ error: 'weak_password' }, { status: 400 });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const now = new Date();

    // Find valid (unused, not expired) token via service role.
    // We use service role here because we don't yet know app.current_user_id
    // (the token proves identity before we know the user).
    const svc = createServiceRoleClient();
    const { data: validToken } = await svc
      .from('PasswordResetToken')
      .select('id, userId, expiresAt, usedAt')
      .eq('tokenHash', tokenHash)
      .is('usedAt', null)
      .gt('expiresAt', now.toISOString())
      .maybeSingle();

    if (!validToken) {
      // Generic error — do not distinguish expired vs invalid vs used
      return NextResponse.json({ error: 'invalid_token' }, { status: 400 });
    }

    const userId = validToken.userId;

    // Hash new password and update user in Supabase Auth FIRST
    // before updating Prisma, so that the login credential is fixed
    // before the app-record credential. If this fails, token stays
    // unconsumed for retry (no partial state).
    const supaSvc = createServiceRoleClient();
    const authResult = await supaSvc.auth.admin.updateUserById(userId, {
      password: rawPassword,
    });

    // Hash new password for Prisma (kept for app-record consistency;
    // Supabase Auth change already took effect above)
    const passwordHash = await hashPassword(rawPassword);

    // Use withUserContext to satisfy User_self_write RLS policy
    await withUserContext(userId, async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash },
      });
      // Mark token as used — only after Prisma update succeeded
      await tx.passwordResetToken.update({
        where: { id: validToken.id },
        data: { usedAt: now },
      });
    });

    return NextResponse.json({ message: 'Password updated successfully.' });
  } catch {
    return NextResponse.json({ error: 'invalid_token' }, { status: 400 });
  }
}
