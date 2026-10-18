// FASE 3 · slice 1 — Testes do serviço TikTok Ads (Business API / BAP).
// Mesma filosofia: fetch injetado, sem rede, comportamento honesto.

import {
  getTikTokAdsInsights,
  isValidTikTokAdsDate,
  TIKTOK_ADS_ENTITIES,
  TIKTOK_ADS_METRICS,
  type TikTokAdsAccess,
} from './adsAnalytics';

const access: TikTokAdsAccess = { accessToken: 'bap-token', advertiserId: '7291' };

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

describe('getTikTokAdsInsights', () => {
  it('busca o relatório (1 dia) e devolve as linhas', async () => {
    const { fetchImpl, calls } = makeFetch(() =>
      okJson({
        error: { code: 'NoError', message: 'Successful' },
        data: [
          { ad_group_id: 'g1', show: 500, click: 20, cost_num: 10.5, ctr: 0.04, likes: 8 },
          { ad_group_id: 'g2', show: 300, click: 10, cost_num: 6.2 },
        ],
      }),
    );
    const res = await getTikTokAdsInsights(access, { date: '2026-10-17', entity: 'CAMPAIGN', fetchImpl });
    expect(res.ok).toBe(true);
    expect(res.advertiserId).toBe('7291');
    expect(res.entity).toBe('CAMPAIGN');
    expect(res.date).toBe('2026-10-17');
    expect(res.rows).toHaveLength(2);
    const url = calls[0].url;
    expect(url).toContain('https://business-api.tiktok.com/open_api/v1.3/report/object/get/');
    expect(url).toContain('advertiser_id=7291');
    expect(url).toContain('entity=CAMPAIGN');
    expect(url).toContain('date=2026-10-17');
    expect(url).toContain('time_grain=DAILY');
    expect(url).toContain('metrics=show%2Cclick%2Ccost_num%2Cctr%2Clikes');
    expect(calls[0].init!.headers).toEqual({ Authorization: 'Bearer bap-token' });
  });

  it('usa os defaults (AD_GROUP + yesterday) quando não há parâmetros', async () => {
    const { fetchImpl, calls } = makeFetch(() => okJson({ error: { code: 'NoError' }, data: [] }));
    const res = await getTikTokAdsInsights(access, { fetchImpl });
    expect(res.ok).toBe(true);
    expect(res.entity).toBe('AD_GROUP');
    expect(res.date).toBe('yesterday');
    expect(calls[0].url).toContain('entity=AD_GROUP');
    expect(calls[0].url).toContain('date=yesterday');
  });

  it('reporta tiktok_ads_not_configured quando falta token', async () => {
    const { fetchImpl, calls } = makeFetch(() => okJson({}));
    const res = await getTikTokAdsInsights({ accessToken: '', advertiserId: '1' }, { fetchImpl });
    expect(res).toMatchObject({ ok: false, error: 'tiktok_ads_not_configured', rows: [] });
    expect(calls.length).toBe(0);
  });

  it('reporta no_advertiser quando falta o Advertiser ID', async () => {
    const { fetchImpl, calls } = makeFetch(() => okJson({}));
    const res = await getTikTokAdsInsights({ accessToken: 't', advertiserId: ' ' }, { fetchImpl });
    expect(res).toMatchObject({ ok: false, error: 'no_advertiser', rows: [] });
    expect(calls.length).toBe(0);
  });

  it('reporta fetch_unavailable quando não há fetch', async () => {
    const realFetch = (globalThis as { fetch?: unknown }).fetch;
    (globalThis as { fetch?: unknown }).fetch = undefined;
    try {
      const res = await getTikTokAdsInsights(access);
      expect(res).toMatchObject({ ok: false, error: 'fetch_unavailable' });
    } finally {
      (globalThis as { fetch?: unknown }).fetch = realFetch;
    }
  });

  it('mapeia erro do BAP (código não-NoError) para http_error', async () => {
    const { fetchImpl } = makeFetch(() =>
      new Response(
        JSON.stringify({ error: { code: 'InvalidParameter', message: 'date out of range' }, data: null }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const res = await getTikTokAdsInsights(access, { fetchImpl });
    expect(res).toMatchObject({ ok: false, error: 'http_error', rows: [] });
    expect(res.errorDetail).toContain('date out of range');
  });

  it('aceita 200 mas só é ok com error.code=NoError', async () => {
    const { fetchImpl } = makeFetch(() =>
      okJson({ error: { code: 'OtherError', message: 'boom' }, data: [] }),
    );
    const res = await getTikTokAdsInsights(access, { fetchImpl });
    expect(res).toMatchObject({ ok: false, error: 'http_error' });
  });

  it('mapeia falha de rede para network_error', async () => {
    const { fetchImpl } = makeFetch(() => {
      throw new Error('boom');
    });
    const res = await getTikTokAdsInsights(access, { fetchImpl });
    expect(res).toMatchObject({ ok: false, error: 'network_error', errorDetail: 'boom' });
  });
});

describe('isValidTikTokAdsDate', () => {
  it('aceita YYYY-MM-DD válida', () => {
    expect(isValidTikTokAdsDate('2026-10-17')).toBe(true);
    expect(isValidTikTokAdsDate('2026-02-28')).toBe(true);
  });

  it('rejeita datas inexistentes ou malformadas', () => {
    expect(isValidTikTokAdsDate('2026-02-30')).toBe(false);
    expect(isValidTikTokAdsDate('2026-13-01')).toBe(false);
    expect(isValidTikTokAdsDate('17-10-2026')).toBe(false);
    expect(isValidTikTokAdsDate('yesterday')).toBe(false);
    expect(isValidTikTokAdsDate('')).toBe(false);
  });
});

describe('TIKTOK_ADS_ENTITIES / TIKTOK_ADS_METRICS', () => {
  it('expõe o conjunto de entidades reportáveis', () => {
    expect([...TIKTOK_ADS_ENTITIES]).toEqual([
      'AD_ACCOUNT',
      'CAMPAIGN',
      'AD_GROUP',
      'AD',
      'CREATIVE',
      'BASIC_CREATIVE',
    ]);
  });

  it('expõe o conjunto de métricas úteis', () => {
    expect(TIKTOK_ADS_METRICS).toContain('cost_num');
    expect(TIKTOK_ADS_METRICS).toContain('likes');
  });
});
