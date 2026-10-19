// FASE 4 · slice 3 — Teste da rota de gatilho do cron (POST /api/cron/tiktok).
//
// Isola as duas fronteiras — `@/lib/prisma` (client fake) e o próprio
// runner (mockado) — e manipula a env `CRON_SECRET` do processo:
//  • env ausente → 503 `cron_not_configured` (degradação honesta, runner nem roda);
//  • segredo divergente/ausente no header → 401 (comparação em tempo constante);
//  • segredo certo → 200 com a agregação; `queue_unavailable` → 503;
//    `list_failed` → 500; runner lançando (defensivo) → 500 `tick_failed`.

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runTikTokCronForAll } from '@/jobs/tiktokScheduler';
import { GET, POST } from './route';

jest.mock('@/lib/prisma', () => ({
  prisma: { __fake: 'prisma' },
}));

jest.mock('@/jobs/tiktokScheduler', () => ({
  runTikTokCronForAll: jest.fn(),
}));

const runner = jest.mocked(runTikTokCronForAll);
const fakePrisma = prisma as unknown as { __fake: string };

const post = (headers: Record<string, string> = {}) =>
  new NextRequest('http://localhost/api/cron/tiktok', { method: 'POST', headers });

beforeEach(() => {
  delete process.env.CRON_SECRET;
  runner.mockReset();
});

describe('gating do segredo', () => {
  it('CRON_SECRET ausente → 503 cron_not_configured (runner NUNCA é chamado)', async () => {
    const res = await POST(post({ 'x-cron-secret': 'qualquer' }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      ok: false,
      error: 'cron_not_configured',
      detail: 'CRON_SECRET ausente no ambiente',
    });
    expect(runner).not.toHaveBeenCalled();
  });

  it('CRON_SECRET vazia (string nula) → 503 cron_not_configured', async () => {
    process.env.CRON_SECRET = '';
    const res = await POST(post({ 'x-cron-secret': '' }));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: 'cron_not_configured' });
    expect(runner).not.toHaveBeenCalled();
  });

  it('segredo configurado, header ausente → 401', async () => {
    process.env.CRON_SECRET = 'segredo-teste-42';
    const res = await POST(post());
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ ok: false, error: 'unauthorized' });
    expect(runner).not.toHaveBeenCalled();
  });

  it('segredo divergente → 401 (mesmo código de erro p/ ausente/divergente — sem oracle)', async () => {
    process.env.CRON_SECRET = 'segredo-teste-42';
    const res = await POST(post({ 'x-cron-secret': 'outro-segredo' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ ok: false, error: 'unauthorized' });
    expect(runner).not.toHaveBeenCalled();
  });
});

describe('execução do runner', () => {
  it('segredo certo → 200 com a agregação e runner chamado com o prisma real', async () => {
    process.env.CRON_SECRET = 'segredo-teste-42';
    runner.mockResolvedValue({
      ok: true,
      tenants: 2,
      published: 2,
      failed: 0,
      retried: 0,
      reasons: [],
    });

    const res = await POST(post({ 'x-cron-secret': 'segredo-teste-42' }));

    expect(runner).toHaveBeenCalledWith(fakePrisma);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      tenants: 2,
      published: 2,
      failed: 0,
      retried: 0,
      reasons: [],
      error: undefined,
    });
  });

  it('tenant falhou (200: o cron executou, a agregação diz a verdade)', async () => {
    process.env.CRON_SECRET = 'segredo-teste-42';
    runner.mockResolvedValue({
      ok: false,
      tenants: 1,
      published: 0,
      failed: 1,
      retried: 0,
      reasons: ['(org-1/user-1) post a: http_error — tentativas esgotadas (3/3)'],
      error: 'tenant_failed',
    });

    const res = await POST(post({ 'x-cron-secret': 'segredo-teste-42' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: false, error: 'tenant_failed', failed: 1 });
  });

  it('fila fora (queue_unavailable) → 503', async () => {
    process.env.CRON_SECRET = 'segredo-teste-42';
    runner.mockResolvedValue({
      ok: false,
      tenants: 0,
      published: 0,
      failed: 0,
      retried: 0,
      reasons: [],
      error: 'queue_unavailable',
      detail: 'tabela ausente',
    });

    const res = await POST(post({ 'x-cron-secret': 'segredo-teste-42' }));

    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, error: 'queue_unavailable', detail: 'tabela ausente' });
  });

  it('list_failed → 500', async () => {
    process.env.CRON_SECRET = 'segredo-teste-42';
    runner.mockResolvedValue({
      ok: false,
      tenants: 0,
      published: 0,
      failed: 0,
      retried: 0,
      reasons: [],
      error: 'list_failed',
      detail: 'db caiu',
    });

    const res = await POST(post({ 'x-cron-secret': 'segredo-teste-42' }));

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ ok: false, error: 'list_failed', detail: 'db caiu' });
  });

  it('runner lançando (defensivo) → 500 tick_failed', async () => {
    process.env.CRON_SECRET = 'segredo-teste-42';
    runner.mockRejectedValue(new Error('algo imprevisível'));

    const res = await POST(post({ 'x-cron-secret': 'segredo-teste-42' }));

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ ok: false, error: 'tick_failed', detail: 'algo imprevisível' });
  });
});

describe('método', () => {
  it('GET → 405 method_not_allowed (gatilho é POST)', async () => {
    const res = await GET();
    expect(res.status).toBe(405);
    expect(await res.json()).toMatchObject({ ok: false, error: 'method_not_allowed' });
  });
});
