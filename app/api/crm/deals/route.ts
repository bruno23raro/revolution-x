import { NextRequest, NextResponse } from 'next/server';
import { validateDeal } from '../../../../src/services/crmService';
import { dealRepoReal } from '../../../../src/repositories/crmRepoReal';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const org = url.searchParams.get('organizationId') || 'mock-org';
  return NextResponse.json({ organizationId: org, items: await dealRepoReal.findByOrganization(org) });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const errors = validateDeal(body);
  if (errors.length) return NextResponse.json({ error: errors.join(',') }, { status: 400 });
  return NextResponse.json(await dealRepoReal.create({ organizationId: body.organizationId || 'mock-org', ...body }), { status: 201 });
}
