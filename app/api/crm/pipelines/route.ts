import { NextRequest, NextResponse } from 'next/server';
import { validatePipeline } from '../../../../src/services/crmService';
import { pipelineRepoReal } from '../../../../src/repositories/crmRepoReal';
import { getAuthenticatedUser } from '../../../../src/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const items = await pipelineRepoReal.findByOrganization(user.organizationId);
  return NextResponse.json({ organizationId: user.organizationId, items });
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  const errors = validatePipeline(body);
  if (errors.length) return NextResponse.json({ error: errors.join(',') }, { status: 400 });
  const item = await pipelineRepoReal.create({ organizationId: user.organizationId, name: body.name, stages: body.stages || [] });
  return NextResponse.json(item, { status: 201 });
}
