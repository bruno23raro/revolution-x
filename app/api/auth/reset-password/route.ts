import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withUserContext } from '@/lib/prisma';
import { hashPassword, verifyMagicLink } from '@/lib/auth';
import { resetPasswordSchema } from '@/lib/validation/schemas';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid_payload', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { token, password } = parsed.data;

    const payload = await verifyMagicLink(token);
    if (!payload || payload.purpose !== 'reset') {
      return NextResponse.json({ error: 'invalid_or_expired_token' }, { status: 400 });
    }

    const userId = payload.organizationId;
    if (!userId) {
      return NextResponse.json({ error: 'invalid_token' }, { status: 400 });
    }

    const userRow = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!userRow) {
      return NextResponse.json({ error: 'invalid_token' }, { status: 400 });
    }

    // Update password in Prisma
    const passwordHash = await hashPassword(password);

    await withUserContext(userId, async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash },
      });
      // Mark token as used
      await tx.passwordResetToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: new Date() },
      });
    });

    return NextResponse.json({ message: 'Password updated successfully.' });
  } catch {
    return NextResponse.json({ error: 'invalid_token' }, { status: 400 });
  }
}