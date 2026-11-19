import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('access_token')?.value;
  if (!token) return NextResponse.json({ authenticated: false }, { status: 401 });

  try {
    const p = verifyAccessToken(token) as { sub: string; orgId?: string; role?: string } | null;
    if (!p) return NextResponse.json({ authenticated: false }, { status: 401 });

    return NextResponse.json({
      authenticated: true,
      role: p.role,
      organizationId: p.orgId,
      user: { id: p.sub },
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}