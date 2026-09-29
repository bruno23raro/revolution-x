import { NextRequest, NextResponse } from 'next/server';
import { validateContact } from '../../../../src/services/crmService';
import { contactRepoReal } from '../../../../src/repositories/crmRepoReal';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const org = url.searchParams.get('organizationId') || 'mock-org';
  const items = await contactRepoReal.findByOrganization(org);
  return NextResponse.json({ organizationId: org, items });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const errors = validateContact(body);
  if (errors.length) return NextResponse.json({ error: errors.join(',') }, { status: 400 });
  const item = await contactRepoReal.create({ organizationId: body.organizationId || 'mock-org', ...body });
  return NextResponse.json(item, { status: 201 });
}
