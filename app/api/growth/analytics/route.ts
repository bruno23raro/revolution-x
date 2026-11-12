/**
 * GET /api/growth/analytics
 *
 * Return growth metrics and analytics for the authenticated user's organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get('days') || '30');
  const instanceName = searchParams.get('instance');

  const supa = createServiceRoleClient();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get leads by funnel status
  const { data: leads, error: leadsError } = await supa
    .from('growth_leads')
    .select('funnelStatus, source, contact, createdAt, responseCount')
    .eq('organizationId', user.organizationId)
    .gte('createdAt', startDate.toISOString());

  if (leadsError) {
    console.error('[Growth Analytics] Error fetching leads:', leadsError);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }

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
  const { data: messages, error: messagesError } = await supa
    .from('messages')
    .select('direction, createdAt, toContact')
    .eq('organizationId', user.organizationId)
    .gte('createdAt', startDate.toISOString());

  if (messagesError) {
    console.error('[Growth Analytics] Error fetching messages:', messagesError);
    return NextResponse.json(
      { error: 'Failed to fetch message analytics' },
      { status: 500 }
    );
  }

  const messagesSent = messages?.filter(m => m.direction === 'outbound').length || 0;
  const messagesReceived = messages?.filter(m => m.direction === 'inbound').length || 0;
  const responseRate = messagesSent > 0
    ? (messagesReceived / messagesSent) * 100
    : 0;

  // Get instance performance if specified
  let instancePerformance: any = null;
  if (instanceName) {
    const { data: instance } = await supa
      .from('whatsapp_instances')
      .select('*')
      .eq('organizationId', user.organizationId)
      .eq('instanceName', instanceName)
      .single();

    const { data: instanceLeads } = await supa
      .from('growth_leads')
      .select('*')
      .eq('organizationId', user.organizationId)
      .eq('metadata->>targetInstance', instanceName);

    instancePerformance = {
      instanceName,
      status: instance?.status,
      totalLeads: instanceLeads?.length || 0,
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
    const day = lead.createdAt.split('T')[0];
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
