import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withUserContext } from '@/lib/prisma';
import { verifyMagicLink } from '@/lib/auth';
import { verifyEmailSchema } from '@/lib/validation/schemas';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = verifyEmailSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid_payload', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { token } = parsed.data;

    const payload = await verifyMagicLink(token);
    if (!payload || payload.purpose !== 'verify') {
      return NextResponse.json({ error: 'invalid_or_expired_token' }, { status: 400 });
    }

    const userId = payload.organizationId;
    if (!userId) {
      return NextResponse.json({ error: 'invalid_token' }, { status: 400 });
    }

    const userRow = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, emailVerified: true },
    });

    if (!userRow) {
      return NextResponse.json({ error: 'invalid_token' }, { status: 400 });
    }

    if (userRow.emailVerified) {
      return NextResponse.json({ message: 'Email already verified.' });
    }

    await withUserContext(userId, async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { emailVerified: true },
      });

      await tx.emailVerificationToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: new Date() },
      });
    });

    return NextResponse.json({ message: 'Email verified successfully.' });
  } catch {
    return NextResponse.json({ error: 'verification_failed' }, { status: 500 });
  }
}