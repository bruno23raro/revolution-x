import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withUserContext } from '@/lib/prisma';
import { generateSecureToken, getMailProvider } from '@/lib/email';
import { resolvePublicSiteOrigin } from '@/lib/site-origin';
import { forgotPasswordSchema } from '@/lib/validation/schemas';
import { emailRateLimitKey, rateLimit } from '@/lib/security/rate-limit';
import { createMagicLink } from '@/lib/auth';

const RESET_TOKEN_TTL_MS = 3600_000; // 1 hour

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid_payload', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const rawEmail = parsed.data.email;

    // Email-based rate limit
    const rlKey = `forgot:${rawEmail}`;
    const rl = rateLimit(rlKey, 3, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ message: 'If the account exists, instructions will be sent.' });
    }

    const userRow = await prisma.user.findUnique({
      where: { email: rawEmail },
      select: { id: true, email: true },
    });

    if (!userRow) {
      return NextResponse.json({ message: 'If the account exists, instructions will be sent.' });
    }

    const userId = userRow.id;

    // Generate magic link token for reset
    const magicLinkToken = await createMagicLink(rawEmail, 'reset', userId);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    // Invalidate old tokens and create new reset token via Prisma
    // If this fails, return 500 and do NOT send email (prevents sending invalid links)
    let tokenCreated = false;
    try {
      await withUserContext(userId, async (tx) => {
        await tx.passwordResetToken.updateMany({
          where: { userId, usedAt: null },
          data: { usedAt: new Date() },
        });
        await tx.passwordResetToken.create({
          data: { userId, tokenHash: magicLinkToken, expiresAt },
        });
      });
      tokenCreated = true;
    } catch (dbErr) {
      console.error('[forgot-password] token creation failed:', dbErr);
      return NextResponse.json({ error: 'internal_error' }, { status: 500 });
    }

    if (!tokenCreated) {
      return NextResponse.json({ error: 'internal_error' }, { status: 500 });
    }

    // Build reset link
    const siteOrigin = resolvePublicSiteOrigin(request.nextUrl.origin);
    const resetLink = `${siteOrigin}/reset-password?token=${magicLinkToken}`;

    // Send email (only after token is confirmed in DB)
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
      console.error('[forgot-password] email send failed:', emailErr);
    }

    // Always return generic success to prevent account enumeration
    return NextResponse.json({ message: 'If the account exists, instructions will be sent.' });
  } catch {
    return NextResponse.json({ message: 'If the account exists, instructions will be sent.' });
  }
}