// FASE AGENT — Phase 2: chat administrativo + fila persistente.
//
// POST /api/admin/chat  → fluxo SSE (Server-Sent Events) em JSON.
//   1. autentica via Supabase (getAuthenticatedUser) e exige papel admin;
//   2. cria uma Task persistente (degrada com aviso se a fila não existe
//      no ambiente — nunca simula progresso);
//   3. registra memória persistente do tenant/usuário;
//   4. executa chatCompletion via OmniRouter quando configurado;
//      caso contrário, responde com mensagem informativa clara.
//   5. registra uso de tokens (custo real) e o estado final da Task.
//
// O stream emite eventos `data: {json}\n\n` do tipo:
//   start | task | progress | step | memory | message | usage | error | done
// GET  /api/admin/chat → status de configuração (sempre seguro, sem segredos).

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getAuthenticatedUser, getAllOrganizationMemberships } from '../../../../src/lib/auth';
import { prisma } from '../../../../src/lib/prisma';
import {
  resolveOmniRouterConfig,
  chatCompletion,
  type ChatMessage,
  type OmniRouterUsage,
  type OmniRouterOverrides,
} from '../../../../src/ai/omniRouter';
import {
  createTask,
  startTask,
  markStep,
  completeTask,
  failTask,
  listMemory,
  TaskQueueUnavailableError,
} from '../../../../src/lib/taskQueue';

export const dynamic = 'force-dynamic';

// ------------------------------------------------------------------
// Autenticação + papel (admin/owner em qualquer membership)
// ------------------------------------------------------------------
async function requireAdmin(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;
  if (user.role === 'admin' || user.role === 'owner') return user;
  const memberships = await getAllOrganizationMemberships(req);
  const ok = memberships?.some((m) => m.role === 'admin' || m.role === 'owner');
  return ok ? user : null;
}

// ------------------------------------------------------------------
// Busca configuração manual de IA do DB (AgentMemory)
// Retorna overrides para passar a resolveOmniRouterConfig
// ------------------------------------------------------------------
const AI_CONFIG_KEY = 'ai_config';

async function getAiConfigOverrides(
  organizationId: string,
  userId: string,
): Promise<OmniRouterOverrides | null> {
  try {
    const memories = await listMemory(prisma, { organizationId, userId }, 10);
    const config = memories.find((m) => m.key === AI_CONFIG_KEY);
    if (!config) return null;
    const value = config.value as
      | { baseUrl?: string; apiKey?: string; model?: string }
      | null;
    if (!value?.baseUrl || !value?.apiKey) return null;
    return { baseUrl: value.baseUrl, apiKey: value.apiKey, model: value.model };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------
// Helpers do stream
// ------------------------------------------------------------------
type SseEvent = Record<string, unknown>;

function sseEncode(ev: SseEvent): string {
  return `data: ${JSON.stringify(ev)}\n\n`;
}

// ------------------------------------------------------------------
// GET — estado de configuração (sem expor segredos)
// ------------------------------------------------------------------
export async function GET() {
  const cfg = resolveOmniRouterConfig();
  return NextResponse.json({
    routerConfigured: cfg !== null,
    model: cfg?.model ?? null,
    // Origem (scheme+host) apenas — nunca credenciais. O origin não carrega userinfo.
    baseUrl: cfg ? new URL(cfg.baseUrl).origin : null,
  });
}

// ------------------------------------------------------------------
// POST — chat administrativo via SSE
// ------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized (papel admin/owner exigido)' },
      { status: 401 },
    );
  }

  let body: { message?: unknown; context?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) {
    return NextResponse.json({ error: 'message é obrigatório' }, { status: 400 });
  }
  const context = typeof body.context === 'string' ? body.context.slice(0, 4000) : '';

  const scope = { organizationId: user.organizationId, userId: user.id };

  // Busca overrides do DB (configuração manual salva pelo admin)
  const dbOverrides = await getAiConfigOverrides(user.organizationId, user.id);
  const cfg = resolveOmniRouterConfig(dbOverrides ?? undefined);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (ev: SseEvent) => controller.enqueue(encoder.encode(sseEncode(ev)));
      const safe = async <T>(fn: () => Promise<T>): Promise<T | null> =>
        fn().catch((e: unknown) => {
          if (e instanceof TaskQueueUnavailableError) {
            emit({ type: 'warning', code: 'queue_unavailable', detail: e.message });
            return null;
          }
          throw e;
        });

      try {
        emit({ type: 'start', at: new Date().toISOString() });

        // 1) Tarefa persistente (com degradação honesta)
        const STEPS = ['preparar-contexto', 'processar-solicitacao', 'registrar-tarefa'];
        let taskId: string | null = null;
        let queueAvailable = false;
        const created = await safe(async () => {
          const r = await createTask(prisma, scope, {
            title: message.slice(0, 200),
            input: { prompt: message, context },
            steps: STEPS,
          });
          await startTask(prisma, scope, r.taskId);
          return r;
        });
        if (created) {
          taskId = created.taskId;
          queueAvailable = true;
          emit({ type: 'task', taskId, status: 'running', progress: 0, steps: STEPS });
        }

        // 2) Memória persistente do tenant/usuário
        const memory = await safe(async () => listMemory(prisma, scope, 20));
        if (memory && memory.length > 0) {
          emit({ type: 'memory', count: memory.length });
        }

        // 3) Etapa 1 — contexto preparado
        if (taskId && queueAvailable) {
          await safe(async () => {
            const p = await markStep(prisma, scope, taskId, 0, 'done', {
              memory: memory?.length ?? 0,
            });
            emit({ type: 'progress', pct: p.progress, step: 0, total: STEPS.length });
          });
        }

        // 4) IA: usar OmniRouter quando disponível; senão, resposta informativa
        emit({ type: 'step', step: 'processar-solicitacao' });
        let text = '';
        let modelUsed: string | null = null;
        let usage: OmniRouterUsage | null = null;

        if (cfg) {
          // Roteador configurado → LLM real
          const sysMessages: ChatMessage[] = [
            {
              role: 'system',
              content:
                'Você é o assistente do Centro Administrativo do REVOLUTION X. ' +
                'Responda em português, de forma concisa e acionável. ' +
                'Trabalhe apenas com fatos; se algo não puder ser executado, diga o motivo exato. ' +
                (context ? `Contexto do usuário:\n${context}\n\n` : '') +
                (memory && memory.length > 0
                  ? `Memória persistente do projeto (referência):\n${memory
                      .map((m) => `- [${m.kind}] ${m.key}: ${JSON.stringify(m.value)}`)
                      .join('\n')}\n\n`
                  : ''),
            },
            { role: 'user', content: message },
          ];
          try {
            const res = await chatCompletion(sysMessages, { maxTokens: 2048, temperature: 0.4 }, cfg);
            text = res.text;
            modelUsed = res.model ?? cfg.model;
            usage = res.usage ?? null;
          } catch (e) {
            const errMsg = e instanceof Error ? e.message : String(e);
            if (taskId && queueAvailable) {
              await safe(async () => {
                await markStep(prisma, scope, taskId, 1, 'failed', { error: errMsg });
                await failTask(prisma, scope, taskId, `Falha na geração: ${errMsg}`, {
                  modelUsed: modelUsed ?? undefined,
                });
              });
            }
            emit({ type: 'error', code: 'generation_failed', detail: errMsg });
            emit({ type: 'done', ok: false, taskId });
            controller.close();
            return;
          }
        } else {
          // Sem roteador: resposta informativa que explica o status atual
          text = [
            `Sua solicitação foi recebida: "${message.slice(0, 100)}".`,
            '',
            'O Centro Administrativo está **operacional** (fila de tarefas ativa).',
            'No entanto, o módulo de IA (OmniRouter) **não está configurado** neste ambiente.',
            '',
            'Para habilitar o chat com IA, defina no servidor:',
            '- `OMNIROUTER_BASE_URL` (ex.: https://api.openai.com ou proxy compatível)',
            '- `OMNIROUTER_API_KEY` (sua chave de API)',
            '',
            'Ou salve uma configuração manual em <a href="/admin/settings" class="text-purple-400 underline">Configurações</a>.',
            '',
            'Até lá, você pode usar as outras ferramentas administrativas:',
            '- **Tarefas**: acompanhe o progresso real das requisições',
            '- **Memória**: registros persistentes do projeto',
            '- **Configurações**: verifique o estado dos subsistemas',
            '',
            'Se precisar de ajuda para configurar, contate o administrador do sistema.',
          ].join('\n');
        }

        // 5) Etapas finais + uso real de tokens
        if (taskId && queueAvailable) {
          await safe(async () => {
            const p2 = await markStep(prisma, scope, taskId, 1, 'done', {
              model: modelUsed,
              usage: usage ? (JSON.parse(JSON.stringify(usage)) as Prisma.JsonValue) : undefined,
            });
            emit({ type: 'progress', pct: p2.progress, step: 1, total: STEPS.length });
            const p3 = await markStep(prisma, scope, taskId, 2, 'done');
            emit({ type: 'progress', pct: p3.progress, step: 2, total: STEPS.length });
            await completeTask(prisma, scope, taskId, {
              result: { textLength: text.length, model: modelUsed, routerConfigured: cfg !== null },
              usage: usage === null ? undefined : (JSON.parse(JSON.stringify(usage)) as Prisma.JsonValue),
              modelUsed: modelUsed ?? undefined,
            });
          });
        }

        if (usage) emit({ type: 'usage', usage });
        emit({ type: 'message', text, model: modelUsed, usage, routerConfigured: cfg !== null });
        emit({ type: 'done', ok: true, taskId });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        emit({ type: 'error', code: 'unexpected', detail: errMsg });
        emit({ type: 'done', ok: false });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
