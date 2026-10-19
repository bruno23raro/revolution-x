import { NextRequest, NextResponse } from 'next/server';
import { validateProduct } from '../../../src/services/productService';
import { productRepoReal } from '../../../src/repositories/productRepoReal';
import { getAuthenticatedUser } from '../../../src/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const items = await productRepoReal.findByOrganization(user.organizationId);
  return NextResponse.json({ organizationId: user.organizationId, items });
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  const errors = validateProduct(body);
  if (errors.length) return NextResponse.json({ error: errors.join(',') }, { status: 400 });
  // Nunca confiar em organizationId vindo do payload (mass-assignment): a linha
  // SEMPRE nasce na org do usuário autenticado (server-derived). Mesmo padrão
  // seguro da rota /api/crm/pipelines. O `...body` original permitia plantar
  // registros em outro tenant.
  delete (body as Record<string, unknown>).organizationId;
  const item = await productRepoReal.create({ organizationId: user.organizationId, ...body });
  return NextResponse.json(item, { status: 201 });
}
