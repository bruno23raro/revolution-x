import { NextRequest, NextResponse } from 'next/server';
import { getMailProvider } from '@/lib/email';
import { resolvePublicSiteOrigin } from '@/lib/site-origin';
import { createMagicLink, verifyMagicLink, hashPassword, generateAccessToken, generateRefreshToken, createTokenFamily, setAuthCookies } from '@/lib/auth';
import { emailRateLimitKey, rateLimit } from '@/lib/security/rate-limit';
import { loginSchema } from '@/lib/validation/schemas';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withUserContext } from '@/lib/prisma';

const MAGIC_LINK_TTL_MS = 15 * 60_000; // 15 minutes

// Magic link only needs email, no password
const magicLinkSchema = z.object({
  email: loginSchema.shape.email,
});

export async function POST(request: NextRequest) {
  try {
    // Email-based rate limit
    const rlKey = await emailRateLimitKey(request);
    const rl = rateLimit(rlKey, 3, 60 * 60_1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'too_many_requests', message: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = magicLinkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid_payload', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email } = parsed.data;

    const userRow = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, emailVerified: true },
    });

    if (!userRow) {
      // Generic response to prevent enumeration
      return NextResponse.json({ message: 'If the account exists, a magic link will be sent.' });
    }

    if (!userRow.emailVerified) {
      return NextResponse.json(
        { error: 'email_not_verified' },
        { status: 400 }
      );
    }

    // Generate magic link token
    const magicLinkToken = await createMagicLink(email, 'login');
    const siteOrigin = resolvePublicSiteOrigin(request.nextUrl.origin);
    const magicLink = `${siteOrigin}/auth/callback/magic?token=${magicLinkToken}`;

    // Send email
    try {
      await getMailProvider().send({
        to: email,
        subject: 'Revolution X — Seu link de acesso',
        html: `<p>Clique no link abaixo para acessar sua conta. O link expira em 15 minutos.</p>
               <p><a href="${magicLink}">Acessar conta</a></p>
               <p>Se você não solicitou isso, ignore este e-mail.</p>`,
        text: `Access your account at: ${magicLink}`,
      });
    } catch (emailErr) {
      console.error('[magic-link] email send failed:', emailErr);
    }

    return NextResponse.json({ message: 'If the account exists, a magic link will be sent.' });
  } catch {
    return NextResponse.json({ message: 'If the account exists, a magic link will be sent.' });
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'missing_token' }, { status: 400 });
    }

    const payload = await verifyMagicLink(token);
    if (!payload) {
      return NextResponse.json({ error: 'invalid_or_expired_token' }, { status: 400 });
    }

    if (payload.purpose !== 'login') {
      return NextResponse.json({ error: 'invalid_token_purpose' }, { status: 400 });
    }

    const email = payload.email as string;

    const userRow = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, emailVerified: true },
    });

    if (!userRow) {
      return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
    }

    if (!userRow.emailVerified) {
      return NextResponse.redirect(new URL('/login?error=magic_link_failed', request.url));
    }

    // Create session and tokens
    const userId = userRow.id;
    const familyId = `${userId}:${crypto.randomUUID()}`;
    createTokenFamily(familyId);

    const accessToken = generateAccessToken({ sub: userId, fid: familyId });
    const refreshToken = generateRefreshToken({ sub: userId, fid: familyId });

    // Set cookies and redirect to dashboard
    const response = NextResponse.redirect(new URL('/dashboard', request.url));
    setAuthCookies(response, accessToken, refreshToken);

    return response;
  } catch {
    return NextResponse.redirect(new URL('/login?error=magic_link_failed', request.url));
  }
}