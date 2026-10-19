// FASE 4 · slice 1 — Testes do executor de agendamento de TikTok.
// - selectDuePosts: seleção pura (vencidos, status, ordenação, limit, input nulo).
// - runDueTikTokPosts: tick com dependências falsas (sem rede, sem banco).
// - projectPending: visão de UI (sem segredos, teto de 50).

import {
  selectDuePosts,
  runDueTikTokPosts,
  projectPending,
  type TickDeps,
} from './tiktokScheduler';
import { TaskQueueUnavailableError } from '@/lib/taskQueue';
import type { PendingTikTokPost } from '@/integrations/tiktok/tiktokPublisher';

const NOW = Date.parse('2026-10-19T12:00:00Z');

const post = (id: string, over: Partial<PendingTikTokPost> = {}): PendingTikTokPost => ({
  id,
  createdAt: '2026-10-19T08:00:00Z',
  scheduledAt: '2026-10-19T11:00:00Z',
  spec: { videoUrl: `https://cdn.example.com/${id}.mp4` },
  status: 'pending',
  ...over,
});

interface DepsCalls {
  publish: number;
  save: number;
  saved: PendingTikTokPost[][];
  publishSpecs: Array<{ id: string; url: string }>;
}

function makeDeps(list: PendingTikTokPost[], overrides: Partial<TickDeps> = {}): { deps: TickDeps; calls: DepsCalls } {
  const calls = {
    publish: 0,
    save: 0,
    saved: [] as PendingTikTokPost[][],
    publishSpecs: [] as Array<{ id: string; url: string }>,
  };
  const deps: TickDeps = {
    listPending: async () => list,
    savePending: async (items) => {
      calls.save += 1;
      calls.saved.push(items);
    },
    getAccess: async () => ({ ok: true as const, access: { accessToken: 'tk-live' }, hasClientKey: true, hasClientSecret: false }),
    publish: async (_access, spec) => {
      calls.publish += 1;
      calls.publishSpecs.push({ id: String((spec as { videoUrl?: string }).videoUrl ?? ''), url: spec.videoUrl ?? '' });
      return { ok: true, publishId: `pub_${calls.publish}` };
    },
    ...overrides,
  };
  return { deps, calls };
}

// ============================================================================
// selectDuePosts
// ============================================================================
describe('selectDuePosts', () => {
  it('lista vazia/nula → []', () => {
    expect(selectDuePosts([], NOW)).toEqual([]);
    expect(selectDuePosts(null, NOW)).toEqual([]);
    expect(selectDuePosts(undefined, NOW)).toEqual([]);
  });

  it('seleciona pendentes com prazo vencido; futuro e processados ficam de fora', () => {
    const list = [
      post('p1'), // vencido
      post('p2', { scheduledAt: '2026-10-19T13:00:00Z' }), // futuro
      post('p3', { status: 'published', publishId: 'x' }),
      post('p4', { status: 'failed' }),
      post('p5', { status: undefined, scheduledAt: '2026-10-19T10:00:00Z' }), // sem status = pendente
    ];
    expect(selectDuePosts(list, NOW).map((p) => p.id)).toEqual(['p5', 'p1']);
  });

  it('ignora scheduledAt inválida (não lança)', () => {
    const list = [post('bad', { scheduledAt: 'not-a-date' }), post('ok')];
    expect(selectDuePosts(list, NOW).map((p) => p.id)).toEqual(['ok']);
  });

  it('ordena do mais antigo e respeita limit', () => {
    const list = [
      post('a', { scheduledAt: '2026-10-19T11:50:00Z' }),
      post('b', { scheduledAt: '2026-10-19T09:00:00Z' }),
      post('c', { scheduledAt: '2026-10-19T10:00:00Z' }),
    ];
    expect(selectDuePosts(list, NOW, 2).map((p) => p.id)).toEqual(['b', 'c']);
  });

  it('não modifica a lista de entrada', () => {
    const list = [post('a'), post('b')];
    selectDuePosts(list, NOW, 1);
    expect(list.map((p) => p.id)).toEqual(['a', 'b']);
  });
});

// ============================================================================
// runDueTikTokPosts — tick
// ============================================================================
describe('runDueTikTokPosts', () => {
  it('sem vencidos → ok, due 0, sem publicar nem salvar', async () => {
    const list = [post('f', { scheduledAt: '2026-10-20T00:00:00Z' })];
    const { deps, calls } = makeDeps(list);
    const r = await runDueTikTokPosts(deps, { now: () => new Date(NOW) });
    expect(r).toEqual({ ok: true, due: 0, published: 0, failed: 0, reasons: [] });
    expect(calls.publish).toBe(0);
    expect(calls.save).toBe(0);
  });

  it('publica vencidos e marca published + publishId numa única gravação', async () => {
    const list = [post('a'), post('b')];
    const { deps, calls } = makeDeps(list);
    const r = await runDueTikTokPosts(deps, { now: () => new Date(NOW) });
    expect(r).toEqual({ ok: true, due: 2, published: 2, failed: 0, reasons: [] });
    expect(calls.save).toBe(1);
    const saved = calls.saved[0].map((p) => [p.id, p.status, p.publishId]);
    expect(saved).toContainEqual(['a', 'published', 'pub_1']);
    expect(saved).toContainEqual(['b', 'published', 'pub_2']);
  });

  it('falha de publicação marca failed + motivo (sem segredo), ok=false', async () => {
    const list = [post('a'), post('b')];
    const { deps, calls } = makeDeps(list, {
      publish: async (_access, spec) => {
        calls.publish += 1;
        if (spec.videoUrl === 'https://cdn.example.com/a.mp4') return { ok: false, error: 'http_error', errorDetail: 'HTTP 500' };
        return { ok: true, publishId: `pub_${calls.publish}` };
      },
    });
    const r = await runDueTikTokPosts(deps, { now: () => new Date(NOW) });
    expect(r.ok).toBe(false);
    expect(r.failed).toBe(1);
    expect(r.published).toBe(1);
    expect(r.reasons).toHaveLength(1);
    expect(r.reasons[0]).toContain('post a: http_error');
    const saved = calls.saved[0].map((p) => [p.id, p.status]);
    expect(saved).toContainEqual(['a', 'failed']);
    expect(saved).toContainEqual(['b', 'published']);
  });

  it('acesso indisponível → itens permanecem pendentes (sem salvar), com motivo', async () => {
    const list = [post('a')];
    const { deps, calls } = makeDeps(list, {
      getAccess: async () => ({ ok: false, reason: 'no_token' }),
    });
    const r = await runDueTikTokPosts(deps, { now: () => new Date(NOW) });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('no_token');
    expect(r.due).toBe(1);
    expect(r.reasons[0]).toContain('no_token');
    expect(calls.publish).toBe(0);
    expect(calls.save).toBe(0); // intenção preservada
  });

  it('fila ausente (TaskQueueUnavailableError na leitura) → queue_unavailable, sem lançar', async () => {
    const { deps } = makeDeps([], {
      listPending: async () => {
        throw new TaskQueueUnavailableError('fila indisponível (teste)');
      },
    });
    const r = await runDueTikTokPosts(deps, { now: () => new Date(NOW) });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('queue_unavailable');
  });

  it('limit confina o tick (sobreviventes continuam pendentes)', async () => {
    const list = [post('a'), post('b'), post('c')];
    const { deps, calls } = makeDeps(list);
    const r = await runDueTikTokPosts(deps, { now: () => new Date(NOW), limit: 2 });
    expect(r.due).toBe(2);
    expect(r.published).toBe(2);
    const statuses = calls.saved[0].map((p) => p.status);
    expect(statuses.filter((s) => s === 'published')).toHaveLength(2);
    expect(statuses.filter((s) => s === 'pending')).toHaveLength(1);
  });

  it('falha ao salvar após publicar → reporta save_failed preservando contagens', async () => {
    const list = [post('a')];
    const { deps } = makeDeps(list, {
      savePending: async () => {
        throw new Error('disk full');
      },
    });
    const r = await runDueTikTokPosts(deps, { now: () => new Date(NOW) });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('save_failed');
    expect(r.published).toBe(1);
  });

  it('savePending com TaskQueueUnavailableError → queue_unavailable', async () => {
    const list = [post('a')];
    const { deps } = makeDeps(list, {
      savePending: async () => {
        throw new TaskQueueUnavailableError('indisponível');
      },
    });
    const r = await runDueTikTokPosts(deps, { now: () => new Date(NOW) });
    expect(r.error).toBe('queue_unavailable');
  });
});

// ============================================================================
// projectPending — visão de UI
// ============================================================================
describe('projectPending', () => {
  it('projeta campos públicos (sem segredos) e respeita teto de 50', () => {
    const many = Array.from({ length: 60 }, (_, i) => post(`p${i}`));
    const view = projectPending(many);
    expect(view).toHaveLength(50);
    expect(view[0]).toEqual({
      id: 'p10',
      scheduledAt: '2026-10-19T11:00:00Z',
      status: 'pending',
      videoUrl: 'https://cdn.example.com/p10.mp4',
    });
  });

  it('null → []', () => {
    expect(projectPending(null)).toEqual([]);
  });

  it('status ausente vira pending na projeção', () => {
    const view = projectPending([post('x', { status: undefined })]);
    expect(view[0].status).toBe('pending');
  });
});
