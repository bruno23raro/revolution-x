// WhatsApp oficial (019) — unit: contrato OpenBSP, tier 24h e gates de
// template. fetch/channelRepo TODOS mockados (nenhuma rede real).

const mockFetch = jest.fn();

describe('openbsp/client', () => {
  const envBackup = { ...process.env };
  beforeEach(() => {
    jest.resetModules();
    mockFetch.mockReset();
    process.env.OPENBSP_BASE_URL = 'https://x.supabase.co/rest/v1';
    process.env.OPENBSP_PUBLISHABLE_KEY = 'sb_publishable_test';
    process.env.OPENBSP_API_KEY = 'obs_test_key';
    process.env.OPENBSP_ORG_ID = 'org-uuid-1';
  });
  afterAll(() => {
    process.env = envBackup;
  });

  it('config null quando falta qualquer credencial', () => {
    delete process.env.OPENBSP_API_KEY;
    const { openbspConfig } = require('@/integrations/whatsapp/openbsp/client');
    expect(openbspConfig()).toBeNull();
  });

  it('POST usa SEMPRE apikey + api-key (nunca Authorization Bearer)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      text: async () => JSON.stringify([{ id: 'msg-1' }]),
    });
    const { sendViaOpenbsp, textContent } = require('@/integrations/whatsapp/openbsp/client');
    const r = await sendViaOpenbsp(
      { accessToken: 't', phoneNumberId: '123' },
      '+5511999998888',
      textContent('ola'),
      { fetchImpl: mockFetch },
    );
    expect(r.ok).toBe(true);
    expect(r.data.id).toBe('msg-1');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain('/rest/v1/messages');
    expect(init.headers.apikey).toBe('sb_publishable_test');
    expect(init.headers['api-key']).toBe('obs_test_key');
    expect(init.headers.Authorization).toBeUndefined();
    const body = JSON.parse(init.body);
    expect(body.conversation_address).toBe('5511999998888'); // E164 sem '+'
    expect(body.organization_id).toBe('org-uuid-1');
    expect(body.organization_address).toBe('123');
    expect(body.content).toEqual({ version: '1', type: 'text', kind: 'text', text: 'ola' });
  });

  it('http_error propagado sem lançar', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401, text: async () => 'PGRST301' });
    const { sendViaOpenbsp, textContent } = require('@/integrations/whatsapp/openbsp/client');
    const r = await sendViaOpenbsp({ accessToken: '', phoneNumberId: '1' }, '5511', textContent('x'), { fetchImpl: mockFetch });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('http_error');
    expect(r.errorDetail).toContain('PGRST301');
  });

  it('network_error (fetch rejeita) nunca lança', async () => {
    mockFetch.mockRejectedValue(new Error('boom'));
    const { sendViaOpenbsp, textContent } = require('@/integrations/whatsapp/openbsp/client');
    const r = await sendViaOpenbsp({ accessToken: '', phoneNumberId: '1' }, '5511', textContent('x'), { fetchImpl: mockFetch });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('network_error');
  });

  it('fetchConnectedAddress casa linha pelo extra.verify_token', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify([
          { address: 'PNID-OUTRO', extra: { verify_token: 'vt-2', access_token: 'tok2' } },
          { address: 'PNID-MEU', extra: { verify_token: 'vt-1', waba_id: 'w1', access_token: 'tok1', phone_number: '+5511', verified_name: 'Loja' } },
        ]),
    });
    const { fetchConnectedAddress } = require('@/integrations/whatsapp/openbsp/client');
    const r = await fetchConnectedAddress('vt-1', { fetchImpl: mockFetch });
    expect(r.ok).toBe(true);
    expect(r.data.address).toBe('PNID-MEU');
    expect(r.data.extra.waba_id).toBe('w1');
  });

  it('mintOnboardingToken devolve popupUrl com id do token', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 201, text: async () => JSON.stringify([{ id: 'tok-abc' }]) });
    const { mintOnboardingToken } = require('@/integrations/whatsapp/openbsp/client');
    const r = await mintOnboardingToken(
      { name: 'org X', orgId: 'obs-org', callbackUrl: 'https://rx/api/integrations/openbsp/incoming?org=1', verifyToken: 'vt' },
      { fetchImpl: mockFetch },
    );
    expect(r.ok).toBe(true);
    expect(r.popupUrl).toBe('https://web.openbsp.dev/onboard/whatsapp/tok-abc');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.organization_id).toBe('obs-org');
    expect(body.service).toBe('whatsapp');
    expect(body.verify_token).toBe('vt');
  });
});

describe('dispatcher: tier 24h + gate template (gates 2 e 5)', () => {
  const baseChannel = () => ({
    id: 'c1',
    organizationId: 'org1',
    provider: 'openbsp',
    status: 'CONNECTED',
    onboardingTokenId: null,
    callbackUrl: null,
    verifyToken: 'vt',
    wabaId: 'w1',
    phoneNumberId: 'PNID',
    phoneNumber: '+5511999998888',
    verifiedName: 'Loja',
    accessTokenEnc: null,
    tierLimitPer24h: 250,
    sentWindow24h: 0,
    windowStartedAt: new Date().toISOString(),
    lastError: null,
    accessToken: 'tok',
  });

  const fakeClient = (approvedRow: unknown) => {
    const maybeSingle = async () => ({ data: approvedRow, error: null });
    const chainEq: unknown = () => ({ eq: chainEq, maybeSingle });
    return {
      from: () => ({
        select: () => ({ eq: chainEq }),
        update: () => ({ eq: async () => ({}) }),
        upsert: async () => ({}),
      }),
    } as never;
  };

  it('checkTier: janela velha zera o contador; 80% dispara nearLimit', () => {
    const { checkTier } = require('@/integrations/whatsapp/dispatcher');
    const old = { ...baseChannel(), windowStartedAt: new Date(Date.now() - 87_000_000).toISOString(), sentWindow24h: 250 };
    expect(checkTier(old).allowed).toBe(true);
    expect(checkTier(old).sent).toBe(0);
    const at80 = { ...baseChannel(), sentWindow24h: 200 };
    expect(checkTier(at80).nearLimit).toBe(true);
    const atMax = { ...baseChannel(), sentWindow24h: 250 };
    expect(checkTier(atMax).allowed).toBe(false);
  });

  it('template NÃO aprovado bloqueia envio com erro explícito', async () => {
    const { buildOfficialSender } = require('@/integrations/whatsapp/dispatcher');
    const provider = { name: 'openbsp', send: jest.fn(), createTemplate: jest.fn(), listTemplates: jest.fn(), getTemplateStatus: jest.fn() };
    const sender = buildOfficialSender({
      channel: baseChannel(),
      client: fakeClient(null), // nada APPROVED na tabela
      payload: { kind: 'template', name: 'boas_vindas', language: 'pt_BR', variables: [] },
      provider: provider as never,
    });
    const r = await sender('id1', '5511999998888', 'Maria');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('template_not_approved');
    expect(provider.send).not.toHaveBeenCalled();
  });

  it('template APROVED passa; categoria divergente bloqueia', async () => {
    const { buildOfficialSender } = require('@/integrations/whatsapp/dispatcher');
    const approved = { id: 't1', organizationId: 'org1', name: 'boas_vindas', language: 'pt_BR', category: 'UTILITY', status: 'APPROVED' };
    const provider = {
      name: 'openbsp',
      send: jest.fn().mockResolvedValue({ ok: true, messageId: 'wamid-1', via: 'meta_direct' }),
      createTemplate: jest.fn(),
      listTemplates: jest.fn(),
      getTemplateStatus: jest.fn(),
    };
    // campanha MARKETING tentando usar template UTILITY → bloqueio explícito
    const strict = buildOfficialSender({
      channel: baseChannel(),
      client: fakeClient(approved) as never,
      payload: { kind: 'template', name: 'boas_vindas', language: 'pt_BR', variables: [] },
      expectedCategory: 'MARKETING',
      provider: provider as never,
    });
    const bad = await strict('id1', '5511', 'Maria');
    expect(bad.ok).toBe(false);
    expect(bad.error).toBe('template_category_mismatch');

    // sem expectativa de categoria → envia e vira tier_blocked no limite
    const okSender = buildOfficialSender({
      channel: baseChannel(),
      client: fakeClient(approved) as never,
      payload: { kind: 'template', name: 'boas_vindas', language: 'pt_BR', variables: [] },
      provider: provider as never,
    });
    const good = await okSender('id1', '5511', 'Maria');
    expect(good.ok).toBe(true);
    expect(good.externalMessageId).toBe('wamid-1');

    const exhausted = { ...baseChannel(), sentWindow24h: 250 };
    const pausedSender = buildOfficialSender({
      channel: exhausted,
      client: fakeClient(approved) as never,
      payload: { kind: 'template', name: 'boas_vindas', language: 'pt_BR', variables: [] },
      provider: provider as never,
    });
    const blocked = await pausedSender('id1', '5511', 'Maria');
    expect(blocked.error).toBe('tier_limit_reached');
    expect(pausedSender.lastResult.tierBlocked).toBe(true);
  });
});

describe('provider factory', () => {
  it('meta_direct reservado falha de forma explícita', async () => {
    const { metaDirectProvider } = require('@/integrations/whatsapp/meta_direct/reserved');
    const r = await metaDirectProvider.send({ accessToken: 'x', phoneNumberId: '1' }, '5511', { kind: 'text', text: 'oi' });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('meta_direct_reserved');
  });

  it('factory escolhe por env (default openbsp)', () => {
    jest.resetModules();
    const { getWhatsAppProvider } = require('@/integrations/whatsapp/provider');
    delete process.env.WHATSAPP_PROVIDER;
    expect(getWhatsAppProvider().name).toBe('openbsp');
    process.env.WHATSAPP_PROVIDER = 'meta_direct';
    expect(getWhatsAppProvider().name).toBe('meta_direct');
    delete process.env.WHATSAPP_PROVIDER;
  });
});
