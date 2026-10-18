// FASE 3 · slice 3 — Executores de saída (n8n / Zapier / Make / webhook genérico).
//
// O serviço é TS puro com fetch injetável: todos os testes rodam SEM rede,
// espionando `fetchImpl` e verificando alvo, headers (incl. assinatura
// HMAC-SHA256), envelope de evento e degradação honesta (timeout/rede/HTTP).

import {
  executeOutbound,
  hmacSha256Hex,
  resolveOutboundTarget,
} from './outboundExecutors';

const NOW = () => new Date('2026-10-18T12:00:00.000Z');

interface Call {
  url: string;
  init: RequestInit & { headers?: Record<string, string> };
}

function spyFetch(status = 200): { calls: Call[]; fetchImpl: typeof fetch } {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init: (init ?? {}) as Call['init'] });
    return new Response('{}', { status, headers: { 'Content-Type': 'application/json' } }) as unknown as Response;
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

describe('resolveOutboundTarget', () => {
  it('n8n: baseUrl + webhookPath → URL composta; apiKey vira X-Api-Key', () => {
    const t = resolveOutboundTarget('n8n', {
      baseUrl: 'https://n8n.suaempresa.com/',
      webhookPath: '/lead',
      apiKey: 'k1',
    });
    expect(t).toEqual({
      url: 'https://n8n.suaempresa.com/lead',
      headers: { 'X-Api-Key': 'k1' },
    });
  });

  it('n8n: sem webhookPath → not_configured (honesto, não inventa URL)', () => {
    const t = resolveOutboundTarget('n8n', { baseUrl: 'https://n8n.x' });
    expect('error' in t && t.error).toBe('not_configured');
    expect('error' in t && t.errorDetail).toContain('webhookPath');
  });

  it('zapier/make/webhook_outbound: URL inválida (ftp) → invalid_target', () => {
    for (const p of ['zapier', 'make', 'webhook_outbound'] as const) {
      const t = resolveOutboundTarget(p, { webhookUrl: 'ftp://x' });
      expect('error' in t && t.error).toBe('invalid_target');
    }
  });

  it('n8n: baseUrl não-http → invalid_target (não not_configured)', () => {
    const t = resolveOutboundTarget('n8n', { baseUrl: 'ftp://x', webhookPath: 'a' });
    expect('error' in t && t.error).toBe('invalid_target');
  });
});

describe('executeOutbound (sucesso)', () => {
  it('n8n: POST no alvo correto, envelope estruturado, sem segredo no corpo', async () => {
    const { calls, fetchImpl } = spyFetch();
    const r = await executeOutbound(
      'n8n',
      { baseUrl: 'https://n8n.local', webhookPath: 'lead' },
      'lead.created',
      { name: 'Zé' },
      { fetchImpl, now: NOW, organizationId: 'org1' },
    );
    expect(r).toEqual({ ok: true, provider: 'n8n', httpStatus: 200 });
    expect(calls[0].url).toBe('https://n8n.local/lead');
    const body = JSON.parse(String(calls[0].init.body));
    expect(body).toEqual({
      source: 'revolution-x',
      event: 'lead.created',
      payload: { name: 'Zé' },
      organizationId: 'org1',
      sentAt: '2026-10-18T12:00:00.000Z',
    });
    expect(calls[0].init.headers).not.toHaveProperty('X-Api-Key');
  });

  it('zapier: Catch Hook sem header de auth (a URL é o segredo)', async () => {
    const { calls, fetchImpl } = spyFetch();
    const r = await executeOutbound('zapier', { webhookUrl: 'https://hooks.zapier.com/hooks/catch/x' }, 't', {}, {
      fetchImpl,
      now: NOW,
    });
    expect(r.ok).toBe(true);
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Api-Key']).toBeUndefined();
  });

  it('make: com hmacKey assina o corpo (X-Hook-Signature verificável)', async () => {
    const { calls, fetchImpl } = spyFetch();
    const r = await executeOutbound('make', { webhookUrl: 'https://hook.make.com/x', hmacKey: 'chave' }, 't', {}, {
      fetchImpl,
      now: NOW,
    });
    expect(r.ok).toBe(true);
    const headers = calls[0].init.headers as Record<string, string>;
    const raw = String(calls[0].init.body);
    expect(headers['X-Hook-Signature']).toBe(`HMAC-SHA256:${hmacSha256Hex('chave', raw)}`);
  });

  it('make: sem hmacKey → nenhum header de assinatura (não inventa)', async () => {
    const { calls, fetchImpl } = spyFetch();
    await executeOutbound('make', { webhookUrl: 'https://hook.make.com/x' }, 't', {}, { fetchImpl, now: NOW });
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['X-Hook-Signature']).toBeUndefined();
  });

  it('webhook_outbound: secret assina em X-Webhook-Signature + organization no header', async () => {
    const { calls, fetchImpl } = spyFetch();
    const r = await executeOutbound(
      'webhook_outbound',
      { webhookUrl: 'https://api.minha.com/w', secret: 'segredo' },
      'deal.closed',
      { valor: 99 },
      { fetchImpl, now: NOW, organizationId: 'org9' },
    );
    expect(r.ok).toBe(true);
    const headers = calls[0].init.headers as Record<string, string>;
    const raw = String(calls[0].init.body);
    expect(headers['X-Webhook-Signature']).toBe(`sha256=${hmacSha256Hex('segredo', raw)}`);
    expect(headers['X-Webhook-Organization']).toBe('org9');
  });
});

describe('executeOutbound (falhas honestas)', () => {
  it('http_error: alvo responde 500 → ok:false com o status', async () => {
    const { fetchImpl } = spyFetch(500);
    const r = await executeOutbound('zapier', { webhookUrl: 'https://hooks.zapier.com/x' }, 't', {}, { fetchImpl, now: NOW });
    expect(r).toEqual({ ok: false, provider: 'zapier', httpStatus: 500, error: 'http_error', errorDetail: 'HTTP 500' });
  });

  it('network_error: fetch lança → error com a mensagem', async () => {
    const fetchImpl = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    const r = await executeOutbound('zapier', { webhookUrl: 'https://hooks.zapier.com/x' }, 't', {}, { fetchImpl, now: NOW });
    expect(r).toEqual({ ok: false, provider: 'zapier', error: 'network_error', errorDetail: 'offline' });
  });

  it('timeout: abort respeita o timeoutMs', async () => {
    const fetchImpl = (async (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('AbortError')));
      })) as unknown as typeof fetch;
    const r = await executeOutbound(
      'zapier',
      { webhookUrl: 'https://hooks.zapier.com/x' },
      't',
      {},
      { fetchImpl, now: NOW, timeoutMs: 50 },
    );
    expect(r.error).toBe('timeout');
    expect(r.errorDetail).toContain('50ms');
  });

  it('fetch_unavailable: sem fetch global nem injetado', async () => {
    const realFetch = (globalThis as Record<string, unknown>).fetch;
    try {
      (globalThis as Record<string, unknown>).fetch = undefined;
      const r = await executeOutbound('zapier', { webhookUrl: 'https://hooks.zapier.com/x' }, 't', {}, { now: NOW });
      expect(r).toEqual({
        ok: false,
        provider: 'zapier',
        error: 'fetch_unavailable',
        errorDetail: 'fetch indisponível neste ambiente',
      });
    } finally {
      (globalThis as Record<string, unknown>).fetch = realFetch;
    }
  });

  it('invalid_event: vazio, longo demais, ou payload não-objeto', async () => {
    const cfg = { webhookUrl: 'https://hooks.zapier.com/x' };
    const { fetchImpl } = spyFetch();
    expect((await executeOutbound('zapier', cfg, '', {}, { fetchImpl, now: NOW })).error).toBe('invalid_event');
    expect((await executeOutbound('zapier', cfg, 'x'.repeat(65), {}, { fetchImpl, now: NOW })).error).toBe(
      'invalid_event',
    );
    expect(
      (await executeOutbound('zapier', cfg, 'ok', undefined, { fetchImpl, now: NOW })).ok,
    ).toBe(true); // payload ausente vira {}
    const badPayload = (await executeOutbound('zapier', cfg, 'ok', (['x'] as unknown) as Record<string, unknown>, {
      fetchImpl,
      now: NOW,
    })).error;
    expect(badPayload).toBe('invalid_event');
  });

  it('payload_too_large: payload acima do teto é rejeitado', async () => {
    const { fetchImpl } = spyFetch();
    const big = { blob: 'a'.repeat(51_000) };
    const r = await executeOutbound('zapier', { webhookUrl: 'https://hooks.zapier.com/x' }, 't', big, {
      fetchImpl,
      now: NOW,
    });
    expect(r.error).toBe('payload_too_large');
  });

  it('config nula → not_configured (sem rede, sem segredo no detalhe)', async () => {
    const { fetchImpl } = spyFetch();
    const r = await executeOutbound('n8n', null, 't', {}, { fetchImpl, now: NOW });
    expect(r.error).toBe('not_configured');
    expect(JSON.stringify(r)).not.toContain('segredo');
  });
});
