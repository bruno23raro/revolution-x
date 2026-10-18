// FASE 2 · slice 3 — Testes do serviço TikTok (Content Posting API oficial).
// Mesma filosofia da IG/FB: fetch injetado, sem rede, comportamento honesto.

import {
  publishTikTokVideo,
  getTikTokPostStatus,
  getTikTokVideoAnalytics,
  appendPendingTikTokPost,
  markPendingTikTokPost,
  TIKTOK_PRIVACY_LEVELS,
  type TikTokAccess,
  type PendingTikTokPost,
} from './tiktokPublisher';

const access: TikTokAccess = { accessToken: 'tt-token' };

interface FakeFetch {
  fetchImpl: typeof fetch;
  calls: Array<{ url: string; init?: RequestInit }>;
}

function makeFetch(handler: (url: string, init?: RequestInit) => Response): FakeFetch {
  const calls: FakeFetch['calls'] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return handler(url, init);
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('publishTikTokVideo', () => {
  it('publica agora e devolve o publish_id', async () => {
    const { fetchImpl, calls } = makeFetch(() =>
      okJson({ error: { code: 'ok', message: '' }, data: { publish_id: '734123' } }),
    );
    const res = await publishTikTokVideo(access, { videoUrl: 'https://cdn.x/v.mp4', caption: 'oi' }, { fetchImpl });
    expect(res).toEqual({ ok: true, publishId: '734123' });
    expect(calls[0].url).toBe('https://open.tiktokapis.com/v2/post/publish/video/init/');
    expect(calls[0].init!.method).toBe('POST');
    const body = JSON.parse(calls[0].init!.body as string);
    expect(body.source_info).toEqual({ source: 'PULL_FROM_URL', video_url: 'https://cdn.x/v.mp4' });
    expect(body.post_info.privacy_level).toBe('PUBLIC_TO_EVERYONE');
    expect(body.post_info.title).toBe('oi');
  });

  it('envia os flags opcionais quando presentes', async () => {
    const { fetchImpl, calls } = makeFetch(() =>
      okJson({ error: { code: 'ok' }, data: { publish_id: 'p' } }),
    );
    await publishTikTokVideo(
      access,
      {
        videoUrl: 'https://cdn.x/v.mp4',
        privacyLevel: 'SELF_ONLY',
        disableComment: true,
        aigc: true,
        brandContent: true,
        videoCoverTimestampMs: 1200,
      },
      { fetchImpl },
    );
    const body = JSON.parse(calls[0].init!.body as string);
    expect(body.post_info.privacy_level).toBe('SELF_ONLY');
    expect(body.post_info.disable_comment).toBe(true);
    expect(body.post_info.is_aigc).toBe(true);
    expect(body.post_info.brand_content_toggle).toBe(true);
    expect(body.post_info.video_cover_timestamp_ms).toBe(1200);
  });

  it('reporta no_video_source sem chamar fetch', async () => {
    const { fetchImpl, calls } = makeFetch(() => okJson({}));
    const res = await publishTikTokVideo(access, {}, { fetchImpl });
    expect(res).toEqual({ ok: false, error: 'no_video_source' });
    expect(calls.length).toBe(0);
  });

  it('reporta tiktok_not_configured quando falta token', async () => {
    const res = await publishTikTokVideo({ accessToken: '' }, { videoUrl: 'https://x' }, {
      fetchImpl: makeFetch(() => okJson({})).fetchImpl,
    });
    expect(res).toEqual({ ok: false, error: 'tiktok_not_configured' });
  });

  it('reporta fetch_unavailable quando não há fetch', async () => {
    const realFetch = (globalThis as { fetch?: unknown }).fetch;
    (globalThis as { fetch?: unknown }).fetch = undefined;
    try {
      const res = await publishTikTokVideo(access, { videoUrl: 'https://x' });
      expect(res).toEqual({ ok: false, error: 'fetch_unavailable' });
    } finally {
      (globalThis as { fetch?: unknown }).fetch = realFetch;
    }
  });

  it('mapeia resposta não-ok para http_error com detalhe', async () => {
    const { fetchImpl } = makeFetch(() =>
      new Response(JSON.stringify({ error: { code: 'permission_error', message: 'no access' } }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const res = await publishTikTokVideo(access, { videoUrl: 'https://x' }, { fetchImpl });
    expect(res).toMatchObject({ ok: false, error: 'http_error' });
    expect(res.errorDetail).toContain('no access');
  });

  it('mapeia falha de rede para network_error', async () => {
    const { fetchImpl } = makeFetch(() => {
      throw new Error('boom');
    });
    const res = await publishTikTokVideo(access, { videoUrl: 'https://x' }, { fetchImpl });
    expect(res).toMatchObject({ ok: false, error: 'network_error', errorDetail: 'boom' });
  });
});

describe('getTikTokPostStatus', () => {
  it('devolve o status de um publish_id', async () => {
    const { fetchImpl, calls } = makeFetch(() =>
      okJson({ error: { code: 'ok' }, data: { status: 'PUBLISHED' } }),
    );
    const res = await getTikTokPostStatus(access, '734123', { fetchImpl });
    expect(res).toEqual({ ok: true, publishId: '734123', status: 'PUBLISHED' });
    expect(calls[0].url).toBe('https://open.tiktokapis.com/v2/post/publish/status/fetch/');
    expect(JSON.parse(calls[0].init!.body as string)).toEqual({ publish_id: '734123' });
  });

  it('mapeia erro HTTP', async () => {
    const { fetchImpl } = makeFetch(() =>
      new Response(JSON.stringify({ error: { code: 'unknown_publish_id' } }), { status: 404 }),
    );
    const res = await getTikTokPostStatus(access, 'x', { fetchImpl });
    expect(res).toMatchObject({ ok: false, error: 'http_error' });
  });
});

describe('getTikTokVideoAnalytics', () => {
  it('faz parse defensivo das métricas aninhadas', async () => {
    const { fetchImpl, calls } = makeFetch(() =>
      okJson({
        error: { code: 'ok' },
        data: [
          {
            publish_id: 'a',
            is_valid: true,
            status: 'PUBLISHED',
            data: { play_count: 10, like_count: 2, share_count: 3, download_count: 1, comment_count: 0 },
          },
          { publish_id: 'b' },
        ],
      }),
    );
    const res = await getTikTokVideoAnalytics(access, ['a', 'b'], { fetchImpl });
    expect(res.ok).toBe(true);
    expect(res.items).toHaveLength(2);
    expect(res.items[0]).toMatchObject({ publishId: 'a', playCount: 10, likeCount: 2, status: 'PUBLISHED' });
    expect(res.items[1].publishId).toBe('b');
    expect(res.items[1].playCount).toBeUndefined();
    expect(calls[0].url).toContain('/v2/post/publish/video/data/?publish_ids=');
  });

  it('limita a 5 ids por chamada', async () => {
    const { fetchImpl, calls } = makeFetch(() => okJson({ error: { code: 'ok' }, data: [] }));
    await getTikTokVideoAnalytics(access, ['1', '2', '3', '4', '5', '6', '7'], { fetchImpl });
    const q = decodeURIComponent(String(calls[0].url).split('publish_ids=')[1]);
    expect(JSON.parse(q)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('reporta no_video_source quando não há ids', async () => {
    const { fetchImpl, calls } = makeFetch(() => okJson({}));
    const res = await getTikTokVideoAnalytics(access, [], { fetchImpl });
    expect(res).toMatchObject({ ok: false, error: 'no_video_source', items: [] });
    expect(calls.length).toBe(0);
  });
});

describe('fila de agendamento (pura)', () => {
  const item: PendingTikTokPost = {
    id: 'tt1',
    createdAt: '2026-10-18T00:00:00.000Z',
    scheduledAt: '2026-10-19T00:00:00.000Z',
    spec: { videoUrl: 'https://x' },
    status: 'pending',
  };

  it('appendPreservaOAnteriorENãoMutua', () => {
    const existing: PendingTikTokPost[] = [{ ...item, id: 'prev' }];
    const next = appendPendingTikTokPost(existing, item);
    expect(next).toHaveLength(2);
    expect(existing).toHaveLength(1);
    expect(appendPendingTikTokPost(null, item)).toHaveLength(1);
  });

  it('markActualizaAPorIdSemMutuar', () => {
    const existing: PendingTikTokPost[] = [item];
    const next = markPendingTikTokPost(existing, 'tt1', { status: 'published', publishId: '734123' });
    expect(next[0]).toMatchObject({ status: 'published', publishId: '734123' });
    expect(existing[0].status).toBe('pending');
  });
});

describe('TIKTOK_PRIVACY_LEVELS', () => {
  it('expõe os 4 níveis aceitos pela API', () => {
    expect([...TIKTOK_PRIVACY_LEVELS]).toEqual([
      'PUBLIC_TO_EVERYONE',
      'MUTUAL_FOLLOW_FRIENDS',
      'FOLLOWER_OF_CREATORS',
      'SELF_ONLY',
    ]);
  });
});
