import { NextRequest, NextResponse } from 'next/server';
import { validateLead } from '../../../../src/services/crmService';
import { leadRepoReal } from '../../../../src/repositories/crmRepoReal';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const org = url.searchParams.get('organizationId') || 'mock-org';
  const items = await leadRepoReal.findByOrganization(org);
  return NextResponse.json({ organizationId: org, items, mock: true, note: 'DEPENDÊNCIA DE BANCO — NÃO VALIDADA' });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const errors = validateLead(body);
  if (errors.length) return NextResponse.json({ error: errors.join(',') }, { status: 400 });
  const item = await leadRepoReal.create({ organizationId: body.organizationId || 'mock-org', ...body });
  return NextResponse.json({ ...item, mock: true }, { status: 201 });
}
