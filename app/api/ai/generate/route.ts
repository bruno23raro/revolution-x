// FASE 18 — POST /api/ai/generate (§13): geração com cadeia de fallback.
//
// Autenticado (401 sem sessão). O dono pode sobrescrever provedor/modelo via
// `ai_config` (AgentMemory) — chaves vivem no backend, nunca no client.
// `task` orienta o auto-modo (determinístico). Prompt é limitado (§13/§16).
// Resultado ok=false + error honesto; NUNCA inventa texto.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '../../../../src/lib/auth';
import { prisma } from '../../../../src/lib/prisma';
import { listMemory } from '../../../../src/lib/taskQueue';
import { buildAiProviders, generateWithFallback } from '../../../../src/ai';
import { getTestProviders } from '../../../../src/ai/testSeam';

const AI_CONFIG_KEY = 'ai_config';
const MAX_PROMPT = 8_000;

async function getOwnerOverrides(organizationId: string, userId: string) {
  // BYOK é best-effort: se o banco estiver indisponível (ex.: teste sem DB),
  // o dono simplesmente não tem override — o SaaS cai no provedor default.
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

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt : '';
  if (!prompt.trim()) {
    return NextResponse.json({ error: 'prompt_required' }, { status: 400 });
  }
  if (prompt.length > MAX_PROMPT) {
    return NextResponse.json({ error: 'prompt_too_long' }, { status: 400 });
  }

  const overrides = await getOwnerOverrides(user.organizationId, user.id);
  const providers = getTestProviders() ?? buildAiProviders({ overrides });

  const result = await generateWithFallback({
    providers,
    request: {
      prompt: prompt.slice(0, MAX_PROMPT),
      task: typeof body.task === 'string' ? body.task : undefined,
      system: typeof body.system === 'string' ? body.system : undefined,
      model: typeof body.model === 'string' ? body.model : undefined,
      provider: typeof body.provider === 'string' ? body.provider : undefined,
      maxTokens: typeof body.maxTokens === 'number' ? body.maxTokens : undefined,
      temperature: typeof body.temperature === 'number' ? body.temperature : undefined,
    },
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}