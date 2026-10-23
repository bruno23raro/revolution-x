// FASE 18 — Testes dos provedores de IA (§13/§16). Dados SINTÉTICOS: cada
// provedor recebe um `fetchImpl` fake. Nenhum request real, nenhuma rede, nenhuma
// chava real (§16: mocks). A descoberta/geração são testáveis sem sair do sandbox.

import { buildAiProviders, buildGeminiProvider, buildOmniProvider } from '@/ai';
import type { AiProvider } from '@/ai';

// ── Gemini: descoberta com fetchImpl fake ─────────────────────────────────────

describe('buildGeminiProvider', () => {
  it('configured=false sem chave → listModels devolve none', async () => {
    const p = buildGeminiProvider({ env: {} });
    expect(p.configured).toBe(false);
    const r = await p.listModels();
    expect(r.source).toBe('none');
    expect(r.models).toEqual([]);
  });

  it('descobre modelos reais via /v1beta/models (chave no header, nunca no body)', async () => {
    const seen: { url: string; headers: Record<string, string>; body?: string }[] = [];
    const fetchImpl = jest.fn(async (url: string, init: RequestInit) => {
      seen.push({ url, headers: (init.headers as Record<string, string>) });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          models: [
            {
              name: 'models/gemini-1.5-flash',
              displayName: 'Gemini 1.5 Flash',
              inputTokenLimit: 1000000,
              inputModalities: ['text', 'image'],
            },
            { name: 'models/gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', inputTokenLimit: 2000000 },
          ],
        }),
      } as unknown as Response;
    });
    const p = buildGeminiProvider({ apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(p.configured).toBe(true);
    const r = await p.listModels();
    expect(r.source).toBe('api');
    expect(r.models.map((m) => m.id)).toEqual(['gemini-1.5-flash', 'gemini-1.5-pro']);
    expect(r.models[0].capabilities).toContain('vision');
    expect(r.models[0].capabilities).toContain('long_context');
    expect(r.models[1].capabilities).toContain('reasoning');
    expect(seen[0].url).toBe('https://generativelanguage.googleapis.com/v1beta/models');
    expect(seen[0].headers['x-goog-api-key']).toBe('k');
  });

  it('HTTP não-200 → fallback honesto (não inventa lista)', async () => {
    const fetchImpl = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({}) } as Response));
    const p = buildGeminiProvider({ apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch });
    const r = await p.listModels();
    expect(r.source).toBe('fallback');
    expect(r.models[0].id).toBe('gemini-1.5-flash');
  });

  it('gera via :generateContent e devolve uso real', async () => {
    const fetchImpl = jest.fn(async (url: string, init: RequestInit) => {
      expect(url).toContain(':generateContent');
      expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('k');
      const body = JSON.parse(init.body as string);
      expect(body.contents[0].parts[0].text).toBe('Oi');
      expect(body.systemInstruction.parts[0].text).toBe('sys');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Olá mundo' }] } }],
          usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2, totalTokenCount: 5 },
        }),
      } as unknown as Response;
    });
    const p = buildGeminiProvider({ apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch });
    const res = await p.generate({ prompt: 'Oi', system: 'sys', model: 'gemini-1.5-flash' });
    expect(res.text).toBe('Olá mundo');
    expect(res.model).toBe('gemini-1.5-flash');
    expect(res.usage).toEqual({ promptTokens: 3, completionTokens: 2, totalTokens: 5 });
  });

  it('erro 4xx firme é lançado (não degenera em fallback silencioso)', async () => {
    const fetchImpl = jest.fn(async () => ({ ok: false, status: 401, text: async () => 'nope' } as unknown as Response));
    const p = buildGeminiProvider({ apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(p.generate({ prompt: 'x' })).rejects.toThrow(/401/);
  });
});

// ── OmniRouter: configurado / não configurado ────────────────────────────────

describe('buildOmniProvider', () => {
  it('configured=false sem base URL + key', () => {
    const p = buildOmniProvider({ env: {} });
    expect(p.configured).toBe(false);
  });

  it('configured=true com base URL + key', () => {
    const p = buildOmniProvider({ env: { OMNIROUTER_BASE_URL: 'http://x', OMNIROUTER_API_KEY: 'k' } });
    expect(p.configured).toBe(true);
  });
});

// ── Registry: ordem do fallback ──────────────────────────────────────────────

describe('buildAiProviders', () => {
  it('ordem default omni, gemini', () => {
    const ps = buildAiProviders({ env: {} });
    expect(ps.map((p) => p.id)).toEqual(['omni', 'gemini']);
  });

  it('ordem customizada respeitada', () => {
    const ps = buildAiProviders({ env: {}, order: ['gemini', 'omni'] });
    expect(ps.map((p) => p.id)).toEqual(['gemini', 'omni']);
  });

  it('nenhum provedor configurado sem creds', () => {
    const ps = buildAiProviders({ env: {} });
    expect(ps.every((p) => p.configured === false)).toBe(true);
  });
});