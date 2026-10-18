// src/integrations/meta/facebookPublisher.test.ts
import {
  publishFacebookPagePost,
  toScheduledStartSeconds,
  MAX_SCHEDULE_AHEAD_SECONDS,
  type FacebookPageAccess,
} from './facebookPublisher';

const access: FacebookPageAccess = { accessToken: 'tok', facebookPageId: 'page-1' };

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

describe('publishFacebookPagePost', () => {
  it('publishes a message now (no scheduling fields)', async () => {
    const { fetchImpl, calls } = makeFetch(
      () => new Response(JSON.stringify({ id: 'p-1' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const res = await publishFacebookPagePost(access, { message: 'olá' }, { fetchImpl });
    expect(res).toEqual({ ok: true, postId: 'p-1', scheduled: false });
    expect(calls[0].url).toBe('https://graph.facebook.com/v26.0/page-1/feed');
    const body = JSON.parse(calls[0].init!.body as string);
    expect(body).toEqual({ message: 'olá' });
    expect(body.published).toBeUndefined();
    expect(body.scheduled_publish_time).toBeUndefined();
  });

  it('publishes a link with a preview picture', async () => {
    const { fetchImpl, calls } = makeFetch(
      () => new Response(JSON.stringify({ id: 'p-2' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const res = await publishFacebookPagePost(access, { link: 'https://e.com/x' }, { fetchImpl });
    expect(res.ok).toBe(true);
    const body = JSON.parse(calls[0].init!.body as string);
    expect(body).toEqual({ link: 'https://e.com/x' });
  });

  it('includes scheduling fields when scheduledAt is set', async () => {
    const { fetchImpl, calls } = makeFetch(
      () => new Response(JSON.stringify({ id: 'p-3' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const res = await publishFacebookPagePost(
      access,
      { message: 'agendado', scheduledAt: '2026-10-18T12:00:00.000Z' },
      { fetchImpl },
    );
    expect(res).toEqual({ ok: true, postId: 'p-3', scheduled: true });
    const body = JSON.parse(calls[0].init!.body as string);
    expect(body.published).toBe(false);
    expect(body.scheduled_publish_time).toBe(Math.floor(new Date('2026-10-18T12:00:00.000Z').getTime() / 1000));
    expect(body.unpublished_content_type).toBe('SCHEDULED');
  });

  it('rejects an empty spec without calling fetch', async () => {
    const { fetchImpl, calls } = makeFetch(() => new Response('{}', { status: 200 }));
    const res = await publishFacebookPagePost(access, {}, { fetchImpl });
    expect(res).toEqual({ ok: false, error: 'no_content_source' });
    expect(calls.length).toBe(0);
  });

  it('reports meta_not_configured when credentials are missing', async () => {
    const res = await publishFacebookPagePost(
      { accessToken: '', facebookPageId: '' },
      { message: 'x' },
      { fetchImpl: makeFetch(() => new Response('{}')).fetchImpl },
    );
    expect(res).toEqual({ ok: false, error: 'meta_not_configured' });
  });

  it('reports fetch_unavailable when no fetch is resolvable', async () => {
    const realFetch = (globalThis as { fetch?: unknown }).fetch;
    (globalThis as { fetch?: unknown }).fetch = undefined;
    try {
      const res = await publishFacebookPagePost(access, { message: 'x' });
      expect(res).toEqual({ ok: false, error: 'fetch_unavailable' });
    } finally {
      (globalThis as { fetch?: unknown }).fetch = realFetch;
    }
  });

  it('maps a non-ok response with a real body to http_error', async () => {
    const { fetchImpl } = makeFetch(
      () =>
        new Response(JSON.stringify({ error: { code: 200, message: 'no page access' } }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    const res = await publishFacebookPagePost(access, { message: 'x' }, { fetchImpl });
    expect(res).toMatchObject({ ok: false, error: 'http_error' });
    expect(res.errorDetail).toContain('no page access');
  });

  it('maps a network failure to network_error', async () => {
    const { fetchImpl } = makeFetch(() => {
      throw new Error('boom');
    });
    const res = await publishFacebookPagePost(access, { message: 'x' }, { fetchImpl });
    expect(res).toMatchObject({ ok: false, error: 'network_error', errorDetail: 'boom' });
  });
});

describe('MAX_SCHEDULE_AHEAD_SECONDS', () => {
  it('is the 75-day window', () => {
    expect(MAX_SCHEDULE_AHEAD_SECONDS).toBe(75 * 24 * 60 * 60);
  });
});
