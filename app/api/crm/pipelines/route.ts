import { NextRequest, NextResponse } from 'next/server';
import { validatePipeline } from '../../../../src/services/crmService';
import { pipelineRepoReal } from '../../../../src/repositories/crmRepoReal';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const org = url.searchParams.get('organizationId') || 'mock-org';
  return NextResponse.json({ organizationId: org, items: await pipelineRepoReal.findByOrganization(org) });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const errors = validatePipeline(body);
  if (errors.length) return NextResponse.json({ error: errors.join(',') }, { status: 400 });
  return NextResponse.json(await pipelineRepoReal.create({ organizationId: body.organizationId || 'mock-org', name: body.name, stages: body.stages || [] }), { status: 201 });
}
