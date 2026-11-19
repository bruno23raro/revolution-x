import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { registerSchema } from '@/lib/validation/schemas';
import { emailRateLimitKey, rateLimit } from '@/lib/security/rate-limit';
import {
  generateAccessToken,
  generateRefreshToken,
  createTokenFamily,
  setAuthCookies,
} from '@/lib/auth';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 50)
    + '-' + crypto.randomUUID().substring(0, 6);
}

export interface OnboardingResult {
  ok: boolean;
  orgId?: string;
  error?: unknown;
  rollbackNeeded?: boolean;
}

async function createOnboardingRecords(
  userId: string,
  name: string,
  email: string,
  passwordHash: string,
): Promise<{ ok: boolean; orgId?: string; error?: unknown }> {
  // Create user record in local DB
  try {
    await prisma.user.create({
      data: {
        id: userId,
        email,
        name,
        passwordHash,
        emailVerified: false,
      },
    });
  } catch (userError: unknown) {
    if (userError instanceof Error && 'code' in userError && (userError as { code: string }).code === 'P2002') {
      // Email already exists, ignore
    } else {
      return { ok: false, error: userError };
    }
  }

  // Create default Organization for this user
  const orgName = `${name.trim()}'s Organization`;
  const orgId = crypto.randomUUID();
  try {
    await prisma.organization.create({
      data: {
        id: orgId,
        name: orgName,
        slug: slugify(orgName),
        status: 'active',
      },
    });
  } catch (orgError) {
    return { ok: false, orgId, error: orgError };
  }

  // Link user as admin member
  try {
    await prisma.organizationMember.create({
      data: {
        organizationId: orgId,
        userId,
        role: 'admin',
      },
    });
  } catch (memberError) {
    return { ok: false, orgId, error: memberError };
  }

  return { ok: true, orgId };
}

export async function POST(request: Request) {
  try {
    // Email-based rate limit
    const rlKey = await emailRateLimitKey(request);
    const rl = rateLimit(rlKey, 10, 60 * 60_1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'too_many_requests', message: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid_payload', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;
    const normalizedEmail = email;
    const normalizedPassword = password;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: 'email_already_registered' },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(normalizedPassword);

    // Create user + organization + membership in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          id: crypto.randomUUID(),
          email: normalizedEmail,
          name: String(name ?? '').trim(),
          passwordHash,
          emailVerified: false,
        },
      });

      const orgName = `${name.trim()}'s Organization`;
      const orgId = crypto.randomUUID();
      await tx.organization.create({
        data: {
          id: orgId,
          name: orgName,
          slug: slugify(orgName),
          status: 'active',
        },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: orgId,
          userId: user.id,
          role: 'admin',
        },
      });

      return { userId: user.id, orgId };
    });

    // Create token family and tokens
    const userId = result.userId;
    const orgId = result.orgId;

    const familyId = `${userId}:${crypto.randomUUID()}`;
    const { createTokenFamily, generateAccessToken, generateRefreshToken, setAuthCookies } = await import('@/lib/auth');

    createTokenFamily(familyId);

    const accessToken = generateAccessToken({ sub: userId, fid: familyId, orgId, role: 'admin' });
    const refreshToken = generateRefreshToken({ sub: userId, fid: familyId });

    const response = NextResponse.json({
      user: {
        id: userId,
        email: normalizedEmail,
        name: String(name ?? '').trim(),
        email_verified: false,
      },
    }, { status: 201 });

    setAuthCookies(response, accessToken, refreshToken);

    return response;
  } catch {
    return NextResponse.json({ error: 'registration_failed' }, { status: 500 });
  }
}