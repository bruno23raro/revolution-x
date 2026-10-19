// FASE 4 · slice 1+2 — Testes do executor de agendamento de TikTok.
// - selectDuePosts: seleção pura (vencidos, status, ordenação, limit, input nulo).
// - runDueTikTokPosts: tick com dependências falsas (sem rede, sem banco).
// - slice 2: retry c/ backoff exponencial (attempts, retried, reschedule, terminal).
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
    expect(r).toEqual({ ok: true, due: 0, published: 0, failed: 0, retried: 0, reasons: [] });
    expect(calls.publish).toBe(0);
    expect(calls.save).toBe(0);
  });

  it('publica vencidos e marca published + publishId numa única gravação', async () => {
    const list = [post('a'), post('b')];
    const { deps, calls } = makeDeps(list);
    const r = await runDueTikTokPosts(deps, { now: () => new Date(NOW) });
    expect(r).toEqual({ ok: true, due: 2, published: 2, failed: 0, retried: 0, reasons: [] });
    expect(calls.save).toBe(1);
    const saved = calls.saved[0].map((p) => [p.id, p.status, p.publishId]);
    expect(saved).toContainEqual(['a', 'published', 'pub_1']);
    expect(saved).toContainEqual(['b', 'published', 'pub_2']);
  });

  it('slice 2: falha (1ª tentativa) reagenda c/ backoff — continua pending, attempts=1, ok=true', async () => {
    const list = [post('a'), post('b')];
    const { deps, calls } = makeDeps(list, {
      publish: async (_access, spec) => {
        calls.publish += 1;
        if (spec.videoUrl === 'https://cdn.example.com/a.mp4') return { ok: false, error: 'http_error', errorDetail: 'HTTP 500' };
        return { ok: true, publishId: `pub_${calls.publish}` };
      },
    });
    const r = await runDueTikTokPosts(deps, { now: () => new Date(NOW) });
    expect(r.ok).toBe(true); // nada terminal ainda
    expect(r.due).toBe(2);
    expect(r.published).toBe(1);
    expect(r.failed).toBe(0);
    expect(r.retried).toBe(1);
    expect(r.reasons).toHaveLength(1);
    expect(r.reasons[0]).toContain('post a: http_error');
    expect(r.reasons[0]).toContain('tentativa 1/3');
    const savedA = calls.saved[0].find((p) => p.id === 'a');
    expect(savedA).toEqual({
      id: 'a',
      createdAt: '2026-10-19T08:00:00Z',
      scheduledAt: new Date(NOW + 5 * 60 * 1000).toISOString(),
      spec: { videoUrl: 'https://cdn.example.com/a.mp4' },
      status: 'pending',
      attempts: 1,
    });
    expect(calls.saved[0].find((p) => p.id === 'b')?.status).toBe('published');
  });

  it('slice 2: falha quando attempts esgotam → failed terminal, contador preservado, ok=false', async () => {
    const list = [post('a', { attempts: 2 })]; // padrão maxAttempts=3 → esta falha é a última
    const { deps, calls } = makeDeps(list, {
      publish: async () => {
        calls.publish += 1;
        return { ok: false, error: 'http_error', errorDetail: 'HTTP 429' };
      },
    });
    const r = await runDueTikTokPosts(deps, { now: () => new Date(NOW) });
    expect(r.ok).toBe(false);
    expect(r.failed).toBe(1);
    expect(r.retried).toBe(0);
    expect(r.reasons[0]).toContain('post a: http_error');
    expect(r.reasons[0]).toContain('tentativas esgotadas (3/3)');
    expect(calls.saved[0][0]).toEqual({
      id: 'a',
      createdAt: '2026-10-19T08:00:00Z',
      scheduledAt: '2026-10-19T11:00:00Z',
      spec: { videoUrl: 'https://cdn.example.com/a.mp4' },
      status: 'failed',
      attempts: 3,
    });
  });

  it('slice 2: maxAttempts=1 → a 1ª falha já é terminal failed', async () => {
    const list = [post('a')];
    const { deps } = makeDeps(list, {
      publish: async () => ({ ok: false, error: 'http_error' }),
    });
    const r = await runDueTikTokPosts(deps, { now: () => new Date(NOW), maxAttempts: 1 });
    expect(r.ok).toBe(false);
    expect(r.failed).toBe(1);
    expect(r.retried).toBe(0);
    expect(r.reasons[0]).toContain('esgotadas (1/1)');
  });

  it('slice 2: backoff exponencial respeita retryBaseDelayMs (2ª tentativa → base*2)', async () => {
    const list = [post('a', { attempts: 1 })];
    const { deps, calls } = makeDeps(list, {
      publish: async () => ({ ok: false, error: 'http_error' }),
    });
    const r = await runDueTikTokPosts(deps, { now: () => new Date(NOW), retryBaseDelayMs: 60_000 });
    expect(r.retried).toBe(1);
    const saved = calls.saved[0][0];
    expect(saved.attempts).toBe(2);
    expect(saved.scheduledAt).toBe(new Date(NOW + 120_000).toISOString());
  });

  it('slice 2: republish bem-sucedido após retry → published, contador preservado', async () => {
    const list = [post('a', { attempts: 1 })];
    const { deps, calls } = makeDeps(list);
    const r = await runDueTikTokPosts(deps, { now: () => new Date(NOW) });
    expect(r.ok).toBe(true);
    expect(r.published).toBe(1);
    expect(r.retried).toBe(0);
    expect(calls.saved[0][0]).toMatchObject({ status: 'published', publishId: 'pub_1', attempts: 1 });
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

  it('slice 2: projeta `attempts` quando presente (visível na UI)', () => {
    const view = projectPending([post('r', { attempts: 2, status: 'pending' })]);
    expect(view[0].attempts).toBe(2);
  });
});
