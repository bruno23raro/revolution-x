// FASE 4 · slice 2 — Teste de FLUXO PRINCIPAL (fronteira do adaptador).
//
// O teste de unidade (tiktokScheduler.test.ts) injeta fakes em `TickDeps` e
// cobre o núcleo; este exercita o caminho REAL `bindTikTokSchedulerDeps` —
// adaptador AgentMemory → núcleo — isolando APENAS as fronteiras de módulo
// (resolveAccess / taskQueue / publish), com a `markPendingTikTokPost` REAL
// (módulo puro, zero imports). Comprova o wiring exato: mesmo client/scope,
// mesmo kind `'preference'`, mesma key `pending:tiktok_posts`, e o retry c/
// backoff do slice 2 gravando de volta a fila com `attempts`/`scheduledAt`.

import { PrismaClient } from '@prisma/client';
import { bindTikTokSchedulerDeps, listPendingTikTokView, runDueTikTokPosts } from './tiktokScheduler';
import { PENDING_KEY, listPendingTikTokPosts, resolveTenantTikTokAccess } from '@/integrations/tiktok/resolveAccess';
import { saveMemory, TaskQueueUnavailableError } from '@/lib/taskQueue';
import type { OrgScope } from '@/lib/taskQueue';
import { publishTikTokVideo } from '@/integrations/tiktok/tiktokPublisher';
import type { PendingTikTokPost } from '@/integrations/tiktok/tiktokPublisher';

jest.mock('@/integrations/tiktok/resolveAccess', () => ({
  PENDING_KEY: 'pending:tiktok_posts',
  listPendingTikTokPosts: jest.fn(),
  resolveTenantTikTokAccess: jest.fn(),
}));

// taskQueue carrega @prisma/client + ./prisma (rede/banco) → mockamos só as
// fronteiras usadas; `TaskQueueUnavailableError` fica REAL p/ `instanceof`
// do scheduler bater de verdade.
jest.mock('@/lib/taskQueue', () => ({
  saveMemory: jest.fn(),
  TaskQueueUnavailableError: jest.requireActual('@/lib/taskQueue').TaskQueueUnavailableError,
}));

// tiktokPublisher é puro (zero imports): `markPendingTikTokPost` REAL;
// `publishTikTokVideo` mockado (a API TikTok de verdade não entra no teste).
jest.mock('@/integrations/tiktok/tiktokPublisher', () => ({
  publishTikTokVideo: jest.fn(),
  markPendingTikTokPost: jest.requireActual('@/integrations/tiktok/tiktokPublisher').markPendingTikTokPost,
}));

const NOW = Date.parse('2026-10-19T12:00:00Z');

const fakeClient = { __fake: 'client' } as unknown as PrismaClient;
const scope: OrgScope = { organizationId: 'org-1', userId: 'user-1' };

const item = (over: Partial<PendingTikTokPost> = {}): PendingTikTokPost => ({
  id: 'fl-1',
  createdAt: '2026-10-19T08:00:00Z',
  scheduledAt: '2026-10-19T11:00:00Z',
  spec: { videoUrl: 'https://cdn.example.com/fl1.mp4' },
  status: 'pending',
  ...over,
});

beforeEach(() => {
  jest.mocked(listPendingTikTokPosts).mockReset();
  jest.mocked(resolveTenantTikTokAccess).mockReset();
  jest.mocked(saveMemory).mockReset();
  jest.mocked(publishTikTokVideo).mockReset();
});

describe('fluxo principal (adaptador → executor)', () => {
  it('leitura → acesso → publicação → gravação de volta, com wiring exato do tenant', async () => {
    jest.mocked(listPendingTikTokPosts).mockResolvedValue([item()]);
    jest.mocked(resolveTenantTikTokAccess).mockResolvedValue({
      ok: true,
      access: { accessToken: 'tk-live' },
      hasClientKey: true,
      hasClientSecret: false,
      oauth: null,
      tokenExpired: false,
    });
    jest.mocked(publishTikTokVideo).mockResolvedValue({ ok: true, publishId: 'pub-1' });

    const r = await runDueTikTokPosts(bindTikTokSchedulerDeps(fakeClient, scope), { now: () => new Date(NOW) });

    expect(r).toEqual({ ok: true, due: 1, published: 1, failed: 0, retried: 0, reasons: [] });
    expect(listPendingTikTokPosts).toHaveBeenCalledWith(fakeClient, scope);
    expect(resolveTenantTikTokAccess).toHaveBeenCalledWith(fakeClient, scope);
    expect(publishTikTokVideo).toHaveBeenCalledWith(
      { accessToken: 'tk-live' },
      { videoUrl: 'https://cdn.example.com/fl1.mp4' },
    );
    // Uma única gravação, no MESMO backend (kind 'preference', key estável):
    expect(saveMemory).toHaveBeenCalledTimes(1);
    expect(saveMemory).toHaveBeenCalledWith(
      fakeClient,
      scope,
      'preference',
      PENDING_KEY,
      [{ ...item(), status: 'published', publishId: 'pub-1' }],
    );
    expect(PENDING_KEY).toBe('pending:tiktok_posts');
  });

  it('slice 2: falha → saveMemory recebe a fila com o item REAGENDADO (attempts/scheduledAt)', async () => {
    jest.mocked(listPendingTikTokPosts).mockResolvedValue([item()]);
    jest.mocked(resolveTenantTikTokAccess).mockResolvedValue({
      ok: true,
      access: { accessToken: 'tk-live' },
      hasClientKey: true,
      hasClientSecret: false,
      oauth: null,
      tokenExpired: false,
    });
    jest.mocked(publishTikTokVideo).mockResolvedValue({ ok: false, error: 'http_error', errorDetail: 'HTTP 500' });

    const r = await runDueTikTokPosts(bindTikTokSchedulerDeps(fakeClient, scope), { now: () => new Date(NOW) });

    expect(r).toEqual({
      ok: true,
      due: 1,
      published: 0,
      failed: 0,
      retried: 1,
      reasons: [expect.stringContaining('tentativa 1/3')],
    });
    expect(saveMemory).toHaveBeenCalledWith(
      fakeClient,
      scope,
      'preference',
      PENDING_KEY,
      [
        {
          ...item(),
          status: 'pending',
          attempts: 1,
          scheduledAt: new Date(NOW + 5 * 60 * 1000).toISOString(),
        },
      ],
    );
  });

  it('saveMemory lançando TaskQueueUnavailableError REAL → queue_unavailable (instanceof preservado)', async () => {
    jest.mocked(listPendingTikTokPosts).mockResolvedValue([item()]);
    jest.mocked(resolveTenantTikTokAccess).mockResolvedValue({
      ok: true,
      access: { accessToken: 'tk-live' },
      hasClientKey: true,
      hasClientSecret: false,
      oauth: null,
      tokenExpired: false,
    });
    jest.mocked(publishTikTokVideo).mockResolvedValue({ ok: true, publishId: 'pub-1' });
    jest.mocked(saveMemory).mockRejectedValue(new TaskQueueUnavailableError('fila fora (teste)'));

    const r = await runDueTikTokPosts(bindTikTokSchedulerDeps(fakeClient, scope), { now: () => new Date(NOW) });

    expect(r.ok).toBe(false);
    expect(r.error).toBe('queue_unavailable');
    expect(r.detail).toBe('fila fora (teste)');
    // O item foi publicado antes da gravação falhar — estado parcial, honesto:
    expect(r.published).toBe(1);
  });
});

describe('multicontas (item.account roteia a credencial)', () => {
  it('item c/ account → getAccess(account) resolve a conta certa e publica com O token dela', async () => {
    // Preflight (2-arg, conta padrão) vs item.account (3-arg) — o adaptador
    // injeta `resolveTenantTikTokAccess(client, scope, account)` só quando o
    // item traz `account`; então publicamos com a credencial da conta pedida.
    jest.mocked(listPendingTikTokPosts).mockResolvedValue([
      item({ id: 'fl-a', account: 'OID_A' }),
      item({ id: 'fl-default' }),
    ]);
    jest.mocked(resolveTenantTikTokAccess).mockImplementation(async (_client, _scope, account) => {
      // 3-arg com `account` → conta específica; 2-arg (preflight) → padrão.
      if (account) {
        return {
          ok: true,
          access: { accessToken: `tk-${account}` },
          hasClientKey: true,
          hasClientSecret: false,
          oauth: null,
          tokenExpired: false,
          selectedAccount: { openId: account, source: 'oauth' },
          accountCount: 2,
        };
      }
      return {
        ok: true,
        access: { accessToken: 'tk-default' },
        hasClientKey: true,
        hasClientSecret: false,
        oauth: null,
        tokenExpired: false,
      };
    });
    jest.mocked(publishTikTokVideo).mockImplementation(async (access, _spec) => ({
      ok: true,
      publishId: `pub-${access.accessToken}`,
    }));

    const r = await runDueTikTokPosts(bindTikTokSchedulerDeps(fakeClient, scope), {
      now: () => new Date(NOW),
    });

    expect(r).toEqual({ ok: true, due: 2, published: 2, failed: 0, retried: 0, reasons: [] });
    // O item com account usou a credencial da conta (3-arg), o outro o padrão.
    expect(publishTikTokVideo).toHaveBeenCalledWith(
      { accessToken: 'tk-OID_A' },
      expect.objectContaining({ videoUrl: expect.any(String) }),
    );
    expect(resolveTenantTikTokAccess).toHaveBeenCalledWith(fakeClient, scope, 'OID_A');
  });

  it('item c/ account que FALHOU no resolver → segue retry/backoff, preserva os demais', async () => {
    jest.mocked(listPendingTikTokPosts).mockResolvedValue([item({ id: 'fl-x', account: 'OID_X' })]);
    // Preflight ok; conta OID_X não existe (account_not_found).
    jest.mocked(resolveTenantTikTokAccess).mockImplementation(async (_client, _scope, account) => {
      if (account) return { ok: false, reason: 'account_not_found' };
      return {
        ok: true,
        access: { accessToken: 'tk-default' },
        hasClientKey: true,
        hasClientSecret: false,
        oauth: null,
        tokenExpired: false,
      };
    });

    const r = await runDueTikTokPosts(bindTikTokSchedulerDeps(fakeClient, scope), {
      now: () => new Date(NOW),
    });

    expect(r).toMatchObject({ ok: true, due: 1, published: 0, failed: 0, retried: 1 });
    expect(r.reasons[0]).toContain('OID_X');
    expect(saveMemory).toHaveBeenCalledWith(
      fakeClient,
      scope,
      'preference',
      PENDING_KEY,
      expect.arrayContaining([
        expect.objectContaining({ id: 'fl-x', status: 'pending', attempts: 1 }),
      ]),
    );
  });
});

describe('listPendingTikTokView (projeção real p/ UI)', () => {
  it('projeta a fila (c/ `attempts`) sem segredos', async () => {
    jest.mocked(listPendingTikTokPosts).mockResolvedValue([item({ attempts: 2 })]);
    const v = await listPendingTikTokView(fakeClient, scope);
    expect(v).toEqual([
      {
        id: 'fl-1',
        scheduledAt: '2026-10-19T11:00:00Z',
        status: 'pending',
        videoUrl: 'https://cdn.example.com/fl1.mp4',
        attempts: 2,
      },
    ]);
  });

  it('propaga TaskQueueUnavailableError REAL (rota mapeia p/ 503)', async () => {
    jest.mocked(listPendingTikTokPosts).mockRejectedValue(new TaskQueueUnavailableError('tabela ausente'));
    await expect(listPendingTikTokView(fakeClient, scope)).rejects.toBeInstanceOf(TaskQueueUnavailableError);
  });
});
