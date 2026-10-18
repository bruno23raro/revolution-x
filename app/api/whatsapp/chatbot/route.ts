// FASE 1 — Chatbot de WhatsApp configurável (admin).
// FASE 3 · slice 2 — fluxo visual: `steps` (nós c/ condição, resposta,
// quick replies, ponteiro next) + `vars` ({{nome}}) entram no MESMO CRUD.
//
//   GET    /api/whatsapp/chatbot → { config }          (admin)
//   POST   /api/whatsapp/chatbot → { ok }              (admin)
//   DELETE /api/whatsapp/chatbot → { ok }              (admin)
//
// A configuração vive em AgentMemory (RLS de tenant/usuário, MESMO padrão da
// config de IA) — nunca no frontend. O motor de decisão é o puro
// `evaluateChatbot` (src/integrations/meta/whatsappChatbot), usado pelo
// processador de webhook e pelo auto-reply (`chatbotAutoReply`).

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getAllOrganizationMemberships } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TaskQueueUnavailableError } from '@/lib/taskQueue';
import { saveChatbotConfig, getChatbotConfig, CHATBOT_KEY } from '@/integrations/configStore';
import {
  type ChatbotConfig,
  type ChatbotRule,
  type ChatbotStep,
  type MatchType,
} from '@/integrations/meta/whatsappChatbot';

export const dynamic = 'force-dynamic';

const KIND = 'preference';
const MAX_RULES = 50;
const MAX_STEPS = 50;
const MAX_QUICK_REPLIES = 10; // o sender corta em 3 (limite da Meta)
const MAX_VARS = 100;
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

  const steps: ChatbotStep[] = (Array.isArray(input?.steps) ? input.steps : [])
    .slice(0, MAX_STEPS)
    .map((s: any, i: number) => ({
      id: typeof s?.id === 'string' && s.id.trim() ? s.id.trim() : `step-${i + 1}`,
      matchType:
        s?.matchType && MATCH_TYPES.includes(s.matchType) ? (s.matchType as MatchType) : undefined,
      pattern: typeof s?.pattern === 'string' && s.pattern ? s.pattern : undefined,
      flags: typeof s?.flags === 'string' && s.flags ? s.flags : undefined,
      response: typeof s?.response === 'string' ? s.response : undefined,
      quickReplies: Array.isArray(s?.quickReplies)
        ? s.quickReplies
            .filter((x: unknown) => typeof x === 'string')
            .map((x: string) => x.trim())
            .filter(Boolean)
            .slice(0, MAX_QUICK_REPLIES)
        : undefined,
      nextStepId: typeof s?.nextStepId === 'string' && s.nextStepId ? s.nextStepId : null,
      end: s?.end === true,
    }));

  const vars: Record<string, string> = {};
  if (input?.vars && typeof input.vars === 'object' && !Array.isArray(input.vars)) {
    let count = 0;
    for (const [k, v] of Object.entries(input.vars as Record<string, unknown>)) {
      if (count >= MAX_VARS) break;
      if (typeof v === 'string') vars[k.slice(0, 64)] = v.slice(0, 500);
      count++;
    }
  }

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
    steps,
    vars,
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

  return NextResponse.json({
    ok: true,
    rules: config.rules.length,
    steps: (config.steps ?? []).length,
    enabled: config.enabled,
  });
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
