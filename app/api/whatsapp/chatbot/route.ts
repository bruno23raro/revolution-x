// FASE 1 — Chatbot de WhatsApp configurável (admin).
//
//   GET    /api/whatsapp/chatbot → { config }          (admin)
//   POST   /api/whatsapp/chatbot → { ok }              (admin)
//   DELETE /api/whatsapp/chatbot → { ok }              (admin)
//
// A configuração vive em AgentMemory (RLS de tenant/usuário, MESMO padrão da
// config de IA) — nunca no frontend. O motor de decisão é o puro
// `evaluateChatbot` (src/integrations/meta/whatsappChatbot), usado pelo
// processador de webhook. Aqui só fazemos CRUD do config, com validação.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getAllOrganizationMemberships } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TaskQueueUnavailableError } from '@/lib/taskQueue';
import { saveChatbotConfig, getChatbotConfig, CHATBOT_KEY } from '@/integrations/configStore';
import { type ChatbotConfig, type ChatbotRule, type MatchType } from '@/integrations/meta/whatsappChatbot';

export const dynamic = 'force-dynamic';

const KIND = 'preference';
const MAX_RULES = 50;
const MATCH_TYPES: readonly MatchType[] = ['keyword', 'contains', 'exact', 'regex'];

async function requireAdmin(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;
  if (user.role === 'admin' || user.role === 'owner') return user;
  const memberships = await getAllOrganizationMemberships(req);
  const ok = memberships?.some((m) => m.role === 'admin' || m.role === 'owner');
  return ok ? user : null;
}

function normalizeConfig(input: any): ChatbotConfig {
  const rules: ChatbotRule[] = (Array.isArray(input?.rules) ? input.rules : [])
    .slice(0, MAX_RULES)
    .map((r: any) => ({
      id: typeof r?.id === 'string' && r.id ? r.id : undefined,
      matchType: MATCH_TYPES.includes(r?.matchType) ? (r.matchType as MatchType) : 'keyword',
      pattern: typeof r?.pattern === 'string' ? r.pattern : '',
      flags: typeof r?.flags === 'string' ? r.flags : undefined,
      response: typeof r?.response === 'string' ? r.response : '',
      action: typeof r?.action === 'string' ? r.action : undefined,
      enabled: r?.enabled === false ? false : true,
    }));

  return {
    enabled: input?.enabled === true,
    greeting: typeof input?.greeting === 'string' ? input.greeting : undefined,
    fallback: typeof input?.fallback === 'string' ? input.fallback : undefined,
    timezone: typeof input?.timezone === 'string' && input.timezone ? input.timezone : undefined,
    activeFromHour:
      typeof input?.activeFromHour === 'number'
        ? Math.max(0, Math.min(23, Math.floor(input.activeFromHour)))
        : undefined,
    activeToHour:
      typeof input?.activeToHour === 'number'
        ? Math.max(0, Math.min(23, Math.floor(input.activeToHour)))
        : undefined,
    rules,
    useAI: input?.useAI === true,
    aiSystemPrompt:
      typeof input?.aiSystemPrompt === 'string' && input.aiSystemPrompt
        ? input.aiSystemPrompt
        : undefined,
  };
}

export async function GET(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ config: null }, { status: 401 });

  const scope = { organizationId: user.organizationId, userId: user.id };
  try {
    const config = await getChatbotConfig(prisma, scope);
    return NextResponse.json({ config });
  } catch (e) {
    if (e instanceof TaskQueueUnavailableError) {
      return NextResponse.json({ error: 'task_queue_unavailable', config: null }, { status: 503 });
    }
    throw e;
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, any>;
  try {
    body = (await req.json()) as Record<string, any>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const config = normalizeConfig(body);
  const scope = { organizationId: user.organizationId, userId: user.id };
  try {
    await saveChatbotConfig(prisma, scope, config as unknown as Record<string, unknown>);
  } catch (e) {
    if (e instanceof TaskQueueUnavailableError) {
      return NextResponse.json({ error: 'task_queue_unavailable' }, { status: 503 });
    }
    throw e;
  }

  return NextResponse.json({ ok: true, rules: config.rules.length, enabled: config.enabled });
}

export async function DELETE(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const scope = { organizationId: user.organizationId, userId: user.id };
  try {
    await prisma.agentMemory.deleteMany({
      where: {
        organizationId: user.organizationId,
        userId: user.id,
        kind: KIND,
        memoryKey: CHATBOT_KEY,
      },
    });
  } catch (e) {
    if (e instanceof TaskQueueUnavailableError) {
      return NextResponse.json({ error: 'task_queue_unavailable' }, { status: 503 });
    }
    throw e;
  }

  return NextResponse.json({ ok: true });
}
