import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/prisma';
import { loginSchema } from '@/lib/validation/schemas';
import { emailRateLimitKey, rateLimit } from '@/lib/security/rate-limit';
import {
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  createTokenFamily,
  revokeAllUserTokenFamilies,
  setAuthCookies,
} from '@/lib/auth';

export async function POST(request: Request) {
  try {
    // Email-based rate limit
    const rlKey = await emailRateLimitKey(request);
    const rl = rateLimit(rlKey, 10, 15 * 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'too_many_requests', message: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid_payload', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    // Find user by email (case-insensitive, normalized)
    const normalizedEmail = email.trim().toLowerCase();

    // Use fresh Prisma client
    const prisma = getPrismaClient();

    console.log('Login attempt for:', normalizedEmail);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    console.log('User found:', user ? 'YES' : 'NO');
    if (user) {
      console.log('User ID:', user.id);
      console.log('User email:', user.email);
      console.log('Email verified:', user.emailVerified);
      console.log('Password hash starts with:', user.passwordHash?.substring(0, 20));
    }

    if (!user) {
      return NextResponse.json(
        { error: 'invalid_credentials' },
        { status: 401 }
      );
    }

    // Verify password
    const validPassword = await verifyPassword(password, user.passwordHash);
    console.log('Password valid:', validPassword);

    if (!validPassword) {
      return NextResponse.json(
        { error: 'invalid_credentials' },
        { status: 401 }
      );
    }

    if (!user.emailVerified) {
      return NextResponse.json(
        { error: 'email_not_verified' },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Invalidate all previous token families for this user (refresh rotation)
    revokeAllUserTokenFamilies(userId);

    // Create new token family for this login
    const familyId = `${userId}:${crypto.randomUUID()}`;
    createTokenFamily(familyId);

    // Generate tokens (simplified - only userId in payload)
    const accessToken = generateAccessToken({ sub: userId, fid: familyId });
    const refreshToken = generateRefreshToken({ sub: userId, fid: familyId });

    // Set auth cookies
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email ?? null,
        email_verified: user.emailVerified,
      },
    });
    setAuthCookies(response, accessToken, refreshToken);

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'invalid_credentials' },
      { status: 401 }
    );
  }
}