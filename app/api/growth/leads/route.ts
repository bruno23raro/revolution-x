/**
 * POST /api/growth/leads
 *
 * Create a new lead or batch import leads from extraction
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { formatE164 } from '@/services/evolution/EvolutionService';

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supa = createServiceRoleClient();
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  const { data, error } = await supa
    .from('growth_leads')
    .insert(newLeads)
    .select()
    .single();

  if (error) {
    console.error('[Growth Leads] Error creating lead:', error);
    return NextResponse.json(
      { error: 'Failed to create lead', details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, lead: data }, { status: 201 });
}
