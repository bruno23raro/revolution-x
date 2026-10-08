import { NextRequest, NextResponse } from 'next/server';
import { validateLead } from '../../../../src/services/crmService';
import { leadRepoReal } from '../../../../src/repositories/crmRepoReal';
import { getAuthenticatedUser } from '../../../../src/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const items = await leadRepoReal.findByOrganization(user.organizationId);
  return NextResponse.json({ organizationId: user.organizationId, items });
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  const errors = validateLead(body);
  if (errors.length) return NextResponse.json({ error: errors.join(',') }, { status: 400 });
  const item = await leadRepoReal.create({ organizationId: user.organizationId, ...body });
  return NextResponse.json(item, { status: 201 });
}
