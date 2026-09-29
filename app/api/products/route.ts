import { NextRequest, NextResponse } from 'next/server';
import { validateProduct } from '../../../../src/services/productService';
import { productRepoReal } from '../../../../src/repositories/productRepoReal';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const org = url.searchParams.get('organizationId') || 'mock-org';
  const items = await productRepoReal.findByOrganization(org);
  return NextResponse.json({ organizationId: org, items });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const errors = validateProduct(body);
  if (errors.length) return NextResponse.json({ error: errors.join(',') }, { status: 400 });
  const item = await productRepoReal.create({ organizationId: body.organizationId || 'mock-org', ...body });
  return NextResponse.json(item, { status: 201 });
}
