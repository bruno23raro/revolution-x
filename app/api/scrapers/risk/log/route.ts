import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { logRiskEntry, getRiskLogs, checkRiskAcknowledgment } from '@/modules/scrapers/riskLogger';

// Versão atual do sistema de risco (deve coincidir com CURRENT_RISK_VERSION)
const CURRENT_RISK_VERSION = '2.0.0';

export const dynamic = 'force-dynamic';

async function requireAdmin(req: NextRequest): Promise<AuthenticatedUser | null> {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;
  if (user.role === 'admin' || user.role === 'owner') return user;
  return null;
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();

    // Validate required fields
    if (!body.action || !body.platform || !body.target) {
      return NextResponse.json(
        { error: 'Missing required fields: action, platform, target' },
        { status: 400 }
      );
    }

    // Check risk acknowledgment (required for all operations)
    const acknowledged = await checkRiskAcknowledgment(
      user.id,
      body.platform,
      CURRENT_RISK_VERSION
    );

    if (!acknowledged) {
      return NextResponse.json(
        { error: 'Risk acknowledgment required for automated platform operations' },
        { status: 403 }
      );
    }

    // Create risk log entry
    const riskLog = await logRiskEntry({
      userId: user.id,
      organizationId: user.organizationId,
      action: body.action,
      platform: body.platform,
      target: body.target,
      riskLevel: body.riskLevel || 'medium',
      context: body.context || {},
      result: body.result || 'success',
    });

    return NextResponse.json({ success: true, riskLog });
  } catch (error) {
    console.error('[risk-logger] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);

    // Build filters from query parameters
    const filters: any = {};

    if (searchParams.get('userId')) {
      filters.userId = searchParams.get('userId');
    }

    if (searchParams.get('platform')) {
      const platform = searchParams.get('platform');
      if (['instagram', 'facebook', 'whatsapp', 'google'].includes(platform!)) {
        filters.platform = platform;
      }
    }

    if (searchParams.get('riskLevel')) {
      const riskLevel = searchParams.get('riskLevel');
      if (['low', 'medium', 'high', 'critical'].includes(riskLevel!)) {
        filters.riskLevel = riskLevel;
      }
    }

    if (searchParams.get('result')) {
      const result = searchParams.get('result');
      if (['success', 'failed', 'blocked'].includes(result!)) {
        filters.result = result;
      }
    }

    if (searchParams.get('target')) {
      filters.target = searchParams.get('target');
    }

    // Get risk logs
    const riskLogs = await getRiskLogs(filters);

    // For security, mask sensitive data in response (only admin can see full logs)
    const maskedLogs = riskLogs.map((log) => ({
      id: log.id,
      userId: log.userId,
      action: log.action,
      platform: log.platform,
      target: log.target,
      riskLevel: log.riskLevel,
      context: log.context,
      result: log.result,
      timestamp: log.timestamp,
    }));

    return NextResponse.json({
      success: true,
      riskLogs: maskedLogs,
      count: maskedLogs.length,
    });
  } catch (error) {
    console.error('[risk-logger] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

interface AuthenticatedUser {
  id: string;
  email: string | null;
  organizationId: string;
  role: string;
}