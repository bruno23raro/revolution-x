// FASE 18 — Provedores de IA (§13): OmniRouter (gateway compatível-OpenAI) +
// Google Gemini (primeira opção de baixo custo). Registry EXTENSÍVEL: cada
// provedor é um objeto `AiProvider`; a ordem do array = ordem do fallback.
//
// Nenhum segredo é exposto: `configured` é booleano; `apiKey` vive apenas no
// backend (env / config criptografada) e vai somente no header das chamadas.
// `fetchImpl` é injetável (mesma seam de `src/integrations/providers.ts`) →
// descoberta e geração são testáveis com dados sintéticos, sem rede (§16).

import {
  resolveOmniRouterConfig,
  chatCompletion,
  type OmniRouterOverrides,
} from './omniRouter';
import type { AiModel, AiProvider, ModelCapability } from './aiTypes';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const OLLAMA_BASE = 'http://localhost:11434';

function pick(...alts: Array<string | undefined | null>): string | undefined {
  return alts.find((x): x is string => typeof x === 'string' && x.trim() !== '');
}

// ── Gemini: heurística DETERMINÍSTICA de capacidades a partir do que a API
//    expõe. Não inventa: só lê campos reais (inputModalities/limits).
function geminiCapabilities(m: AiModel): ModelCapability[] {
  const caps: ModelCapability[] = ['chat'];
  const id = m.id.toLowerCase();
  const input = (m.input ?? []).map((s) => s.toLowerCase());
  if (input.includes('image') || input.includes('image/png') || input.includes('image/jpeg')) {
    caps.push('vision');
  }
  if ((m.contextWindow ?? 0) >= 1_000_000) caps.push('long_context');
  if (id.includes('code')) caps.push('code');
  if (id.includes('thinking') || id.includes('pro')) caps.push('reasoning');
  return caps;
}

// ─────────────────────────── OMNIROUTER (gateway compatível-OpenAI) ────────

export function buildOmniProvider(opts: {
  overrides?: OmniRouterOverrides;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}): AiProvider {
  const env = opts.env ?? process.env;
  const cfg = resolveOmniRouterConfig(opts.overrides, env);
  const fetchImpl = opts.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);

  return {
    id: 'omni',
    name: 'OmniRouter (gateway compatível-OpenAI)',
    configured: cfg !== null,
    async listModels() {
      const now = Date.now();
      if (!cfg) return { models: [], source: 'none', fetchedAt: now };
      if (!fetchImpl) return { models: [{ id: cfg.model, name: cfg.model }], source: 'fallback', fetchedAt: now };
      try {
        const res = await fetchImpl(`${cfg.baseUrl}/v1/models`, {
          headers: { Authorization: `Bearer ${cfg.apiKey}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { data?: Array<{ id?: string; name?: string }> };
        const models: AiModel[] = (json.data ?? [])
          .map((d) => ({ id: d.id ?? '', name: d.name }))
          .filter((d) => d.id);
        return { models, source: 'api', fetchedAt: now };
      } catch {
        // Degenera honestamente para o modelo padrão (não inventa lista).
        return { models: [{ id: cfg.model, name: cfg.model }], source: 'fallback', fetchedAt: now };
      }
    },
    async generate(req) {
      if (!cfg) throw new Error('OmniRouter não configurado (falta base URL + chave).');
      const res = await chatCompletion(
        req.system ? [{ role: 'system', content: req.system }, { role: 'user', content: req.prompt }] : [{ role: 'user', content: req.prompt }],
        {
          model: req.model,
          maxTokens: req.maxTokens,
          temperature: req.temperature,
          signal: req.signal,
        },
        cfg,
      );
      return { text: res.text, model: res.model, usage: res.usage };
    },
  };
}

// ─────────────────────────── GOOGLE GEMINI (baixo custo) ────────────────────

export function buildDirectGeminiProvider(opts: {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
} = {}): AiProvider {
  const env = opts.env ?? process.env;
  const apiKey = pick(env.GOOGLE_GENERATIVE_AI_API_KEY, env.AI_GOOGLE_API_KEY, env.GOOGLE_API_KEY);
  const baseUrl = (env.GEMINI_BASE_URL ?? GEMINI_BASE).replace(/\/+$/, '');
  const fetchImpl = opts.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);

  return {
    id: 'gemini',
    name: 'Google Gemini (direct)',
    configured: Boolean(apiKey),
    async listModels() {
      const now = Date.now();
      if (!apiKey) return { models: [], source: 'none', fetchedAt: now };
      if (!fetchImpl) return { models: [{ id: 'gemini-1.5-flash' }], source: 'fallback', fetchedAt: now };
      try {
        const res = await fetchImpl(`${baseUrl}/v1beta/models`, {
          headers: { 'x-goog-api-key': apiKey },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as {
          models?: Array<{
            name?: string;
            displayName?: string;
            inputTokenLimit?: string | number;
            outputTokenLimit?: string | number;
            inputModalities?: string[];
            supportedGenerationMethods?: string[];
          }>;
        };
        const models: AiModel[] = (json.models ?? [])
          .map((m) => {
            const rawId = m.name ?? '';
            const id = rawId.startsWith('models/') ? rawId.slice('models/'.length) : rawId;
            const input = Array.isArray(m.inputModalities) ? m.inputModalities.map((s) => s.toLowerCase()) : undefined;
            const model: AiModel = {
              id,
              name: m.displayName ?? id,
              contextWindow:
                typeof m.inputTokenLimit === 'number'
                  ? m.inputTokenLimit
                  : Number.parseInt(String(m.inputTokenLimit ?? ''), 10) || undefined,
              input,
            };
            model.capabilities = geminiCapabilities(model);
            return model;
          })
          .filter((m) => m.id);
        return { models, source: 'api', fetchedAt: now };
      } catch {
        return { models: [{ id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' }], source: 'fallback', fetchedAt: now };
      }
    },
    async generate(req) {
      if (!apiKey) throw new Error('Gemini não configurado (falta a chave).');
      if (!fetchImpl) throw new Error('fetch indisponível neste ambiente.');
      const model = req.model ?? 'gemini-1.5-flash';
      const body: Record<string, unknown> = {
        contents: [{ role: 'user', parts: [{ text: req.prompt }] }],
      };
      if (req.system) body.systemInstruction = { parts: [{ text: req.system }] };
      const genConfig: Record<string, unknown> = {};
      if (req.maxTokens !== undefined) genConfig.maxOutputTokens = req.maxTokens;
      if (req.temperature !== undefined) genConfig.temperature = req.temperature;
      if (Object.keys(genConfig).length > 0) body.generationConfig = genConfig;

      const res = await fetchImpl(
        `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(body),
          signal: req.signal,
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Gemini HTTP ${res.status}: ${text.slice(0, 300)}`);
      }
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
      };
      const parts = json.candidates?.[0]?.content?.parts ?? [];
      const textOut = parts.map((p) => (typeof p.text === 'string' ? p.text : '')).join('');
      const u = json.usageMetadata;
      return {
        text: textOut,
        model,
        usage: u
          ? {
              promptTokens: u.promptTokenCount,
              completionTokens: u.candidatesTokenCount,
              totalTokens: u.totalTokenCount,
            }
          : undefined,
      };
    },
  };
}

export function buildGeminiProvider(opts: {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  apiKey?: string;
  baseUrl?: string;
} = {}): AiProvider {
  const env = opts.env ?? process.env;
  const apiKey = opts.apiKey ?? pick(env.GOOGLE_GENERATIVE_AI_API_KEY, env.AI_GOOGLE_API_KEY, env.GOOGLE_API_KEY);
  const baseUrl = (opts.baseUrl ?? env.GEMINI_BASE_URL ?? GEMINI_BASE).replace(/\/+$/, '');
  const fetchImpl = opts.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);

  return {
    id: 'gemini',
    name: 'Google Gemini',
    configured: Boolean(apiKey),
    async listModels() {
      const now = Date.now();
      if (!apiKey) return { models: [], source: 'none', fetchedAt: now };
      if (!fetchImpl) return { models: [{ id: 'gemini-1.5-flash' }], source: 'fallback', fetchedAt: now };
      try {
        const res = await fetchImpl(`${baseUrl}/v1beta/models`, {
          headers: { 'x-goog-api-key': apiKey },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as {
          models?: Array<{
            name?: string;
            displayName?: string;
            inputTokenLimit?: string | number;
            outputTokenLimit?: string | number;
            inputModalities?: string[];
            supportedGenerationMethods?: string[];
          }>;
        };
        const models: AiModel[] = (json.models ?? [])
          .map((m) => {
            const rawId = m.name ?? '';
            const id = rawId.startsWith('models/') ? rawId.slice('models/'.length) : rawId;
            const input = Array.isArray(m.inputModalities) ? m.inputModalities.map((s) => s.toLowerCase()) : undefined;
            const model: AiModel = {
              id,
              name: m.displayName ?? id,
              contextWindow:
                typeof m.inputTokenLimit === 'number'
                  ? m.inputTokenLimit
                  : Number.parseInt(String(m.inputTokenLimit ?? ''), 10) || undefined,
              input,
            };
            model.capabilities = geminiCapabilities(model);
            return model;
          })
          .filter((m) => m.id);
        return { models, source: 'api', fetchedAt: now };
      } catch {
        return { models: [{ id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' }], source: 'fallback', fetchedAt: now };
      }
    },
    async generate(req) {
      if (!apiKey) throw new Error('Gemini não configurado (falta a chave).');
      if (!fetchImpl) throw new Error('fetch indisponível neste ambiente.');
      const model = req.model ?? 'gemini-1.5-flash';
      const body: Record<string, unknown> = {
        contents: [{ role: 'user', parts: [{ text: req.prompt }] }],
      };
      if (req.system) body.systemInstruction = { parts: [{ text: req.system }] };
      const genConfig: Record<string, unknown> = {};
      if (req.maxTokens !== undefined) genConfig.maxOutputTokens = req.maxTokens;
      if (req.temperature !== undefined) genConfig.temperature = req.temperature;
      if (Object.keys(genConfig).length > 0) body.generationConfig = genConfig;

      const res = await fetchImpl(
        `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(body),
          signal: req.signal,
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Gemini HTTP ${res.status}: ${text.slice(0, 300)}`);
      }
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
      };
      const parts = json.candidates?.[0]?.content?.parts ?? [];
      const textOut = parts.map((p) => (typeof p.text === 'string' ? p.text : '')).join('');
      const u = json.usageMetadata;
      return {
        text: textOut,
        model,
        usage: u
          ? {
              promptTokens: u.promptTokenCount,
              completionTokens: u.candidatesTokenCount,
              totalTokens: u.totalTokenCount,
            }
          : undefined,
      };
    },
  };
}

// ─────────────────────────── OLLAMA (local OpenAI-compatível) ─────────────────

export function buildOllamaProvider(opts: {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
} = {}): AiProvider {
  const env = opts.env ?? process.env;
  const baseUrl = (opts.baseUrl ?? env.AI_API_URL ?? OLLAMA_BASE).replace(/\/+$/, '');
  const apiKey = opts.apiKey ?? env.AI_API_KEY ?? 'ollama';
  const defaultModel = opts.model ?? env.AI_MODEL ?? 'llama3.1:8b';
  const fetchImpl = opts.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);

  return {
    id: 'ollama',
    name: 'Ollama (local OpenAI-compatível)',
    configured: true, // Sempre configurado se o container estiver rodando
    async listModels() {
      const now = Date.now();
      if (!fetchImpl) return { models: [{ id: defaultModel, name: defaultModel }], source: 'fallback', fetchedAt: now };
      try {
        const res = await fetchImpl(`${baseUrl}/v1/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { data?: Array<{ id?: string; name?: string }> };
        const models: AiModel[] = (json.data ?? [])
          .map((d) => ({ id: d.id ?? '', name: d.name }))
          .filter((d) => d.id);
        return { models, source: 'api', fetchedAt: now };
      } catch {
        return { models: [{ id: defaultModel, name: defaultModel }], source: 'fallback', fetchedAt: now };
      }
    },
    async generate(req) {
      if (!fetchImpl) throw new Error('fetch indisponível neste ambiente.');
      const model = req.model ?? defaultModel;
      const res = await fetchImpl(
        `${baseUrl}/v1/chat/completions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            messages: req.system
              ? [{ role: 'system', content: req.system }, { role: 'user', content: req.prompt }]
              : [{ role: 'user', content: req.prompt }],
            max_tokens: req.maxTokens,
            temperature: req.temperature,
          }),
          signal: req.signal,
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Ollama HTTP ${res.status}: ${text.slice(0, 300)}`);
      }
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
        model?: string;
      };
      const choice = json.choices?.[0];
      const u = json.usage;
      return {
        text: choice?.message?.content ?? '',
        model: json.model ?? model,
        usage: u
          ? {
              promptTokens: u.prompt_tokens,
              completionTokens: u.completion_tokens,
              totalTokens: u.total_tokens,
            }
          : undefined,
      };
    },
  };
}

// ─────────────────────────── Registry / cadeia de fallback ─────────────────

export interface BuildProvidersOptions {
  /** Overrides do OmniRouter (ex.: chave do dono via config criptografada). */
  overrides?: OmniRouterOverrides;
  /** Chave Gemini do dono (server-side; nunca do client). */
  geminiApiKey?: string;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  /** Ordem explícita de fallback (default: omni, gemini, ollama). */
  order?: Array<'omni' | 'gemini' | 'ollama'>;
  /** Usar provedor Gemini direto (sem OmniRouter). Ignorado se order não incluir 'gemini'. */
  useDirectGemini?: boolean;
}

/**
 * Compõe a cadeia de provedores (§13: o SaaS NÃO depende de um único).
 * `order` controla a sequência do fallback; provedores não configurados
 * ainda entram na lista (com `configured:false`) para a UI mostrar o estado.
 * `useDirectGemini` ignora o OmniRouter e usa buildDirectGeminiProvider diretamente.
 */
export function buildAiProviders(opts: BuildProvidersOptions = {}): AiProvider[] {
  const useDirect = opts.useDirectGemini ?? false;

  // Se solicitado provedor direto, cria apenas o Gemini direto
  if (useDirect) {
    const direct = buildDirectGeminiProvider({ env: opts.env });
    // Inclui OmniRouter não configurado para a UI mostrar estado
    const omni = buildOmniProvider({ env: opts.env });
    return [omni, direct].filter(Boolean) as AiProvider[];
  }

  const omni = buildOmniProvider(opts);
  const gemini = buildGeminiProvider(opts);
  const ollama = buildOllamaProvider(opts);
  const map = { omni, gemini, ollama } as const;
  const order = opts.order ?? ['omni', 'gemini', 'ollama'];
  const seen = new Set<string>();
  const out: AiProvider[] = [];
  for (const id of order) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(map[id]);
  }
  return out;
}
