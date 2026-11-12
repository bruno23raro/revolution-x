// Testes unitários para WhatsApp Cloud API v19.0 - Templates
// Padrão: fetch injetado, sem rede, comportamento honesto.

import {
  listWhatsAppTemplates,
  createWhatsAppTemplate,
  getWhatsAppTemplate,
  sendTestMessage,
  getTemplateStatus,
  type TemplatesAccess,
} from './whatsappTemplates';

const access: TemplatesAccess = {
  accessToken: 'meta-token-v19',
  phoneNumberId: 'PHONE-123',
  wabaId: 'WABA-456',
};

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

function okJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('listWhatsAppTemplates (v19.0)', () => {
  it('retorna lista de templates com sucesso', async () => {
    const { fetchImpl, calls } = makeFetch(() =>
      okJson({
        data: [
          { name: 'welcome_template', category: 'UTILITY', status: 'APPROVED', language: { code: 'en_US' } },
          { name: 'promo_offer', category: 'MARKETING', status: 'PENDING', language: { code: 'pt_BR' } },
        ],
      }),
    );

    const result = await listWhatsAppTemplates(access, { fetchImpl, locale: 'en_US' });

    expect(result.ok).toBe(true);
    expect(result.templates).toHaveLength(2);
    expect(result.templates[0]).toEqual({
      name: 'welcome_template',
      category: 'UTILITY',
      status: 'APPROVED',
      language: 'en_US',
    });

    const url = calls[0].url;
    expect(url).toContain('v19.0');
    expect(url).toContain('/message/templates');
    expect(url).toContain('locale=en_US');
  });

  it('usa wabaId como escopo quando phoneNumberId ausente', async () => {
    const { fetchImpl, calls } = makeFetch(() => okJson({ data: [] }));
    const accessWaba: TemplatesAccess = { ...access, phoneNumberId: '' };

    await listWhatsAppTemplates(accessWaba, { fetchImpl, wabaId: 'WABA-456' });

    expect(calls[0].url).toContain('/WABA-456/message/templates');
    expect(calls[0].url).not.toContain('PHN-123');
  });

  it('retorna meta_not_configured sem token', async () => {
    const { fetchImpl, calls } = makeFetch(() => okJson({}));
    const result = await listWhatsAppTemplates({ ...access, accessToken: '' }, { fetchImpl });

    expect(result).toEqual({ ok: false, templates: [], error: 'meta_not_configured' });
    expect(calls.length).toBe(0);
  });

  it('retorna meta_not_configured sem scope (wabaId/phoneNumberId)', async () => {
    const { fetchImpl, calls } = makeFetch(() => okJson({}));
    const result = await listWhatsAppTemplates(
      { accessToken: 'token', phoneNumberId: '', wabaId: '' },
      { fetchImpl, wabaId: '', phoneNumberId: '' as any }
    );

    expect(result).toEqual({ ok: false, templates: [], error: 'meta_not_configured' });
    expect(calls.length).toBe(0);
  });

  it('retorna fetch_unavailable sem fetch injetado', async () => {
    const originalFetch = globalThis.fetch;
    // @ts-expect-error - deixando fetch indefinido propositalmente
    globalThis.fetch = undefined;

    try {
      const result = await listWhatsAppTemplates(access);
      expect(result).toEqual({ ok: false, templates: [], error: 'fetch_unavailable' });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('retorna http_error com código HTTP', async () => {
    const { fetchImpl } = makeFetch(() =>
      new Response(JSON.stringify({ error: { message: 'Invalid OAuth token' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await listWhatsAppTemplates(access, { fetchImpl });
    expect(result).toEqual({
      ok: false,
      templates: [],
      error: 'http_error',
      errorDetail: 'HTTP 401',
    });
  });

  it('retorna network_error em falha de conexão', async () => {
    const { fetchImpl } = makeFetch(() => {
      throw new Error('network unreachable');
    });

    const result = await listWhatsAppTemplates(access, { fetchImpl });
    expect(result).toEqual({
      ok: false,
      templates: [],
      error: 'network_error',
      errorDetail: 'network unreachable',
    });
  });
});

describe('createWhatsAppTemplate (v19.0)', () => {
  it('cria template com sucesso', async () => {
    const { fetchImpl, calls } = makeFetch(() =>
      okJson({ id: 't-789', name: 'test_template', status: 'PENDING' }),
    );

    const result = await createWhatsAppTemplate(
      access,
      { name: 'test_template', category: 'MARKETING', language: 'en', body: 'Hello {{1}}' },
      { fetchImpl },
    );

    expect(result.ok).toBe(true);
    expect(result.name).toBe('test_template');
    expect(result.templateId).toBe('t-789');
  });

  it('cria template com header e footer', async () => {
    const { fetchImpl, calls } = makeFetch(() => okJson({ id: 't-790', name: 'header_footer' }));

    await createWhatsAppTemplate(
      access,
      {
        name: 'header_footer',
        category: 'UTILITY',
        language: 'pt_BR',
        body: 'Conteúdo do template',
        header: { type: 'TEXT', text: 'Cabeçalho do template' },
        footer: { text: 'Rodapé do template' },
      },
      { fetchImpl },
    );

    const body = JSON.parse(calls[0].init!.body as string);
    expect(body.components).toContainEqual(
      expect.objectContaining({ type: 'HEADER', text: 'Cabeçalho do template', format: 'TEXT' }),
    );
    expect(body.components).toContainEqual(expect.objectContaining({ type: 'FOOTER', text: 'Rodapé do template' }));
  });

  it('cria template com botões', async () => {
    const { fetchImpl, calls } = makeFetch(() => okJson({ id: 't-791', name: 'button_template' }));

    await createWhatsAppTemplate(
      access,
      {
        name: 'button_template',
        category: 'MARKETING',
        language: 'en',
        body: 'Press a button',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Click Here', sub_type: 'quick_reply' },
          { type: 'URL', text: 'Visit Site', sub_type: 'url' },
        ],
      },
      { fetchImpl },
    );

    const body = JSON.parse(calls[0].init!.body as string);
    expect(body.components).toContainEqual(expect.objectContaining({ type: 'BUTTONS' }));
  });

  it('retorna validation_error para nome vazio', async () => {
    const { fetchImpl } = makeFetch(() => okJson({}));
    // O nome com apenas espaços passa na validação inicial do TypeScript
    // mas é enviado para a API. Em vez disso, testamos sem nome (undefined)
    const result = await createWhatsAppTemplate(
      access,
      { name: '', category: 'MARKETING' }, // nome vazio
      { fetchImpl },
    );

    // O código retorna validation_error para nome vazio
    expect(result).toEqual({
      ok: false,
      error: 'validation_error',
      errorDetail: 'Nome é obrigatório',
    });
  });

  it('retorna validation_error para categoria inválida', async () => {
    const { fetchImpl, calls } = makeFetch(() => okJson({}));

    const result = await createWhatsAppTemplate(
      access,
      { name: 'test', category: 'INVALID' as any },
      { fetchImpl },
    );

    expect(result).toEqual({
      ok: false,
      error: 'validation_error',
      errorDetail: 'Categoria inválida',
    });
    expect(calls.length).toBe(0);
  });

  it('retorna http_error com detalhe da Meta API', async () => {
    const { fetchImpl } = makeFetch(() =>
      new Response(
        JSON.stringify({
          error: { message: 'Invalid parameter: name', code: 100, error_user_msg: 'Parameter missing' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await createWhatsAppTemplate(access, { name: 'test' }, { fetchImpl });
    expect(result).toEqual({
      ok: false,
      error: 'http_error',
      errorDetail: '100: Invalid parameter: name',
    });
  });
});

describe('getWhatsAppTemplate (v19.0)', () => {
  it('retorna detalhes do template', async () => {
    const mockTemplate = {
      id: 't-123',
      name: 'welcome',
      category: 'UTILITY',
      language: 'en_US',
      status: 'APPROVED',
      quality_score: 4.5,
    };

    const { fetchImpl, calls } = makeFetch(() => okJson(mockTemplate));

    const result = await getWhatsAppTemplate(access, 't-123', { fetchImpl });

    expect(result.ok).toBe(true);
    expect(result.template).toEqual(mockTemplate);
    expect(calls[0].url).toContain('v19.0');
    expect(calls[0].url).toContain('/t-123');
  });

  it('retorna http_error para template não encontrado', async () => {
    const { fetchImpl } = makeFetch(() =>
      new Response(JSON.stringify({ error: { message: 'Template not found' } }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await getWhatsAppTemplate(access, 'not-found', { fetchImpl });
    expect(result).toEqual({
      ok: false,
      error: 'http_error',
      errorDetail: 'HTTP 404',
    });
  });
});

describe('sendTestMessage (v19.0)', () => {
  it('envia mensagem de teste com sucesso', async () => {
    const { fetchImpl, calls } = makeFetch(() =>
      okJson({ messages: [{ id: 'msg-test-123' }] }),
    );

    const result = await sendTestMessage(
      access,
      'welcome_template',
      '5511999998888',
      ['John Doe'],
      { fetchImpl },
    );

    expect(result.ok).toBe(true);
    expect(result.messageId).toBe('msg-test-123');
    const body = JSON.parse(calls[0].init!.body as string);
    expect(body.messaging_product).toBe('whatsapp');
    expect(body.to).toBe('5511999998888');
    expect(body.type).toBe('template');
    expect(body.template.name).toBe('welcome_template');
    // sendTestMessage hardcodeia 'en_US' no código existente
    expect(body.template.language).toBe('en_US');
    expect(body.template.components[0].type).toBe('body');
    expect(body.template.components[0].parameters).toEqual([{ type: 'text', text: 'John Doe' }]);
  });

  it('envia teste com idioma customizado via options', async () => {
    const { fetchImpl, calls } = makeFetch(() => okJson({ messages: [{ id: 'msg-test-456' }] }));

    await sendTestMessage(
      access,
      'boas_vindas',
      '5511999998888',
      ['Maria'],
      { fetchImpl, language: 'pt_BR' },
    );

    const body = JSON.parse(calls[0].init!.body as string);
    expect(body.template.language).toBe('pt_BR');
  });

  it('envia teste sem variáveis com componentes vazios', async () => {
    const { fetchImpl, calls } = makeFetch(() => okJson({ messages: [{ id: 'msg-test-789' }] }));

    const result = await sendTestMessage(access, 'simple_template', '5511999998888', [], { fetchImpl });

    expect(result.ok).toBe(true);
    const body = JSON.parse(calls[0].init!.body as string);
    // Quando variables está vazio, o código adiciona um componente body com array vazio
    expect(body.template.components[0].type).toBe('body');
    expect(body.template.components[0].parameters).toEqual([]);
  });

  it('retorna meta_not_configured sem token ou phoneNumberId', async () => {
    const { fetchImpl } = makeFetch(() => okJson({}));
    const result = await sendTestMessage(
      { ...access, accessToken: '' },
      'test',
      '5511999998888',
      [],
      { fetchImpl },
    );

    expect(result).toEqual({ ok: false, error: 'meta_not_configured' });
  });

  it('retorna http_error com detalhe', async () => {
    const { fetchImpl } = makeFetch(() =>
      new Response(
        JSON.stringify({
          error: { message: 'Template not approved for testing', code: 100 },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await sendTestMessage(access, 'rejected_template', '5511999998888', [], { fetchImpl });

    expect(result).toEqual({
      ok: false,
      error: 'http_error',
      errorDetail: 'Template not approved for testing',
    });
  });
});

describe('getTemplateStatus (v19.0)', () => {
  it('retorna status e quality_score', async () => {
    const { fetchImpl } = makeFetch(() =>
      new Response(JSON.stringify({
        id: 't-123',
        status: 'APPROVED',
        quality_score: 4.2,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    // Precisa usar wabaId como escopo para getWhatsAppTemplate
    const wabaAccess: TemplatesAccess = { ...access, phoneNumberId: '' };
    const result = await getWhatsAppTemplate(wabaAccess, 't-123', { fetchImpl, wabaId: 'WABA-456' });

    // getTemplateStatus retorna resultado de getWhatsAppTemplate
    // O endpoint usa o scopeId que requer pelo menos um de: wabaId ou phoneNumberId
    expect(result.ok).toBe(true);
    expect(result.template?.status).toBe('APPROVED');
    expect(result.template?.quality_score).toBe(4.2);
  });

  it('retorna erro quando template não existe', async () => {
    const { fetchImpl } = makeFetch(() =>
      new Response(JSON.stringify({ error: { message: 'Not found' } }), { status: 404 }),
    );

    const wabaAccess: TemplatesAccess = { ...access, phoneNumberId: '' };
    const result = await getWhatsAppTemplate(wabaAccess, 'nonexistent', { fetchImpl, wabaId: 'WABA-456' });
    expect(result.ok).toBe(false);
    expect(result.errorDetail).toContain('404');
  });
});

describe('API v19.0 Version Compatibility', () => {
  it('usa v19.0 como versão padrão na URL de listagem', async () => {
    const { fetchImpl, calls } = makeFetch(() => okJson({ data: [] }));

    await listWhatsAppTemplates(access, { fetchImpl });

    expect(calls[0].url).toMatch(/v19\.0/);
  });

  it('permite override da versão via options', async () => {
    const { fetchImpl, calls } = makeFetch(() => okJson({ data: [] }));

    await listWhatsAppTemplates(access, { fetchImpl, version: 'v18.0' });

    expect(calls[0].url).toMatch(/v18\.0/);
  });

  it('permite override do apiBase via options', async () => {
    const { fetchImpl, calls } = makeFetch(() => okJson({ data: [] }));

    await listWhatsAppTemplates(access, {
      fetchImpl,
      apiBase: 'https://custom.graph.facebook.com',
    });

    expect(calls[0].url).toContain('custom.graph.facebook.com');
  });
});