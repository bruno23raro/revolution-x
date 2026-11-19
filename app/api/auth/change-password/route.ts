import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { user } = await getAuth(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.currentPassword || !body?.newPassword) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }
  if (body.newPassword.length < 8) {
    return NextResponse.json({ error: 'weak_password' }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!dbUser || !(await bcrypt.compare(body.currentPassword, dbUser.passwordHash))) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(body.newPassword) },
  });
  return NextResponse.json({ ok: true });
}