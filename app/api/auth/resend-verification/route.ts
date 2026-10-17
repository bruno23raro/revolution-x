import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { generateSecureToken, getMailProvider } from '@/lib/email';

const VERIFICATION_TOKEN_TTL_MS = 3600_000; // 1 hour
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 3;

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(email);
  if (!bucket || now > bucket.resetAt) {
    rateLimitBuckets.set(email, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_MAX) return false;
  bucket.count++;
  return true;
}

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const rawEmail = String(body?.email ?? '').trim().toLowerCase();
  if (!rawEmail) {
    return NextResponse.json({ message: 'If the account exists, instructions will be sent.' });
  }

  if (!checkRateLimit(rawEmail)) {
    return NextResponse.json({ message: 'If the account exists, instructions will be sent.' });
  }

  try {
    const svc = createServiceRoleClient();
    const { data: userRow } = await svc
      .from('User')
      .select('id, email, emailVerified')
      .eq('email', rawEmail)
      .maybeSingle();

    if (!userRow) {
      return NextResponse.json({ message: 'If the account exists, instructions will be sent.' });
    }

    if (userRow.emailVerified) {
      return NextResponse.json({ message: 'Email already verified.' });
    }

    const { raw: tokenRaw, hash: tokenHash } = generateSecureToken();
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

    // Invalidate old unused verification tokens
    await svc.from('EmailVerificationToken')
      .update({ usedAt: new Date() })
      .match({ userId: userRow.id, usedAt: null });

    // Insert new token
    await svc.from('EmailVerificationToken')
      .insert({ userId: userRow.id, tokenHash, expiresAt });

    // Prefer NEXT_PUBLIC_SITE_URL (set by operator to the public origin);
    // otherwise use request.nextUrl.origin only when it is not the
    // internal Hostinger address (0.0.0.0:3000); hard-fallback to the
    // known production domain.
    const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim()
      || (request.nextUrl.origin !== 'http://0.0.0.0:3000' && request.nextUrl.origin !== 'https://0.0.0.0')
        ? request.nextUrl.origin
        : 'https://revolutionx.com.br';
    const verifyLink = `${siteOrigin}/verify-email?token=${tokenRaw}`;

    try {
      await getMailProvider().send({
        to: rawEmail,
        subject: 'Revolution X — Verifique seu e-mail',
        html: `<p>Clique no link abaixo para verificar seu e-mail.</p>
               <p><a href="${verifyLink}">Verificar e-mail</a></p>
               <p>Se você não criou uma conta, ignore este e-mail.</p>`,
        text: `Verify your email: ${verifyLink}`,
      });
    } catch (emailErr) {
      console.error('[resend-verification] email send failed:', emailErr);
    }

    return NextResponse.json({ message: 'If the account exists, instructions will be sent.' });
  } catch {
    return NextResponse.json({ message: 'If the account exists, instructions will be sent.' });
  }
}
