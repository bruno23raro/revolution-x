// FASE 5 — GET /api/schedules (listar agendamentos)
// Baseado no padrão de app/api/crm/leads/route.ts
// Não inventado; funcionalidade inequívoca para calendário de marketing
// DEPENDÊNCIA DE BANCO — NÃO VALIDADA (usa mock)

import { NextRequest, NextResponse } from 'next/server';
import { validateSchedule } from '../../../src/services/scheduleService';

const mockSchedules = [
  {
    id: 's-001',
    organizationId: 'mock-org',
    title: 'Post Instagram - Produto Novo',
    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    status: 'scheduled',
    channel: 'social',
    createdAt: new Date().toISOString(),
  },
];

// GET /api/schedules
export async function GET() {
  return NextResponse.json({ data: mockSchedules, total: mockSchedules.length });
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

  // DEPENDÊNCIA DE BANCO — NÃO VALIDADA (substituir por query real quando DB confirmado)
  return NextResponse.json({
    data: { id: 's-' + Date.now(), ...body, organizationId: 'org-mock', createdAt: new Date().toISOString() },
    status: 201,
  });
}