import { NextRequest, NextResponse } from 'next/server';
import { validateContact } from '../../../../src/services/crmService';
import { contactRepoReal } from '../../../../src/repositories/crmRepoReal';
import { getAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const items = await contactRepoReal.findByOrganization(user.organizationId);
  return NextResponse.json({ organizationId: user.organizationId, items });
}

export async function POST(req: NextRequest) {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  const errors = validateContact(body);
  if (errors.length) return NextResponse.json({ error: errors.join(',') }, { status: 400 });
  // Nunca confiar em organizationId vindo do payload (mass-assignment): a linha
  // SEMPRE nasce na org do usuário autenticado (server-derived). Mesmo padrão
  // seguro da rota /api/crm/pipelines. O `...body` original permitia plantar
  // registros em outro tenant.
  delete (body as Record<string, unknown>).organizationId;
  const item = await contactRepoReal.create({ organizationId: user.organizationId, ...body });
  return NextResponse.json(item, { status: 201 });
}
