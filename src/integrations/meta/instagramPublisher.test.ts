// src/integrations/meta/instagramPublisher.test.ts
import {
  createInstagramMediaContainer,
  publishInstagramMedia,
  publishInstagramPost,
  toScheduledStartSeconds,
  MAX_SCHEDULE_AHEAD_SECONDS,
  type InstagramAccess,
} from './instagramPublisher';

const access: InstagramAccess = { accessToken: 'tok', instagramUserId: 'ig-1' };

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

describe('toScheduledStartSeconds', () => {
  it('returns null when absent', () => {
    expect(toScheduledStartSeconds()).toBeNull();
  });
  it('converts a valid ISO string to UNIX seconds', () => {
    expect(toScheduledStartSeconds('2026-10-18T12:00:00.000Z')).toBe(
      Math.floor(new Date('2026-10-18T12:00:00.000Z').getTime() / 1000),
    );
  });
  it('returns null for an invalid date', () => {
    expect(toScheduledStartSeconds('not-a-date')).toBeNull();
  });
});

describe('createInstagramMediaContainer', () => {
  it('creates an IMAGE container without scheduling', async () => {
    const { fetchImpl, calls } = makeFetch(
      () => new Response(JSON.stringify({ id: 'c-1' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const res = await createInstagramMediaContainer(
      access,
      { mediaType: 'IMAGE', imageUrl: 'https://e.com/a.jpg', caption: 'oi' },
      { fetchImpl },
    );
    expect(res).toEqual({ ok: true, containerId: 'c-1', scheduled: false });
    expect(calls[0].url).toBe('https://graph.facebook.com/v26.0/ig-1/media');
    const body = JSON.parse(calls[0].init!.body as string);
    expect(body).toMatchObject({ media_type: 'IMAGE', image_url: 'https://e.com/a.jpg', caption: 'oi' });
    expect(body.scheduled_start_time).toBeUndefined();
  });

  it('includes scheduled_start_time when scheduledAt is provided', async () => {
    const { fetchImpl, calls } = makeFetch(
      () => new Response(JSON.stringify({ id: 'c-2' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const res = await createInstagramMediaContainer(
      access,
      { mediaType: 'REEL', videoUrl: 'https://e.com/v.mp4', scheduledAt: '2026-10-18T12:00:00.000Z' },
      { fetchImpl },
    );
    expect(res).toEqual({ ok: true, containerId: 'c-2', scheduled: true });
    const body = JSON.parse(calls[0].init!.body as string);
    expect(body.media_type).toBe('REELS');
    expect(body.video_url).toBe('https://e.com/v.mp4');
    expect(body.scheduled_start_time).toBe(
      Math.floor(new Date('2026-10-18T12:00:00.000Z').getTime() / 1000),
    );
  });

  it('rejects a missing media source without calling fetch', async () => {
    const { fetchImpl, calls } = makeFetch(() => new Response('{}', { status: 200 }));
    const res = await createInstagramMediaContainer(access, { mediaType: 'IMAGE', caption: 'x' }, { fetchImpl });
    expect(res).toEqual({ ok: false, error: 'no_media_source' });
    expect(calls.length).toBe(0);
  });

  it('reports meta_not_configured when credentials are missing', async () => {
    const res = await createInstagramMediaContainer(
      { accessToken: '', instagramUserId: '' },
      { mediaType: 'IMAGE', imageUrl: 'https://e.com/a.jpg' },
      { fetchImpl: makeFetch(() => new Response('{}')).fetchImpl },
    );
    expect(res).toEqual({ ok: false, error: 'meta_not_configured' });
  });

  it('reports fetch_unavailable when no fetch is resolvable', async () => {
    const realFetch = (globalThis as { fetch?: unknown }).fetch;
    (globalThis as { fetch?: unknown }).fetch = undefined;
    try {
      const res = await createInstagramMediaContainer(
        access,
        { mediaType: 'IMAGE', imageUrl: 'https://e.com/a.jpg' },
      );
      expect(res).toEqual({ ok: false, error: 'fetch_unavailable' });
    } finally {
      (globalThis as { fetch?: unknown }).fetch = realFetch;
    }
  });

  it('a REEL falls back to imageUrl when videoUrl is absent', async () => {
    const { fetchImpl, calls } = makeFetch(
      () => new Response(JSON.stringify({ id: 'c-r' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const res = await createInstagramMediaContainer(
      access,
      { mediaType: 'REEL', imageUrl: 'https://e.com/cover.jpg' },
      { fetchImpl },
    );
    expect(res.ok).toBe(true);
    const body = JSON.parse(calls[0].init!.body as string);
    expect(body.media_type).toBe('REELS');
    expect(body.video_url).toBe('https://e.com/cover.jpg');
  });

  it('maps a non-ok response with a real body to http_error', async () => {
    const { fetchImpl } = makeFetch(
      () =>
        new Response(JSON.stringify({ error: { code: 36003, message: 'bad aspect' } }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    const res = await createInstagramMediaContainer(
      access,
      { mediaType: 'IMAGE', imageUrl: 'https://e.com/a.jpg' },
      { fetchImpl },
    );
    expect(res).toMatchObject({ ok: false, error: 'http_error' });
    expect(res.errorDetail).toContain('36003');
  });

  it('maps a network failure to network_error', async () => {
    const { fetchImpl } = makeFetch(() => {
      throw new Error('boom');
    });
    const res = await createInstagramMediaContainer(access, { mediaType: 'IMAGE', imageUrl: 'https://e.com/a.jpg' }, { fetchImpl });
    expect(res).toMatchObject({ ok: false, error: 'network_error', errorDetail: 'boom' });
  });
});

describe('publishInstagramMedia', () => {
  it('publishes a container and returns the media id', async () => {
    const { fetchImpl, calls } = makeFetch(
      () => new Response(JSON.stringify({ id: 'm-9' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const res = await publishInstagramMedia(access, 'c-1', { fetchImpl });
    expect(res).toEqual({ ok: true, mediaId: 'm-9', containerId: 'c-1' });
    expect(calls[0].url).toContain('/ig-1/media_publish?creation_ids=c-1');
  });

  it('rejects an empty container id without calling fetch', async () => {
    const { fetchImpl, calls } = makeFetch(() => new Response('{}'));
    const res = await publishInstagramMedia(access, '', { fetchImpl });
    expect(res).toEqual({ ok: false, error: 'no_media_source' });
    expect(calls.length).toBe(0);
  });
});

describe('publishInstagramPost', () => {
  it('runs create + publish and returns both ids', async () => {
    let step = 0;
    const { fetchImpl } = makeFetch(() => {
      step++;
      const body = step === 1 ? { id: 'c-7' } : { id: 'm-7' };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    const res = await publishInstagramPost(
      access,
      { mediaType: 'IMAGE', imageUrl: 'https://e.com/a.jpg', caption: 'now' },
      { fetchImpl },
    );
    expect(res).toEqual({ ok: true, mediaId: 'm-7', containerId: 'c-7', scheduled: false });
  });

  it('stops and reports when container creation fails', async () => {
    const { fetchImpl, calls } = makeFetch(
      () =>
        new Response(JSON.stringify({ error: { code: 190, message: 'token' } }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    const res = await publishInstagramPost(access, { mediaType: 'IMAGE', imageUrl: 'https://e.com/a.jpg' }, { fetchImpl });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('http_error');
    expect(calls.length).toBe(1); // só o passo 1
  });

  it('marks scheduled when a valid scheduledAt is set', async () => {
    let step = 0;
    const now = Date.now();
    const future = new Date(now + 2 * 3600 * 1000).toISOString(); // 2h daqui (dentro da janela de 75d)
    const { fetchImpl } = makeFetch(() => {
      step++;
      const body = step === 1 ? { id: 'c-s' } : { id: 'm-s' };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    const res = await publishInstagramPost(
      access,
      { mediaType: 'IMAGE', imageUrl: 'https://e.com/a.jpg', scheduledAt: future },
      { fetchImpl },
    );
    expect(res.scheduled).toBe(true);
    void MAX_SCHEDULE_AHEAD_SECONDS;
  });
});
