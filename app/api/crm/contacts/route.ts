import { NextRequest, NextResponse } from 'next/server';
import { contactRepoReal } from '../../../../src/repositories/crmRepoReal';
import { getAuth } from '@/lib/auth';
import { contactCreateSchema, searchParamsSchema } from '@/lib/validation/schemas';
import { withTenantContext } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const parsed = searchParamsSchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_query', details: parsed.error.flatten() },
      { status: 400 }
    );
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
  const parsed = contactCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_payload', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // organizationId is server-derived from authenticated user's tenant
  const data: Prisma.ContactUncheckedCreateInput = {
    organizationId: user.organizationId,
    ...parsed.data,
    customFields: parsed.data.customFields as Prisma.InputJsonValue,
    preferences: parsed.data.preferences as Prisma.InputJsonValue,
  };

  const item = await withTenantContext(user.organizationId, async (tx) => {
    return tx.contact.create({ data });
  });

  return NextResponse.json(item, { status: 201 });
}