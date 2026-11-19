/**
 * POST /api/growth/leads
 *
 * Create a new lead or batch import leads from extraction
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatE164 } from '@/services/evolution/EvolutionService';

export async function POST(req: NextRequest) {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  // Support both single lead and batch import
  const leads = Array.isArray(body.leads) ? body.leads : [body];

  const newLeads = leads.map((lead: any) => ({
    organizationId: user.organizationId,
    source: lead.source || 'instagram',
    contact: formatE164(lead.contact),
    metadata: lead.metadata || {},
    status: 'pending',
    funnelStatus: 'pending',
    responseCount: 0,
  }));

  try {
    const createdLeads = await prisma.growthLead.createMany({
      data: newLeads,
      skipDuplicates: true,
    });

    return NextResponse.json({ success: true, count: createdLeads.count }, { status: 201 });
  } catch (error) {
    console.error('[Growth Leads] Error creating lead:', error);
    return NextResponse.json(
      { error: 'Failed to create lead', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}