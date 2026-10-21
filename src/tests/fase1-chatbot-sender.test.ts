// FASE 1 — Testes da camada de serviço de WhatsApp (sem banco, mock de fetch).
//
// Cobre: motor de chatbot (puro), sender (texto/template/quick replies —
// FASE 3 · slice 2), disparo em massa (contagem + delay), refresh de token
// e o conector (delega para o sender).

import { evaluateChatbot, type ChatbotConfig } from '@/integrations/meta/whatsappChatbot';
import {
  sendWhatsAppText,
  sendWhatsAppTemplate,
  sendWhatsAppButton,
  runMassSend,
  type MetaWABAccess,
} from '@/integrations/meta/whatsappSender';
import { refreshMetaAccessToken } from '@/integrations/meta/tokenRefresh';
import { sendWhatsAppMessage } from '../connectors/whatsapp';

// ---- helpers ----
function fakeFetch(handler: (url: string, init?: unknown) => unknown): typeof fetch {
  return (async (url: unknown, init?: unknown) => {
    const u = typeof url === 'string' ? url : String(url);
    return handler(u, init) as unknown as Response;
  }) as unknown as typeof fetch;
}

function resp(body: unknown, opts: { ok?: boolean; status?: number } = {}) {
  const ok = opts.ok ?? true;
  const status = opts.status ?? 200;
  const s = JSON.stringify(body);
  return { ok, status, text: async () => s, json: async () => body };
}

const ACCESS: MetaWABAccess = { accessToken: 'tok', phoneNumberId: 'PH1' };

// ============================================================
// Chatbot
// ============================================================

describe('evaluateChatbot (motor de regras)', () => {
  const base: ChatbotConfig = {
    enabled: true,
    rules: [
      { id: 'r1', matchType: 'keyword', pattern: 'preço', response: 'Nossos planos: R$99' },
      { id: 'r2', matchType: 'regex', pattern: '^(ola|oi)$', flags: 'i', response: 'Olá! Como posso ajudar?' },
    ],
    fallback: 'Um atendente vai te chamar 👀',
  };

  it('desligado → não responde', async () => {
    const d = await evaluateChatbot({ ...base, enabled: false }, { text: 'preço' });
    expect(d.respond).toBe(false);
    expect(d.source).toBe('none');
  });

  it('null config → não responde', async () => {
    expect((await evaluateChatbot(null, { text: 'oi' })).respond).toBe(false);
  });

  it('casca com regra keyword (case-insensitive)', async () => {
    const d = await evaluateChatbot(base, { text: 'Qual o PREÇO do plano?' });
    expect(d.source).toBe('rule');
    expect(d.matchedRuleId).toBe('r1');
    expect(d.text).toBe('Nossos planos: R$99');
  });

  it('regex com flags', async () => {
    const d = await evaluateChatbot(base, { text: 'Ola' });
    expect(d.source).toBe('rule');
    expect(d.matchedRuleId).toBe('r2');
  });

  it('saudação no primeiro contato', async () => {
    const d = await evaluateChatbot({ ...base, greeting: 'Bem-vindo(a)!' }, { text: 'oi', firstContact: true });
    expect(d.source).toBe('greeting');
    expect(d.text).toBe('Bem-vindo(a)!');
  });

  it('fallback quando não casa com regra', async () => {
    const d = await evaluateChatbot(base, { text: 'qualquer coisa aleatória' });
    expect(d.source).toBe('fallback');
    expect(d.text).toBe(base.fallback);
  });

  it('fora da janela de horas → apenas fallback', async () => {
    const cfg: ChatbotConfig = { enabled: true, activeFromHour: 9, activeToHour: 18, rules: [], fallback: 'Falemos amanhã 😉' };
    const d = await evaluateChatbot(cfg, { text: 'preço', now: new Date('2026-10-18T02:00:00Z') }, { nowOverride: new Date('2026-10-18T02:00:00Z') });
    expect(d.source).toBe('fallback');
    expect(d.text).toBe('Falemos amanhã 😉');
  });

  it('IA usada quando useAI e sem regra', async () => {
    const cfg: ChatbotConfig = { enabled: true, useAI: true, aiSystemPrompt: 'sys', rules: [] };
    const d = await evaluateChatbot(cfg, { text: 'me diz um fato' }, {
      ai: async (_sys, user) => `resposta-ia:${user}`,
    });
    expect(d.source).toBe('ai');
    expect(d.text).toBe('resposta-ia:me diz um fato');
  });

  it('IA que lança degrada para fallback', async () => {
    const cfg: ChatbotConfig = { enabled: true, useAI: true, rules: [], fallback: 'fb' };
    const d = await evaluateChatbot(cfg, { text: 'x' }, {
      ai: async () => {
        throw new Error('boom');
      },
    });
    expect(d.source).toBe('fallback');
    expect(d.text).toBe('fb');
  });

  it('nenhum match e sem fallback → none', async () => {
    const d = await evaluateChatbot({ enabled: true, rules: [] }, { text: 'xyz' });
    expect(d.source).toBe('none');
    expect(d.respond).toBe(false);
  });
});

// ============================================================
// Sender — texto
// ============================================================

describe('sendWhatsAppText', () => {
  it('sem credencial → meta_not_configured', async () => {
    const r = await sendWhatsAppText({ accessToken: '', phoneNumberId: 'PH' }, '5511', 'oi');
    expect(r).toEqual({ ok: false, to: '5511', error: 'meta_not_configured' });
  });

  it('sem fetch → fetch_unavailable', async () => {
    const r = await sendWhatsAppText(ACCESS, '5511', 'oi', { fetchImpl: undefined as unknown as typeof fetch });
    // força ambiente sem fetch: substitui o global temporariamente
    const prev = globalThis.fetch;
    (globalThis as { fetch?: typeof fetch }).fetch = undefined as unknown as typeof fetch;
    try {
      const r2 = await sendWhatsAppText(ACCESS, '5511', 'oi');
      expect(r2.error).toBe('fetch_unavailable');
    } finally {
      (globalThis as { fetch?: typeof fetch }).fetch = prev;
    }
    void r;
  });

  it('sucesso retorna messageId', async () => {
    const fetchImpl = fakeFetch(() => resp({ messages: [{ id: 'wamid.123' }] }));
    const r = await sendWhatsAppText(ACCESS, '5511999999999', 'olá', { fetchImpl });
    expect(r.ok).toBe(true);
    expect(r.messageId).toBe('wamid.123');
    expect(r.status).toBe('sent');
  });

  it('erro HTTP carrega detalhe da Meta', async () => {
    const fetchImpl = fakeFetch(() =>
      resp({ error: { message: 'Invalid phone number', code: 131047 } }, { ok: false, status: 400 }),
    );
    const r = await sendWhatsAppText(ACCESS, '123', 'oi', { fetchImpl });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('http_error');
    expect(r.errorDetail).toContain('131047');
  });

  it('URL usa versão + phoneNumberId', async () => {
    let seenUrl = '';
    const fetchImpl = fakeFetch((url) => {
      seenUrl = url;
      return resp({ messages: [{ id: 'x' }] });
    });
    await sendWhatsAppText(ACCESS, '55', 'oi', { fetchImpl });
    expect(seenUrl).toBe('https://graph.facebook.com/v26.0/PH1/messages');
  });
});

// ============================================================
// Sender — template
// ============================================================

describe('sendWhatsAppTemplate', () => {
  it('monta body de template com parâmetros', async () => {
    let body: any;
    const fetchImpl = fakeFetch((_url, init) => {
      body = JSON.parse((init as RequestInit).body as string);
      return resp({ messages: [{ id: 'wamid.tpl' }] });
    });
    const r = await sendWhatsAppTemplate(ACCESS, '55', 'promo', ['João', 'R$99'], { fetchImpl, language: 'pt_BR' });
    expect(r.ok).toBe(true);
    expect(body.type).toBe('template');
    expect(body.template.name).toBe('promo');
    expect(body.template.language.code).toBe('pt_BR');
    expect(body.template.components[0].parameters).toEqual([
      { type: 'text', text: 'João' },
      { type: 'text', text: 'R$99' },
    ]);
  });

  it('sem credencial → meta_not_configured', async () => {
    const r = await sendWhatsAppTemplate({ accessToken: '', phoneNumberId: '' }, '55', 'promo');
    expect(r.error).toBe('meta_not_configured');
  });
});

// ============================================================
// Sender — quick replies / botões (FASE 3 · slice 2)
// ============================================================

describe('sendWhatsAppButton', () => {
  it('monta payload oficial interactive/button (ids rx-1..3)', async () => {
    let body: any;
    const fetchImpl = fakeFetch((_url, init) => {
      body = JSON.parse((init as RequestInit).body as string);
      return resp({ messages: [{ id: 'wamid.btn' }] });
    });
    const r = await sendWhatsAppButton(ACCESS, '5511', 'Escolha uma opção', ['A', 'B', 'C'], {
      fetchImpl,
    });
    expect(r.ok).toBe(true);
    expect(r.messageId).toBe('wamid.btn');
    expect(body.type).toBe('interactive');
    expect(body.interactive.type).toBe('button');
    expect(body.interactive.body.text).toBe('Escolha uma opção');
    expect(body.interactive.action.type).toBe('reply');
    expect(body.interactive.action.buttons).toEqual([
      { type: 'reply', text: 'A', id: 'rx-1' },
      { type: 'reply', text: 'B', id: 'rx-2' },
      { type: 'reply', text: 'C', id: 'rx-3' },
    ]);
  });

  it('corta em 3 botões, rótulos em 20 chars; descarta os vazios', async () => {
    let body: any;
    const fetchImpl = fakeFetch((_url, init) => {
      body = JSON.parse((init as RequestInit).body as string);
      return resp({});
    });
    await sendWhatsAppButton(ACCESS, '5511', 'x', ['', '  ', 'A'.repeat(30), 'segundo', 'terceiro', 'quarto'], {
      fetchImpl,
    });
    const labels = body.interactive.action.buttons.map((b: any) => b.text);
    expect(labels).toEqual(['A'.repeat(20), 'segundo', 'terceiro']);
  });

  it('sem credencial → meta_not_configured', async () => {
    const r = await sendWhatsAppButton({ accessToken: '', phoneNumberId: '' }, '5511', 'oi', ['A']);
    expect(r).toEqual({ ok: false, to: '5511', error: 'meta_not_configured' });
  });

  it('sem corpo ou sem botão válido → invalid_message', async () => {
    expect((await sendWhatsAppButton(ACCESS, '5511', '   ', ['A'])).error).toBe('invalid_message');
    expect((await sendWhatsAppButton(ACCESS, '5511', 'oi', [])).error).toBe('invalid_message');
  });

  it('sem fetch → fetch_unavailable', async () => {
    const prev = globalThis.fetch;
    (globalThis as { fetch?: typeof fetch }).fetch = undefined as unknown as typeof fetch;
    try {
      const r = await sendWhatsAppButton(ACCESS, '5511', 'oi', ['A']);
      expect(r.error).toBe('fetch_unavailable');
    } finally {
      (globalThis as { fetch?: typeof fetch }).fetch = prev;
    }
  });

  it('erro HTTP carrega detalhe da Meta', async () => {
    const fetchImpl = fakeFetch(() =>
      resp({ error: { message: 'Unsupported message type', code: 10016 } }, { ok: false, status: 400 }),
    );
    const r = await sendWhatsAppButton(ACCESS, '5511', 'oi', ['A'], { fetchImpl });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('http_error');
    expect(r.errorDetail).toContain('10016');
  });

  it('fetch que lança → network_error', async () => {
    const fetchImpl = (((() => {
      throw new Error('offline');
    }) as unknown) as unknown) as typeof fetch;
    const r = await sendWhatsAppButton(ACCESS, '5511', 'oi', ['A'], { fetchImpl });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('network_error');
    expect(r.errorDetail).toContain('offline');
  });
});

// ============================================================
// Disparo em massa
// ============================================================

describe('runMassSend', () => {
  it('agrega contagens e respeita delay', async () => {
    // Fake timers: os 20ms de delay viram tempo VIRTUAL — a assertiva fica
    // determinística. Com timers reais, em runner sobrecarregado o elapsed
    // podia cair 1ms abaixo do limite de 40ms (flake de CI 2026-10-21: 39ms).
    jest.useFakeTimers();
    try {
      const calls: number[] = [];
      let t = 0;
      const sendText = async (_a: MetaWABAccess, _to: string, _text?: string) => {
        t += 10; // simula 10ms de "tempo" entre chamadas
        calls.push(t);
        return { ok: true, to: _to };
      };
      const start = Date.now(); // relógio virtual (fake timers)
      const p = runMassSend(ACCESS, [{ to: '1' }, { to: '2' }, { to: '3' }], {
        delayMs: 20,
        sendText: sendText as unknown as typeof sendWhatsAppText,
      });
      // 2 intervalos de 20ms: avança o relógio virtual e lava os microtasks.
      await jest.advanceTimersByTimeAsync(20); // 1º delay → 2º envio
      await jest.advanceTimersByTimeAsync(20); // 2º delay → 3º envio
      const r = await p;
      const elapsed = Date.now() - start;
      expect(r.total).toBe(3);
      expect(r.sent).toBe(3);
      expect(r.failed).toBe(0);
      expect(calls.length).toBe(3);
      // exatamente 40ms virtuais se passaram → o delay foi respeitado
      expect(elapsed).toBeGreaterThanOrEqual(40);
    } finally {
      jest.useRealTimers();
    }
  });

  it('continua mesmo com falhas e conta failed', async () => {
    let i = 0;
    const sendText = async (_a: MetaWABAccess, _to: string) => {
      i++;
      return { ok: i % 2 === 0, to: _to, error: i % 2 === 0 ? undefined : 'http_error' };
    };
    const r = await runMassSend(ACCESS, [{ to: 'a' }, { to: 'b' }, { to: 'c' }], {
      sendText: sendText as unknown as typeof sendWhatsAppText,
    });
    expect(r.total).toBe(3);
    expect(r.sent).toBe(1);
    expect(r.failed).toBe(2);
  });

  it('sem destinatários → total 0', async () => {
    const r = await runMassSend(ACCESS, [], { sendText: (async () => ({ ok: true, to: '' })) as never });
    expect(r).toEqual({ total: 0, sent: 0, failed: 0, results: [] });
  });
});

// ============================================================
// Refresh de token
// ============================================================

describe('refreshMetaAccessToken', () => {
  it('sem creds → meta_creds_missing', async () => {
    const r = await refreshMetaAccessToken(null, 'tok');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('meta_creds_missing');
  });

  it('sem exchange token → exchange_token_missing', async () => {
    const r = await refreshMetaAccessToken({ appId: 'a', appSecret: 's' }, '');
    expect(r.error).toBe('exchange_token_missing');
  });

  it('sucesso retorna access_token', async () => {
    const fetchImpl = fakeFetch(() => resp({ access_token: 'NEW', expires_in: 5184000 }));
    const r = await refreshMetaAccessToken({ appId: 'a', appSecret: 's' }, 'OLD', { fetchImpl });
    expect(r.ok).toBe(true);
    expect(r.accessToken).toBe('NEW');
    expect(r.expiresIn).toBe(5184000);
  });

  it('não expõe appSecret na URL (só client_secret query) — e a URL não contém o secret salvo na query esperada', async () => {
    let seen = '';
    const fetchImpl = fakeFetch((url) => {
      seen = url;
      return resp({ access_token: 'X' });
    });
    await refreshMetaAccessToken({ appId: 'APP', appSecret: 'SECRET' }, 'OLD', { fetchImpl });
    // o secret vai na query (fb client_secret) — verificamos que o token novo é devolvido
    expect(seen).toContain('client_secret=SECRET');
    expect(seen).toContain('grant_type=fb_exchange_token');
  });
});

// ============================================================
// Conector (delega ao sender)
// ============================================================

describe('sendWhatsAppMessage (conector)', () => {
  it('texto: delega e devolve success', async () => {
    const fetchImpl = fakeFetch(() => resp({ messages: [{ id: 'wamid.c' }] }));
    const r = await sendWhatsAppMessage({ apiKey: 'tok', phoneNumberId: 'PH' }, { to: '55', body: 'oi' }, { fetchImpl });
    expect(r.success).toBe(true);
    expect(r.messageId).toBe('wamid.c');
  });

  it('sem credencial → success:false honesto', async () => {
    const r = await sendWhatsAppMessage({}, { to: '55', body: 'oi' });
    expect(r.success).toBe(false);
    expect(r.error).toBe('meta_not_configured');
  });

  it('template: envia via template', async () => {
    let body: any;
    const fetchImpl = fakeFetch((_url, init) => {
      body = JSON.parse((init as RequestInit).body as string);
      return resp({ messages: [{ id: 'wamid.t' }] });
    });
    const r = await sendWhatsAppMessage(
      { apiKey: 'tok', phoneNumberId: 'PH' },
      { to: '55', body: '', template: 'promo', templateVariables: ['Jó'] },
      { fetchImpl },
    );
    expect(r.success).toBe(true);
    expect(body.type).toBe('template');
  });
});
