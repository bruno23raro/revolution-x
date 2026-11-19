/**
 * GET /api/growth/analytics
 *
 * Return growth metrics and analytics for the authenticated user's organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get('days') || '30');
  const instanceName = searchParams.get('instance');

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get leads by funnel status
  const leads = await prisma.growthLead.findMany({
    where: {
      organizationId: user.organizationId,
      createdAt: { gte: startDate },
    },
    select: {
      funnelStatus: true,
      source: true,
      contact: true,
      createdAt: true,
      responseCount: true,
    },
  });

  // Calculate funnel metrics
  const funnelCounts: Record<string, number> = {
    pending: 0,
    first_contact: 0,
    interested: 0,
    scheduled: 0,
    customer: 0,
  };

  leads?.forEach(lead => {
    if (funnelCounts.hasOwnProperty(lead.funnelStatus)) {
      funnelCounts[lead.funnelStatus]++;
    }
  });

  const totalLeads = leads?.length || 0;
  const conversionRate = totalLeads > 0
    ? ((funnelCounts.customer + funnelCounts.scheduled) / totalLeads) * 100
    : 0;

  // Get WhatsApp messages for response rate calculation
  const messages = await prisma.message.findMany({
    where: {
      organizationId: user.organizationId,
      createdAt: { gte: startDate },
    },
    select: {
      direction: true,
      createdAt: true,
      toContact: true,
    },
  });

  const messagesSent = messages?.filter(m => m.direction === 'outbound').length || 0;
  const messagesReceived = messages?.filter(m => m.direction === 'inbound').length || 0;
  const responseRate = messagesSent > 0
    ? (messagesReceived / messagesSent) * 100
    : 0;

  // Get instance performance if specified
  let instancePerformance: any = null;
  if (instanceName) {
    const instance = await prisma.whatsappInstance.findFirst({
      where: {
        organizationId: user.organizationId,
        instanceName,
      },
    });

    const instanceLeads = await prisma.growthLead.count({
      where: {
        organizationId: user.organizationId,
        metadata: {
          path: ['targetInstance'],
          equals: instanceName,
        },
      },
    });

    instancePerformance = {
      instanceName,
      status: instance?.status,
      totalLeads: instanceLeads,
      lastHeartbeat: instance?.lastHeartbeat,
    };
  }

  // Get leads by source
  const sourceBreakdown: Record<string, number> = {};
  leads?.forEach(lead => {
    const source = lead.source || 'unknown';
    sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;
  });

  // Get leads by day for trend chart
  const leadsByDay: Record<string, number> = {};
  leads?.forEach(lead => {
    const day = lead.createdAt.toISOString().split('T')[0];
    leadsByDay[day] = (leadsByDay[day] || 0) + 1;
  });

  return NextResponse.json({
    success: true,
    analytics: {
      period: { days, startDate: startDate.toISOString() },
      funnel: funnelCounts,
      totalLeads,
      conversionRate: conversionRate.toFixed(2),
      responseRate: responseRate.toFixed(2),
      messages: {
        sent: messagesSent,
        received: messagesReceived,
      },
      sourceBreakdown,
      leadsByDay,
      instancePerformance,
    },
  });
}