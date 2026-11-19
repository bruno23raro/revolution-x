import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMailProvider } from '@/lib/email';
import { resolvePublicSiteOrigin } from '@/lib/site-origin';
import { emailRateLimitKey, rateLimit } from '@/lib/security/rate-limit';
import { forgotPasswordSchema } from '@/lib/validation/schemas';
import { createMagicLink } from '@/lib/auth';

const VERIFICATION_TOKEN_TTL_MS = 3600_000; // 1 hour

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
    const rlKey = `verify:${rawEmail}`;
    const rl = rateLimit(rlKey, 3, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ message: 'If the account exists, instructions will be sent.' });
    }

    const userRow = await prisma.user.findUnique({
      where: { email: rawEmail },
      select: { id: true, email: true, emailVerified: true },
    });

    if (!userRow) {
      return NextResponse.json({ message: 'If the account exists, instructions will be sent.' });
    }

    if (userRow.emailVerified) {
      return NextResponse.json({ message: 'Email already verified.' });
    }

    // Generate magic link token for verification
    const magicLinkToken = await createMagicLink(rawEmail, 'verify', userRow.id);
    const siteOrigin = resolvePublicSiteOrigin(request.nextUrl.origin);
    const verifyLink = `${siteOrigin}/verify-email?token=${magicLinkToken}`;

    // Invalidate old tokens via Prisma
    await prisma.emailVerificationToken.updateMany({
      where: { userId: userRow.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    await prisma.emailVerificationToken.create({
      data: { userId: userRow.id, tokenHash: magicLinkToken, expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS) },
    });

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