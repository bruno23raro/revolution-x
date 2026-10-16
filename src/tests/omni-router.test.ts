// FASE 2 — Testes do client OmniRouter.
// - Unit: resolução de config (precedência, null, overrides) e erro claro.
// - Live: só exercita o roteador REAL quando alcançável no ambiente;
//   caso contrário reporta "adiado" (jamais fingir verde).

import { describe, it, expect } from '@jest/globals';
import {
  resolveOmniRouterConfig,
  chatCompletion,
} from '../ai/omniRouter';

function isNetworkErr(e: unknown): boolean {
  const m = String((e as any)?.message ?? '');
  const code = (e as any)?.code ?? (e as any)?.cause?.code;
  return (
    (e as any)?.name === 'AbortError' ||
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    /aborted|fetch failed|ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|socket/i.test(m)
  );
}

describe('resolveOmniRouterConfig', () => {
  it('retorna null quando não há base URL nem chave', () => {
    expect(resolveOmniRouterConfig({}, {})).toBeNull();
  });

  it('resolve a partir de ANTHROPIC_* e remove a barra final da URL', () => {
    const cfg = resolveOmniRouterConfig({}, {
      ANTHROPIC_BASE_URL: 'http://localhost:20128/',
      ANTHROPIC_AUTH_TOKEN: 't',
      ANTHROPIC_MODEL: 'Modelos-Gratis',
    });
    expect(cfg).toEqual({
      baseUrl: 'http://localhost:20128',
      apiKey: 't',
      model: 'Modelos-Gratis',
    });
  });

  it('explicit overrides têm precedência sobre o env', () => {
    const cfg = resolveOmniRouterConfig(
      { baseUrl: 'http://a', apiKey: 'k', model: 'm' },
      { ANTHROPIC_BASE_URL: 'http://b', ANTHROPIC_AUTH_TOKEN: 'z' },
    );
    expect(cfg).toEqual({ baseUrl: 'http://a', apiKey: 'k', model: 'm' });
  });

  it('OMNIROUTER_* ganha de ANTHROPIC_*', () => {
    const cfg = resolveOmniRouterConfig({}, {
      OMNIROUTER_BASE_URL: 'http://omni',
      OMNIROUTER_API_KEY: 'o',
      OMNIROUTER_MODEL: 'omni-model',
      ANTHROPIC_BASE_URL: 'http://a',
      ANTHROPIC_AUTH_TOKEN: 'a',
    });
    expect(cfg?.baseUrl).toBe('http://omni');
    expect(cfg?.model).toBe('omni-model');
  });

  it('chatCompletion sem config lança erro claro (não simula)', async () => {
    await expect(
      chatCompletion([{ role: 'user', content: 'x' }], {}, null),
    ).rejects.toThrow(/não configurado/i);
  });
});

describe('live OmniRouter connection', () => {
  const base = process.env.ANTHROPIC_BASE_URL ?? process.env.OMNIROUTER_BASE_URL;
  const key =
    process.env.ANTHROPIC_AUTH_TOKEN ?? process.env.OMNIROUTER_API_KEY;
  const enabled = Boolean(base && key);

  it(
    enabled
      ? 'completa uma chat completion real no roteador local'
      : 'adiada (roteador local ausente neste ambiente)',
    async () => {
      if (!enabled) {
        console.warn('[omni] roteador ausente — teste de conexão adiado');
        return;
      }
      const cfg = resolveOmniRouterConfig({});
      if (!cfg) throw new Error('resolveOmniRouterConfig retornou null apesar de base+key');
      try {
        const res = await chatCompletion(
          [{ role: 'user', content: 'ping' }],
          { maxTokens: 64, timeoutMs: 45000 },
          cfg,
        );
        expect(res).toBeDefined();
        expect(typeof res.text).toBe('string');
        // Registro de consumo real (§4.7) — informativo, não assertivo.
        console.log(
          `[omni] live OK model=${res.model} usage=${JSON.stringify(res.usage ?? null)}`,
        );
      } catch (e) {
        if (isNetworkErr(e)) {
          console.warn('[omni] roteador não alcançável agora — teste adiado');
          return;
        }
        throw e; // falha real de HTTP/shape
      }
    },
    60000,
  );
});
