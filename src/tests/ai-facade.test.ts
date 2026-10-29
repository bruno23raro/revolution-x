// FASE 18 — Testes do facade (§13/§16): auto-modo determinístico + fallback +
// honestidade quando nada está configurado. Dados sintéticos, sem rede.

import { buildAiProviders, generateWithFallback, selectModelForTask } from '@/ai';
import { buildGeminiProvider } from '@/ai';
import type { AiProvider } from '@/ai';

// ── Auto-modo: DETERMINÍSTICO ────────────────────────────────────────────────

describe('selectModelForTask', () => {
  const models: import('@/ai').AiModel[] = [
    { id: 'small', contextWindow: 4096, capabilities: ['chat'] },
    { id: 'medium', contextWindow: 32768, capabilities: ['chat', 'code'] },
    { id: 'big', contextWindow: 1000000, capabilities: ['chat', 'long_context', 'reasoning'] },
  ];

  it('nenhum modelo atende ao filtro duro → null', () => {
    expect(selectModelForTask(models, 'x', { requiredCapabilities: ['vision'] })).toBeNull();
  });

  it('tarefa curta escolhe a janela menor (custo)', () => {
    const r = selectModelForTask(models, 'olá', { contextEstimateTokens: 100 });
    expect(r?.id).toBe('small');
  });

  it('tarefa longa escolhe a janela maior', () => {
    const r = selectModelForTask(models, 'analise longa', { contextEstimateTokens: 200000 });
    expect(r?.id).toBe('big');
  });

  it('preferModelIds restringe o pool', () => {
    const r = selectModelForTask(models, 'x', { preferModelIds: ['medium'] });
    expect(r?.id).toBe('medium');
  });

  it('capacidade soft influencia (code) mas não elimina', () => {
    const r = selectModelForTask(models, 'escreva um código', { contextEstimateTokens: 100 });
    expect(r?.id).toBe('medium'); // medium tem code; small não tem
  });

  it('determinismo: mesma entrada → mesma escolha', () => {
    const a = selectModelForTask(models, 'raciocinar sobre o plano', { contextEstimateTokens: 50000 });
    const b = selectModelForTask(models, 'raciocinar sobre o plano', { contextEstimateTokens: 50000 });
    expect(a).toEqual(b);
  });
});

// ── Fallback: cadeia de provedores ───────────────────────────────────────────

function fakeGeminiOk(text: string): AiProvider {
  const p = buildGeminiProvider({ apiKey: 'k' });
  return {
    ...p,
    generate: async (req) => ({ text, model: req.model ?? 'gemini-1.5-flash' }),
  };
}

describe('generateWithFallback', () => {
  it('nenhum provedor configurado → BLOQUEADO honesto', async () => {
    const emptyProviders: import('@/ai').AiProvider[] = [];
    const r = await generateWithFallback({
      providers: emptyProviders,
      request: { prompt: 'x' },
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('BLOQUEADO');
  });

  it('provisor único ok', async () => {
    const r = await generateWithFallback({
      providers: [fakeGeminiOk('hi')],
      request: { prompt: 'x' },
    });
    expect(r).toMatchObject({ ok: true, text: 'hi', provider: 'gemini', fallbackUsed: false });
  });

  it('fallback: primeiro falha, segundo assume (fallbackUsed=true)', async () => {
    const fail: AiProvider = {
      id: 'fail',
      name: 'fail',
      configured: true,
      listModels: async () => ({ models: [], source: 'fallback', fetchedAt: Date.now() }),
      generate: async () => {
        throw new Error('boom');
      },
    };
    const ok = fakeGeminiOk('ok');
    const r = await generateWithFallback({
      providers: [fail, ok],
      request: { prompt: 'x' },
    });
    expect(r).toMatchObject({ ok: true, text: 'ok', provider: 'gemini', fallbackUsed: true });
  });

  it('todos falham → ok=false + erro legível', async () => {
    const fail: AiProvider = {
      id: 'fail',
      name: 'fail',
      configured: true,
      listModels: async () => ({ models: [], source: 'fallback', fetchedAt: Date.now() }),
      generate: async () => {
        throw new Error('boom');
      },
    };
    const r = await generateWithFallback({
      providers: [fail],
      request: { prompt: 'x' },
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('boom');
  });
});