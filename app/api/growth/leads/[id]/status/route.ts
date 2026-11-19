/**
 * PUT /api/growth/leads/[id]/status
 *
 * Update funnel status of a lead
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
    updatedAt: new Date(),
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

  try {
    const lead = await prisma.growthLead.update({
      where: {
        id,
        organizationId: user.organizationId,
      },
      data: updateData,
    });

    return NextResponse.json({ success: true, lead });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }
    console.error('[Growth Leads] Error updating status:', error);
    return NextResponse.json(
      { error: 'Failed to update lead status' },
      { status: 500 }
    );
  }
}