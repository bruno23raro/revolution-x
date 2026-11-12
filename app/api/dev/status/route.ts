// FASE 6 — Endpoint de status para verificar ambiente demo
// GET /api/dev/status → { demo, host, db, redis, timestamp }

import { NextRequest, NextResponse } from 'next/server';
import { demoModeEnabled, isLocalDevelopmentStack } from '@/lib/demoMode';

export async function GET(req: NextRequest) {
  // Sempre seguro - apenas lê env vars de configuração
  const isDemo = demoModeEnabled();
  const host = process.env.HOST || 'localhost';
  const dbLocal = isLocalDevelopmentStack();

  // Verificar se Redis está disponível (para filas de mensagem)
  let redisAvailable = false;
  try {
    const { getRedis } = await import('@/lib/redis');
    const redis = await getRedis();
    redisAvailable = !!redis;
  } catch {
    // Redis não disponível - ok para demo sem filas
  }

  return NextResponse.json(
    {
      demo: isDemo,
      host,
      db: dbLocal ? 'local' : 'remote',
      redis: redisAvailable ? 'available' : 'unavailable',
      timestamp: new Date().toISOString(),
      mode: isDemo ? 'development' : 'production',
    },
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    }
  );
}