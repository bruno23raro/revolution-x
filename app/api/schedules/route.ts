// FASE 5 — GET /api/schedules (listar agendamentos)
// Usa Prisma com tenant isolation

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateSchedule } from '@/services/scheduleService';

export const runtime = 'nodejs';

// GET /api/schedules
export async function GET(req: NextRequest) {
  const { user } = await getAuth(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const schedules = await prisma.schedule.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ schedules, total: schedules.length });
  } catch (err) {
    console.error('[schedules] DB error:', err);
    return NextResponse.json({ schedules: [], total: 0, error: 'internal_error' }, { status: 500 });
  }
}

// POST /api/schedules
export async function POST(req: NextRequest) {
  const { user } = await getAuth(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const errors = validateSchedule(body);
  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  try {
    const schedule = await prisma.schedule.create({
      data: {
        organizationId: user.organizationId,
        title: body.title,
        description: body.description ?? null,
        scheduledAt: new Date(body.scheduledAt),
        status: 'scheduled',
        channel: body.channel ?? 'social',
        content: body.content ?? null,
      },
    });

    return NextResponse.json({ schedule }, { status: 201 });
  } catch (err) {
    console.error('[schedules] DB insert error:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}