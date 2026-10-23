// FASE 18 — GET /api/ai/models (§13): lista de modelos por provedor.
//
// Autenticado (401 sem sessão). NUNCA devolve chaves: `configured` é
// booleano e os modelos são só metadados (id, nome, janela, capacidades).
// Descoberta é cacheada (stale-while-revalidate). `auto` expõe o estado do
// auto-modo sem inventar dados.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '../../../../src/lib/auth';
import { prisma } from '../../../../src/lib/prisma';
import { listMemory } from '../../../../src/lib/taskQueue';
import {
  buildAiProviders,
  discoverModels,
  type AutoSelectPrefs,
} from '../../../../src/ai';
import { getTestProviders } from '../../../../src/ai/testSeam';

const AI_CONFIG_KEY = 'ai_config';

async function getOwnerOverrides(organizationId: string, userId: string) {
  try {
    const memories = await withTimeout(listMemory(prisma, { organizationId, userId }, 10), 1500);
    const cfg = memories.find((m) => m.key === AI_CONFIG_KEY);
    if (!cfg) return undefined;
    const v = cfg.value as { baseUrl?: string; apiKey?: string; model?: string } | null;
    if (!v?.baseUrl || !v?.apiKey) return undefined;
    return { baseUrl: v.baseUrl, apiKey: v.apiKey, model: v.model };
  } catch {
    return undefined;
  }
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms),
    ),
  ]);
}

export async function GET(_req: NextRequest) {
  const user = await getAuthenticatedUser(_req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const overrides = await getOwnerOverrides(user.organizationId, user.id);
  const providers = getTestProviders() ?? buildAiProviders({ overrides });

  const out: Array<{
    id: string;
    name: string;
    configured: boolean;
    models: Array<{ id: string; name?: string; contextWindow?: number; capabilities?: string[] }>;
    cachedAt: number;
    source: 'api' | 'fallback' | 'none';
    stale: boolean;
  }> = [];

  for (const p of providers) {
    const d = await discoverModels(p);
    out.push({
      id: p.id,
      name: p.name,
      configured: p.configured,
      models: d.models.map((m) => ({
        id: m.id,
        name: m.name,
        contextWindow: m.contextWindow,
        capabilities: m.capabilities,
      })),
      cachedAt: d.cachedAt,
      source: d.source,
      stale: d.stale,
    });
  }

  return NextResponse.json({
    providers: out,
    auto: {
      enabled: true,
      strategy: 'capability-filter + context-window calibration (determinístico)',
    } as AutoSelectPrefs,
    // Nunca inclui apiKey/baseUrl.
  });
}