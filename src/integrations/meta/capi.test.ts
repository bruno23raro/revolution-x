import { sendCapiEvent, sendCapiEvents } from './capi';

const EMAIL_SHA = 'fb98d44ad7501a959f3f4f4a3f004fe2d9e581ea6207e218c4b02c08a4d75adf'; // sha256('a@b.com')

function fakeFetch(status = 200, json: unknown = { events_received: 1 }) {
  const calls: { url: string; body: any }[] = [];
  const fn = jest.fn(async (url: string, init: any) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return { ok: status >= 200 && status < 300, status, json: async () => json } as Response;
  });
  return { fn, calls };
}

const CFG = { pixelId: '1718964229317989', accessToken: 'TOK', apiBase: 'https://graph.test' };

describe('capi', () => {
  const env = process.env;
  beforeEach(() => { process.env = { ...env }; delete process.env.META_PIXEL_ID; delete process.env.META_CAPI_ACCESS_TOKEN; });
  afterAll(() => { process.env = env; });

  it('sem credencial -> capi_not_configured', async () => {
    await expect(sendCapiEvent({ eventName: 'Purchase' })).resolves.toMatchObject({ ok: false, error: 'capi_not_configured' });
  });

  it('hasheia e-mail, monta URL do pixel e devolve events_received', async () => {
    const { fn, calls } = fakeFetch();
    const r = await sendCapiEvent(
      { eventName: 'Purchase', eventId: 'e1', emails: [' A@B.com '], value: 142.52, currency: 'BRL' },
      { ...CFG, fetchImpl: fn as any },
    );
    expect(r).toEqual({ ok: true, eventsReceived: 1, eventId: 'e1' });
    expect(calls[0].url).toContain('/v26.0/1718964229317989/events?access_token=TOK');
    const d = calls[0].body.data[0];
    expect(d.user_data.em).toEqual([EMAIL_SHA]);
    expect(d.custom_data).toEqual({ value: 142.52, currency: 'BRL' });
    expect(d.action_source).toBe('website');
  });

  it('test_event_code e lote <=1000 de uma vez', async () => {
    const { fn, calls } = fakeFetch(200, { events_received: 2 });
    const r = await sendCapiEvents(
      [{ eventName: 'Lead', eventId: 'a' }, { eventName: 'Lead', eventId: 'b' }],
      { ...CFG, testEventCode: 'RX-1', fetchImpl: fn as any },
    );
    expect(r.ok && r.eventsReceived).toBe(2);
    expect(calls[0].body.test_event_code).toBe('RX-1');
    expect(calls[0].body.data.map((x: any) => x.event_id)).toEqual(['a', 'b']);
  });

  it('gera eventId quando omitido (dedup possivel pelo retorno)', async () => {
    const { fn } = fakeFetch();
    const r = await sendCapiEvent({ eventName: 'ViewContent' }, { ...CFG, fetchImpl: fn as any });
    expect(r.eventId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('erro HTTP vira http_error com mensagem da Meta', async () => {
    const { fn } = fakeFetch(400, { error: { message: 'Bad params' } });
    const r = await sendCapiEvent({ eventName: 'X' }, { ...CFG, fetchImpl: fn as any });
    expect(r).toMatchObject({ ok: false, error: 'http_error', errorDetail: 'Bad params' });
  });
});
