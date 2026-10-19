// app/api/tiktok/tick/route.test.ts
// FASE 4 · slice 1 — rota do tick do agendador de TikTok.
//
// Mocks de fronteira (estilo da casa): auth, prisma e o próprio scheduler
// ficam mockados; `TaskQueueUnavailableError` é REAL (vindo de
// @/lib/taskQueue) para a checagem `instanceof` da rota ser de verdade.

jest.mock('@/lib/auth', () => ({
  getAuthenticatedUser: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: { __mock: true },
}));

jest.mock('@/jobs/tiktokScheduler', () => ({
  bindTikTokSchedulerDeps: jest.fn(),
  listPendingTikTokView: jest.fn(),
  runDueTikTokPosts: jest.fn(),
}));

const { getAuthenticatedUser } = require('@/lib/auth');
const { prisma } = require('@/lib/prisma');
const {
  bindTikTokSchedulerDeps,
  listPendingTikTokView,
  runDueTikTokPosts,
} = require('@/jobs/tiktokScheduler');
const { TaskQueueUnavailableError } = require('@/lib/taskQueue');
const { POST, GET } = require('./route');

function buildReq() {
  const { NextRequest } = require('next/server');
  return new NextRequest('http://localhost/api/tiktok/tick');
}

function mockUser() {
  (getAuthenticatedUser as jest.Mock).mockResolvedValue({
    id: 'user-1',
    organizationId: 'org-1',
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (bindTikTokSchedulerDeps as jest.Mock).mockReturnValue({});
});

// ============================================================================
// POST — tick
// ============================================================================
describe('POST /api/tiktok/tick', () => {
  it('401 sem sessão', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(null);
    const res = await POST(buildReq());
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('Unauthorized');
    expect(runDueTikTokPosts).not.toHaveBeenCalled();
  });

  it('200: tick ok (sem vencidos) → corpo do resultado, escopo correto', async () => {
    mockUser();
    (runDueTikTokPosts as jest.Mock).mockResolvedValue({
      ok: true,
      due: 0,
      published: 0,
      failed: 0,
      reasons: [],
    });

    const res = await POST(buildReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.due).toBe(0);
    expect(bindTikTokSchedulerDeps).toHaveBeenCalledWith(prisma, {
      organizationId: 'org-1',
      userId: 'user-1',
    });
  });

  it('200: tick com falha (publicação failed) → 200 honesto com ok=false', async () => {
    mockUser();
    (runDueTikTokPosts as jest.Mock).mockResolvedValue({
      ok: false,
      due: 1,
      published: 0,
      failed: 1,
      reasons: ['post p1: http_error (HTTP 500)'],
    });

    const res = await POST(buildReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.failed).toBe(1);
    expect(body.reasons[0]).toContain('post p1');
  });

  it('503 quando a fila não está disponível (queue_unavailable)', async () => {
    mockUser();
    (runDueTikTokPosts as jest.Mock).mockResolvedValue({
      ok: false,
      due: 0,
      published: 0,
      failed: 0,
      reasons: [],
      error: 'queue_unavailable',
      detail: 'fila indisponível',
    });

    const res = await POST(buildReq());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe('queue_unavailable');
  });
});

// ============================================================================
// GET — fila pendente (projeção p/ UI)
// ============================================================================
describe('GET /api/tiktok/tick', () => {
  it('401 sem sessão', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(null);
    const res = await GET(buildReq());
    expect(res.status).toBe(401);
    expect(listPendingTikTokView).not.toHaveBeenCalled();
  });

  it('200: fila projetada, sem segredos', async () => {
    mockUser();
    (listPendingTikTokView as jest.Mock).mockResolvedValue([
      {
        id: 'p1',
        scheduledAt: '2026-10-19T11:00:00Z',
        status: 'pending',
        videoUrl: 'https://cdn.example.com/p1.mp4',
      },
    ]);

    const res = await GET(buildReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.pending).toHaveLength(1);
    expect(body.pending[0].id).toBe('p1');
    expect(listPendingTikTokView).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ organizationId: 'org-1', userId: 'user-1' }),
    );
  });

  it('503 quando a fila lança TaskQueueUnavailableError', async () => {
    mockUser();
    (listPendingTikTokView as jest.Mock).mockImplementation(() => {
      throw new TaskQueueUnavailableError('tabela ausente');
    });

    const res = await GET(buildReq());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.detail).toContain('tabela ausente');
  });
});
