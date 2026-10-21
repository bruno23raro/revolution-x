// FASE 4 · slice 3 — Teste do CRON multi-tenant (discovery + agregação).
//
// Mesma estratégia do fluxo principal (tiktokScheduler.flow.test.ts):
// fronteiras de módulo mockadas (resolveAccess / taskQueue / publish),
// `markPendingTikTokPost` e `TaskQueueUnavailableError` REAIS (p/ `instanceof`
// de verdade), e o `client.agentMemory.findMany` fake (é a única superfície
// de discovery do runner). Comprova: discovery filtra escopos sem pendência,
// um tenant com erro não bloqueia os demais, `retried` não zera o `ok`
// (semântica do slice 2) e falha de discovery degrada honestamente.

import { AgentMemory, Prisma, PrismaClient } from '@prisma/client';
import { findTikTokPendingScopes, runTikTokCronForAll } from './tiktokScheduler';
import { listPendingTikTokPosts, resolveTenantTikTokAccess } from '@/integrations/tiktok/resolveAccess';
import { saveMemory, TaskQueueUnavailableError } from '@/lib/taskQueue';
import { publishTikTokVideo } from '@/integrations/tiktok/tiktokPublisher';
import type { PendingTikTokPost } from '@/integrations/tiktok/tiktokPublisher';

jest.mock('@/integrations/tiktok/resolveAccess', () => ({
  PENDING_KEY: 'pending:tiktok_posts',
  listPendingTikTokPosts: jest.fn(),
  resolveTenantTikTokAccess: jest.fn(),
}));

// taskQueue carrega @prisma/client + ./prisma → mockamos as fronteiras;
// `TaskQueueUnavailableError` fica REAL p/ o `instanceof` do runner bater.
jest.mock('@/lib/taskQueue', () => ({
  saveMemory: jest.fn(),
  TaskQueueUnavailableError: jest.requireActual('@/lib/taskQueue').TaskQueueUnavailableError,
}));

// tiktokPublisher é puro: `markPendingTikTokPost` REAL; `publish` mockado.
jest.mock('@/integrations/tiktok/tiktokPublisher', () => ({
  publishTikTokVideo: jest.fn(),
  markPendingTikTokPost: jest.requireActual('@/integrations/tiktok/tiktokPublisher').markPendingTikTokPost,
}));

const NOW = Date.parse('2026-10-19T12:00:00Z');

const fakeClient = {
  agentMemory: { findMany: jest.fn() },
} as unknown as PrismaClient;

const findMany = jest.mocked(fakeClient.agentMemory.findMany);

const item = (id: string, over: Partial<PendingTikTokPost> = {}): PendingTikTokPost => ({
  id,
  createdAt: '2026-10-19T08:00:00Z',
  scheduledAt: '2026-10-19T11:00:00Z',
  spec: { videoUrl: `https://cdn.example.com/${id}.mp4` },
  status: 'pending',
  ...over,
});

/** Linhas AgentMemory como o runner enxerga (kind 'preference', key estável). */
const row = (organizationId: string, userId: string, valueJson: unknown) =>
  ({ organizationId, userId, valueJson: valueJson as Prisma.JsonValue } as unknown as AgentMemory);

const accessOk = () => ({
  ok: true,
  access: { accessToken: 'tk-live' },
  hasClientKey: true,
  hasClientSecret: false,
  oauth: null,
  tokenExpired: false,
} as const);

beforeEach(() => {
  findMany.mockReset();
  jest.mocked(listPendingTikTokPosts).mockReset();
  jest.mocked(resolveTenantTikTokAccess).mockReset();
  jest.mocked(saveMemory).mockReset();
  jest.mocked(publishTikTokVideo).mockReset();
});

describe('findTikTokPendingScopes (discovery)', () => {
  it('descobre escopos com item PENDING (status ausente conta como pending) e ignora filas sem pendência', async () => {
    findMany.mockResolvedValue([
      row('org-1', 'user-1', [item('a'), item('b', { status: 'published' })]),
      row('org-1', 'user-2', [item('c', { status: 'published' })]),
      row('org-2', 'user-3', [item('d')]), // sem status → pending
      row('org-3', 'user-4', 'lixo não-json-array'), // degradado → ignorado
    ]);

    const scopes = await findTikTokPendingScopes(fakeClient);

    expect(findMany).toHaveBeenCalledWith({
      where: { kind: 'preference', memoryKey: 'pending:tiktok_posts', supersededAt: null },
      select: { organizationId: true, userId: true, valueJson: true },
    });
    expect(scopes).toEqual([
      { organizationId: 'org-1', userId: 'user-1' },
      { organizationId: 'org-2', userId: 'user-3' },
    ]);
  });

  it('descoberta filtra linhas superadas no próprio where (mesma semântica de leitura do executor)', async () => {
    findMany.mockResolvedValue([]);
    await findTikTokPendingScopes(fakeClient);
    expect(findMany.mock.calls[0]?.[0]?.where).toMatchObject({
      kind: 'preference',
      memoryKey: 'pending:tiktok_posts',
      supersededAt: null,
    });
  });

  it('deduplica (org,user) repetido na varredura', async () => {
    findMany.mockResolvedValue([
      row('org-1', 'user-1', [item('a')]),
      row('org-1', 'user-1', [item('b')]),
    ]);
    const scopes = await findTikTokPendingScopes(fakeClient);
    expect(scopes).toEqual([{ organizationId: 'org-1', userId: 'user-1' }]);
  });

  it('propaga TaskQueueUnavailableError REAL (runner mapeia p/ queue_unavailable)', async () => {
    findMany.mockRejectedValue(new TaskQueueUnavailableError('fila fora'));
    await expect(findTikTokPendingScopes(fakeClient)).rejects.toBeInstanceOf(TaskQueueUnavailableError);
  });
});

describe('runTikTokCronForAll (agregação multi-tenant)', () => {
  it('sem pendência em lugar nenhum → ok sem nenhum tick (discovery só)', async () => {
    findMany.mockResolvedValue([row('org-1', 'user-1', [item('a', { status: 'published' })])]);

    const r = await runTikTokCronForAll(fakeClient, { now: () => new Date(NOW) });

    expect(r).toEqual({ ok: true, tenants: 0, published: 0, failed: 0, retried: 0, reasons: [] });
    expect(listPendingTikTokPosts).not.toHaveBeenCalled();
    expect(publishTikTokVideo).not.toHaveBeenCalled();
    expect(saveMemory).not.toHaveBeenCalled();
  });

  it('agrega sucesso em 2 tenants: 1 tick por escopo, cada um no próprio GUC scope', async () => {
    findMany.mockResolvedValue([
      row('org-1', 'user-1', [item('a')]),
      row('org-2', 'user-2', [item('b')]),
    ]);
    jest.mocked(listPendingTikTokPosts).mockImplementation(async (_client, scope) =>
      scope.userId === 'user-1' ? [item('a')] : [item('b')],
    );
    jest.mocked(resolveTenantTikTokAccess).mockResolvedValue(accessOk());
    jest.mocked(publishTikTokVideo).mockResolvedValue({ ok: true, publishId: 'pub-x' });

    const r = await runTikTokCronForAll(fakeClient, { now: () => new Date(NOW) });

    expect(r).toEqual({ ok: true, tenants: 2, published: 2, failed: 0, retried: 0, reasons: [] });
    // Cada tick roda no escopo (org,user) certo:
    expect(listPendingTikTokPosts).toHaveBeenNthCalledWith(1, fakeClient, { organizationId: 'org-1', userId: 'user-1' });
    expect(listPendingTikTokPosts).toHaveBeenNthCalledWith(2, fakeClient, { organizationId: 'org-2', userId: 'user-2' });
    // Cada tenant grava sua própria fila de volta:
    expect(saveMemory).toHaveBeenCalledTimes(2);
    expect(saveMemory).toHaveBeenCalledWith(
      fakeClient,
      { organizationId: 'org-1', userId: 'user-1' },
      'preference',
      'pending:tiktok_posts',
      [item('a', { status: 'published', publishId: 'pub-x' })],
    );
  });

  it('slice 3: falha terminal em 1 tenant NÃO bloqueia o outro (isolamento), ok=false + tag do tenant', async () => {
    findMany.mockResolvedValue([
      row('org-1', 'user-1', [item('a')]),
      row('org-2', 'user-2', [item('b')]),
    ]);
    jest.mocked(listPendingTikTokPosts).mockImplementation(async (_client, scope) =>
      scope.userId === 'user-1' ? [item('a')] : [item('b')],
    );
    jest.mocked(resolveTenantTikTokAccess).mockResolvedValue(accessOk());
    jest.mocked(publishTikTokVideo).mockImplementation(async (_access, spec) =>
      spec.videoUrl === 'https://cdn.example.com/a.mp4'
        ? { ok: false, error: 'http_error', errorDetail: 'HTTP 500' }
        : { ok: true, publishId: 'pub-b' },
    );

    const r = await runTikTokCronForAll(fakeClient, { now: () => new Date(NOW), maxAttempts: 1 });

    expect(r.ok).toBe(false);
    expect(r.error).toBe('tenant_failed');
    expect(r.tenants).toBe(2);
    expect(r.published).toBe(1);
    expect(r.failed).toBe(1);
    expect(r.retried).toBe(0);
    expect(r.reasons).toEqual([
      '(org-1/user-1) post a: http_error (HTTP 500) — tentativas esgotadas (1/1)',
    ]);
  });

  it('slice 3: acesso indisponível em 1 tenant preserva a intenção (sem save) e falha o cron; o outro segue publicando', async () => {
    findMany.mockResolvedValue([
      row('org-1', 'user-1', [item('a')]),
      row('org-2', 'user-2', [item('b')]),
    ]);
    jest.mocked(listPendingTikTokPosts).mockImplementation(async (_client, scope) =>
      scope.userId === 'user-1' ? [item('a')] : [item('b')],
    );
    jest.mocked(resolveTenantTikTokAccess).mockImplementation(async (_client, scope) =>
      scope.userId === 'user-1' ? { ok: false, reason: 'no_token' } : accessOk(),
    );
    jest.mocked(publishTikTokVideo).mockResolvedValue({ ok: true, publishId: 'pub-b' });

    const r = await runTikTokCronForAll(fakeClient, { now: () => new Date(NOW) });

    expect(r.ok).toBe(false);
    expect(r.error).toBe('tenant_failed');
    expect(r.published).toBe(1);
    expect(r.failed).toBe(0);
    expect(r.reasons).toEqual([
      '(org-1/user-1) TikTok indisponível (no_token) — 1 post(s) seguem pendentes',
    ]);
    // Intenção preservada: o tenant com no_token NÃO teve fila reescrita;
    // só o tenant saudável gravou:
    expect(saveMemory).toHaveBeenCalledTimes(1);
    expect(saveMemory).toHaveBeenLastCalledWith(
      fakeClient,
      { organizationId: 'org-2', userId: 'user-2' },
      'preference',
      'pending:tiktok_posts',
      expect.anything(),
    );
  });

  it('slice 3: `retried` (slice 2) NÃO zera o ok — 1ª falha reagenda e o cron segue verde', async () => {
    findMany.mockResolvedValue([row('org-1', 'user-1', [item('a')])]);
    jest.mocked(listPendingTikTokPosts).mockResolvedValue([item('a')]);
    jest.mocked(resolveTenantTikTokAccess).mockResolvedValue(accessOk());
    jest.mocked(publishTikTokVideo).mockResolvedValue({ ok: false, error: 'http_error', errorDetail: 'HTTP 500' });

    const r = await runTikTokCronForAll(fakeClient, { now: () => new Date(NOW), retryBaseDelayMs: 60_000 });

    expect(r.ok).toBe(true);
    expect(r.tenants).toBe(1);
    expect(r.published).toBe(0);
    expect(r.failed).toBe(0);
    expect(r.retried).toBe(1);
    expect(r.reasons).toEqual([
      `(org-1/user-1) post a: http_error (HTTP 500) — nova tentativa em ${new Date(NOW + 60_000).toISOString()} (tentativa 1/3)`,
    ]);
    // Item reagendado com backoff (5min→1min via opt) segue pendente:
    expect(saveMemory).toHaveBeenCalledWith(
      fakeClient,
      { organizationId: 'org-1', userId: 'user-1' },
      'preference',
      'pending:tiktok_posts',
      [
        {
          ...item('a'),
          status: 'pending',
          attempts: 1,
          scheduledAt: new Date(NOW + 60_000).toISOString(),
        },
      ],
    );
  });

  it('slice 3: discovery rejeitando (TaskQueueUnavailableError REAL) → queue_unavailable', async () => {
    findMany.mockRejectedValue(new TaskQueueUnavailableError('fila fora (cron)'));
    const r = await runTikTokCronForAll(fakeClient, { now: () => new Date(NOW) });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('queue_unavailable');
    expect(r.detail).toBe('fila fora (cron)');
    expect(r.tenants).toBe(0);
  });

  it('slice 3: discovery com erro genérico → list_failed (nunca lança)', async () => {
    findMany.mockRejectedValue(new Error('db caiu'));
    const r = await runTikTokCronForAll(fakeClient, { now: () => new Date(NOW) });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('list_failed');
    expect(r.detail).toBe('db caiu');
  });
});
