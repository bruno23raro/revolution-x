// FASE 3 · slice 2 — Auto-reply do chatbot: compõe config (injetável) +
// motor puro + sender (injetável ou Cloud API oficial com credencial fake).
// Nada lança: sempre devolve um resultado honesto (replied/skipReason).

import { maybeAutoReply } from '@/integrations/meta/chatbotAutoReply';
import type { ChatbotConfig } from '@/integrations/meta/whatsappChatbot';
import type { SendTextResult } from '@/integrations/meta/whatsappSender';

const CFG: ChatbotConfig = {
  enabled: true,
  rules: [{ matchType: 'keyword', pattern: 'preço', response: 'Planos a partir de R$99' }],
};

const okSend = async (to: string): Promise<SendTextResult> => ({
  ok: true,
  to,
  status: 'sent',
  messageId: 'wamid.1',
});

describe('maybeAutoReply', () => {
  it('config habilitada + envio ok → replied (decisão de regra)', async () => {
    const calls: Array<[string, string, string[] | undefined]> = [];
    const r = await maybeAutoReply('org1', '5511', 'qual o preço?', {}, {
      loadConfig: async () => CFG,
      send: async (to, body, quickReplies) => {
        calls.push([to, body, quickReplies]);
        return okSend(to);
      },
    });
    expect(r.replied).toBe(true);
    expect(r.source).toBe('rule');
    expect(r.skipReason).toBeUndefined();
    expect(r.send?.ok).toBe(true);
    expect(calls).toEqual([['5511', 'Planos a partir de R$99', undefined]]);
  });

  it('config nula ou desligada → not_enabled (envio jamais chamado)', async () => {
    let sent = 0;
    const send = async (to: string) => {
      sent++;
      return okSend(to);
    };
    const a = await maybeAutoReply('org1', '5511', 'oi', {}, {
      loadConfig: async () => null,
      send,
    });
    expect(a.replied).toBe(false);
    expect(a.skipReason).toBe('not_enabled');
    const b = await maybeAutoReply('org1', '5511', 'oi', {}, {
      loadConfig: async () => ({ enabled: false, rules: [] }),
      send,
    });
    expect(b.skipReason).toBe('not_enabled');
    expect(sent).toBe(0);
  });

  it('decisão sem texto (só quickReplies) → no_response, sem envio', async () => {
    const cfg: ChatbotConfig = {
      enabled: true,
      rules: [],
      steps: [{ id: 'a', quickReplies: ['Sim'] }],
    };
    let sent = 0;
    const r = await maybeAutoReply('org1', '5511', 'oi', {}, {
      loadConfig: async () => cfg,
      send: async (to) => {
        sent++;
        return okSend(to);
      },
    });
    expect(r.replied).toBe(false);
    expect(r.skipReason).toBe('no_response');
    expect(r.source).toBe('step');
    expect(sent).toBe(0);
  });

  it('falha de envio → send_failed com o resultado do sender', async () => {
    const r = await maybeAutoReply('org1', '5511', 'preço', {}, {
      loadConfig: async () => CFG,
      send: async (to) => ({ ok: false, to, error: 'meta_not_configured', status: 'failed' }),
    });
    expect(r.replied).toBe(false);
    expect(r.skipReason).toBe('send_failed');
    expect(r.send?.error).toBe('meta_not_configured');
  });

  it('sem client e sem loadConfig → config_unavailable', async () => {
    const r = await maybeAutoReply('org1', '5511', 'oi');
    expect(r).toEqual({ replied: false, skipReason: 'config_unavailable' });
  });

  it('exceção interna → error (nunca lança)', async () => {
    const r = await maybeAutoReply('org1', '5511', 'oi', {}, {
      loadConfig: async () => {
        throw new Error('db down');
      },
    });
    expect(r).toEqual({ replied: false, skipReason: 'error' });
  });

  it('sender padrão: credencial ausente → meta_not_configured honesto (sem segredo no detalhe)', async () => {
    const fakeServiceRole = {
      from: () => ({
        select: () => ({
          eq: () => ({
            in: () => ({
              neq: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
    };
    const r = await maybeAutoReply('org1', '5511', 'preço', {}, {
      loadConfig: async () => CFG,
      resolveAccessDeps: { serviceRole: fakeServiceRole },
    });
    expect(r.replied).toBe(false);
    expect(r.skipReason).toBe('send_failed');
    expect(r.send?.error).toBe('meta_not_configured');
    expect(r.send?.errorDetail).toBe('meta access: not_connected');
  });
});
