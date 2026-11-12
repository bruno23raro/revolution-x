/**
 * PUT /api/growth/leads/[id]/status
 *
 * Update funnel status of a lead
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supa = createServiceRoleClient();
  const { id } = await params;

  const body = await req.json();
  const { funnelStatus, notes, assignedTo } = body;

  // Validate funnel status
  const validStatuses = ['pending', 'first_contact', 'interested', 'scheduled', 'customer'];
  if (funnelStatus && !validStatuses.includes(funnelStatus)) {
    return NextResponse.json(
      { error: 'Invalid funnelStatus' },
      { status: 400 }
    );
  }

  const updateData: Record<string, any> = {
    updatedAt: new Date().toISOString(),
  };

  if (funnelStatus) {
    updateData.funnelStatus = funnelStatus;
  }
  if (notes !== undefined) {
    updateData.notes = notes;
  }
  if (assignedTo) {
    updateData.assignedTo = assignedTo;
  }

  const { data, error } = await supa
    .from('growth_leads')
    .update(updateData)
    .eq('id', id)
    .eq('organizationId', user.organizationId)
    .select()
    .single();

  if (error) {
    console.error('[Growth Leads] Error updating status:', error);
    return NextResponse.json(
      { error: 'Failed to update lead status' },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: 'Lead not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, lead: data });
}
