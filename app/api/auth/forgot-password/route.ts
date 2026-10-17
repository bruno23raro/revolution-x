import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { withUserContext } from '@/lib/prisma';
import { generateSecureToken, getMailProvider } from '@/lib/email';

const RESET_TOKEN_TTL_MS = 3600_000; // 1 hour
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 3; // max 3 requests per window per email

// Simple in-memory rate limit bucket (per-process).
// For multi-region deployments, replace with a Redis-backed counter.
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
    // Generic response — do not reveal validation status
    return NextResponse.json({ message: 'If the account exists, instructions will be sent.' });
  }

  // Rate limit before any DB access to avoid timing attacks.
  if (!checkRateLimit(rawEmail)) {
    return NextResponse.json({ message: 'If the account exists, instructions will be sent.' });
  }

  try {
    const svc = createServiceRoleClient();

    // Look up user by email via service role (read-only, non-sensitive field)
    const { data: userRow } = await svc
      .from('User')
      .select('id, email')
      .eq('email', rawEmail)
      .maybeSingle();

    if (!userRow) {
      // Account not found (or DB unavailable) — return generic success
      return NextResponse.json({ message: 'If the account exists, instructions will be sent.' });
    }

    const userId = userRow.id;

    // Generate token, store hash, invalidate old tokens
    const { raw: tokenRaw, hash: tokenHash } = generateSecureToken();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await withUserContext(userId, async (tx) => {
      // Invalidate any existing unused reset tokens for this user
      await tx.$executeRaw`
        UPDATE "PasswordResetToken"
        SET "usedAt" = NOW()
        WHERE "userId" = ${userId}::uuid AND "usedAt" IS NULL
      `;
      // Insert new token
      await tx.passwordResetToken.create({
        data: { userId, tokenHash, expiresAt },
      });
    });

    // Build reset link (token is in the URL — not in the DB)
    // Prefer NEXT_PUBLIC_SITE_URL (set by operator to the public origin);
    // fall back to request.nextUrl.origin only when the operator did not
    // configure it (some hosts return 0.0.0.0:3000 internally).
    const siteOrigin = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim() || request.nextUrl.origin;
    const resetLink = `${siteOrigin}/reset-password?token=${tokenRaw}`;

    // Send email (pluggable; may be no-op until provider wired)
    try {
      await getMailProvider().send({
        to: rawEmail,
        subject: 'Revolution X — Reset sua senha',
        html: `<p>Clique no link abaixo para resetar sua senha. O link expira em 1 hora.</p>
               <p><a href="${resetLink}">Resetar senha</a></p>
               <p>Se você não solicitou isso, ignore este e-mail.</p>`,
        text: `Reset your password at: ${resetLink}`,
      });
    } catch (emailErr) {
      // Do not fail the request if email sending fails — token is still valid in DB.
      console.error('[forgot-password] email send failed:', emailErr);
    }

    // Always return generic success to prevent account enumeration
    return NextResponse.json({ message: 'If the account exists, instructions will be sent.' });
  } catch {
    return NextResponse.json({ message: 'If the account exists, instructions will be sent.' });
  }
}
