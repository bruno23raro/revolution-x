// FASE 5 — GET /api/schedules (listar agendamentos)
// Baseado no padrão de app/api/crm/leads/route.ts
// Usa Supabase service-role client para queries reais

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { validateSchedule } from '@/services/scheduleService';

interface ScheduleRecord {
  id: string;
  organizationId: string;
  title: string;
  scheduledAt: string;
  status: string;
  channel: string;
  createdAt: string;
}

// GET /api/schedules
export async function GET() {
  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin.from('Schedule').select('*');

    if (error) {
      console.error('[schedules] DB error:', error);
      return NextResponse.json({ data: [], total: 0, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data, total: data?.length ?? 0 });
  } catch (err) {
    console.error('[schedules] Unexpected error:', err);
    return NextResponse.json({ data: [], total: 0, error: 'internal_error' }, { status: 500 });
  }
}

// POST /api/schedules
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const errors = validateSchedule(body);
  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin.from('Schedule').insert({
      id: 's-' + Date.now(),
      organizationId: body.organizationId || crypto.randomUUID().toString(),
      title: body.title,
      scheduledAt: body.scheduledAt,
      status: 'scheduled',
      channel: body.channel || 'social',
      createdAt: new Date().toISOString(),
    });

    if (error) {
      console.error('[schedules] DB insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data, status: 201 });
  } catch (err) {
    console.error('[schedules] Unexpected error:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}