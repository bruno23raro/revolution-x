// FASE 2 — OmniRouter client (centro administrativo de IA)
// ------------------------------------------------------------------
// Reusa a mesma camada de modelos que o Claude Code local usa
// (proxy local compatível-OpenAI em $ANTHROPIC_BASE_URL, modelo
// $ANTHROPIC_MODEL), sem duplicar credenciais: as chaves vivem SOMENTE
// no backend/ambiente. Este módulo NUNCA imprime a chave em logs.
//
// Contrato verificado (solicitação real contra localhost:20128):
//   POST {base}/v1/chat/completions  (OpenAI chat.completions)
//   headers: Content-Type: application/json, Authorization: Bearer <key>
//   body:  { model, messages, max_tokens?, temperature? }
//   resp:  { model, choices[0].message.content | .reasoning, usage }
//
// Sem dependências novas: usa o fetch global (Node 18+ / Next 14).
// Timeout + retry com backoff em falhas transitórias (429/5xx/timeout),
// não em erros de cliente (4xx ≠ 429).

export type Role = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface OmniRouterUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
}

export interface OmniRouterResult {
  /** Texto final (content; fallback para `reasoning` quando content vazio). */
  text: string;
  /** Modelo efetivo (o gateway pode reesolver o alias para o real). */
  model: string;
  /** Contagem de tokens (se disponível) — registra consumo (§4.7). */
  usage?: OmniRouterUsage;
  /** Resposta bruta para inspeção/depuração. */
  raw?: unknown;
}

export interface OmniRouterConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface OmniRouterOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  system?: string;
}

export interface OmniRouterOverrides {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MODEL = 'Modelos-Gratis';

function pick(
  primary: string | undefined | null,
  ...alts: Array<string | undefined | null>
): string | undefined {
  const candidates = [primary, ...alts].map((x) =>
    typeof x === 'string' && x.trim() !== '' ? x : undefined,
  );
  return candidates.find(Boolean);
}

/**
 * Resolve a configuração do OmniRouter a partir de overrides explícitos +
 * ambiente, com precedência: OMNIROUTER_* > ANTHROPIC_* > OPENAI_*.
 * Retorna null quando não há base URL + chave (chamada será bloqueada
 * com mensagem clara, nunca inventada).
 */
export function resolveOmniRouterConfig(
  overrides: OmniRouterOverrides = {},
  env: Record<string, string | undefined> = process.env,
): OmniRouterConfig | null {
  const baseUrl = pick(
    overrides.baseUrl,
    env.OMNIROUTER_BASE_URL,
    env.ANTHROPIC_BASE_URL,
    env.OPENAI_BASE_URL,
  );
  const apiKey = pick(
    overrides.apiKey,
    env.OMNIROUTER_API_KEY,
    env.ANTHROPIC_AUTH_TOKEN,
    env.OPENAI_API_KEY,
  );
  const model =
    pick(overrides.model, env.OMNIROUTER_MODEL, env.ANTHROPIC_MODEL) ??
    DEFAULT_MODEL;

  if (!baseUrl || !apiKey) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey, model };
}

function isTransientError(e: unknown): boolean {
  const m = String((e as any)?.message ?? '');
  const code = (e as any)?.code ?? (e as any)?.cause?.code;
  return (
    (e as any)?.name === 'AbortError' ||
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    /aborted|fetch failed|ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|socket/i.test(m)
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executa uma chat completion no OmniRouter.
 * - `config` null + sem env => lança erro claro (não simula sucesso).
 * - Retries apenas em falha transitória; erros 4xx firmes propagam na hora.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  opts: OmniRouterOptions = {},
  config: OmniRouterConfig | null = resolveOmniRouterConfig(),
): Promise<OmniRouterResult> {
  if (!config) {
    throw new Error('OmniRouter não configurado (falta base URL + chave).');
  }
  const { baseUrl, apiKey } = config;
  const model = opts.model ?? config.model;
  const timeoutMs = opts.timeoutMs ?? config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = config.maxRetries ?? 2;
  const url = `${baseUrl}/v1/chat/completions`;

  const body: Record<string, unknown> = { model, messages };
  if (opts.system) body.system = opts.system;
  if (opts.maxTokens !== undefined) body.max_tokens = opts.maxTokens;
  if (opts.temperature !== undefined) body.temperature = opts.temperature;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    if (opts.signal) {
      if (opts.signal.aborted) controller.abort();
      else opts.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text();
      let json: any = {};
      try {
        json = JSON.parse(text);
      } catch {
        json = { _raw: text };
      }

      if (res.status === 200 || res.status === 201) {
        const message = json?.choices?.[0]?.message;
        const content =
          (typeof message?.content === 'string' ? message.content : undefined) ??
          (typeof message?.reasoning === 'string' ? message.reasoning : undefined) ??
          json?.choices?.[0]?.text ??
          '';
        const u = json?.usage;
        return {
          text: content,
          model: json?.model ?? model,
          usage: u
            ? {
                promptTokens: u.prompt_tokens,
                completionTokens: u.completion_tokens,
                totalTokens: u.total_tokens,
                reasoningTokens: u.completion_tokens_details?.reasoning_tokens,
              }
            : undefined,
          raw: json,
        };
      }

      const retriable =
        res.status === 429 || res.status === 408 || res.status >= 500;
      lastErr = new Error(
        `OmniRouter HTTP ${res.status}: ${String(text).slice(0, 300)}`,
      );
      if (!retriable) throw lastErr;
      if (attempt < maxRetries) await sleep(Math.min(5000, 500 * 2 ** attempt));
      continue;
    } catch (e) {
      lastErr = e;
      if (isTransientError(e)) {
        if (attempt < maxRetries) {
          await sleep(Math.min(5000, 500 * 2 ** attempt));
          continue;
        }
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('OmniRouter falhou.');
}
