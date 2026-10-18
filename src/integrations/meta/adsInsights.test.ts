// FASE 3 · slice 1 — Testes do serviço Meta Ad Manager (Marketing API).
// Mesma filosofia da IG/FB: fetch injetado, sem rede, comportamento honesto.

import { getMetaAdInsights, META_ADS_TIME_RANGES, type MetaAdsAccess } from './adsInsights';

const access: MetaAdsAccess = { accessToken: 'meta-token', adAccountId: 'ACT-123' };

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

describe('getMetaAdInsights', () => {
  it('busca os insights e faz parse defensivo das métricas', async () => {
    const { fetchImpl, calls } = makeFetch(() =>
      okJson({
        data: [
          {
            date: '2026-10-10',
            spend: '12.5',
            impressions: 1000,
            clicks: 40,
            reach: 900,
            ctr: '0.04',
            cpc: '0.31',
            actions: { values: [{ metric: 'POST_LIKE', value: 7 }, { metric: 'POST_CLICK', value: 3 }] },
          },
          { spend: 'x', impressions: 'y' },
        ],
      }),
    );
    const res = await getMetaAdInsights(access, { timeRange: 'last_7d', fetchImpl });
    expect(res.ok).toBe(true);
    expect(res.adAccountId).toBe('ACT-123');
    expect(res.insights).toHaveLength(2);
    expect(res.insights[0]).toEqual({
      date: '2026-10-10',
      spend: 12.5,
      impressions: 1000,
      clicks: 40,
      reach: 900,
      ctr: 0.04,
      cpc: 0.31,
      actionsCount: 10,
    });
    expect(res.insights[1].spend).toBeUndefined();
    const url = calls[0].url;
    expect(url).toBe(
      'https://graph.facebook.com/v26.0/ACT-123/insights?time_range=last_7d&fields=spend,impressions,clicks,reach,ctr,cpc,actions&limit=100&use_account_time=true',
    );
    expect(calls[0].init!.headers).toEqual({ Authorization: 'Bearer meta-token' });
  });

  it('usa os defaults quando não há parâmetros', async () => {
    const { fetchImpl, calls } = makeFetch(() => okJson({ data: [] }));
    const res = await getMetaAdInsights(access, { fetchImpl });
    expect(res.ok).toBe(true);
    expect(res.timeRange).toBe('last_7d');
    expect(calls[0].url).toContain('time_range=last_7d');
  });

  it('reporta meta_not_configured quando falta token sem chamar fetch', async () => {
    const { fetchImpl, calls } = makeFetch(() => okJson({}));
    const res = await getMetaAdInsights({ accessToken: '', adAccountId: 'ACT-1' }, { fetchImpl });
    expect(res).toMatchObject({ ok: false, error: 'meta_not_configured', insights: [] });
    expect(calls.length).toBe(0);
  });

  it('reporta no_ad_account quando falta o ID da conta', async () => {
    const { fetchImpl, calls } = makeFetch(() => okJson({}));
    const res = await getMetaAdInsights({ accessToken: 't', adAccountId: '  ' }, { fetchImpl });
    expect(res).toMatchObject({ ok: false, error: 'no_ad_account', insights: [] });
    expect(calls.length).toBe(0);
  });

  it('reporta fetch_unavailable quando não há fetch', async () => {
    const realFetch = (globalThis as { fetch?: unknown }).fetch;
    (globalThis as { fetch?: unknown }).fetch = undefined;
    try {
      const res = await getMetaAdInsights(access);
      expect(res).toMatchObject({ ok: false, error: 'fetch_unavailable' });
    } finally {
      (globalThis as { fetch?: unknown }).fetch = realFetch;
    }
  });

  it('mapeia resposta não-ok (ex.: sem permissão ads_read) para http_error', async () => {
    const { fetchImpl } = makeFetch(() =>
      new Response(
        JSON.stringify({
          error: { message: 'Insufficient permissions: need ads_read', code: 100, error_user_msg: 'denied' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const res = await getMetaAdInsights(access, { fetchImpl });
    expect(res).toMatchObject({ ok: false, error: 'http_error' });
    expect(res.errorDetail).toContain('need ads_read');
  });

  it('mapeia falha de rede para network_error', async () => {
    const { fetchImpl } = makeFetch(() => {
      throw new Error('boom');
    });
    const res = await getMetaAdInsights(access, { fetchImpl });
    expect(res).toMatchObject({ ok: false, error: 'network_error', errorDetail: 'boom' });
  });
});

describe('META_ADS_TIME_RANGES', () => {
  it('expõe os valores estáveis da Marketing API', () => {
    expect([...META_ADS_TIME_RANGES]).toEqual([
      'today',
      'yesterday',
      'last_7d',
      'last_28d',
      'this_month',
      'last_month',
      'last_quarter',
      'last_year',
    ]);
  });
});
