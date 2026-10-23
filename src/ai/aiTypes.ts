// FASE 18 — IA multi-provedor (§13). Tipos compartilhados.
//
// A camada de IA NÃO depende de um único provedor (§13): cada provedor se
// declara aqui e o facade (`aiProviders`) compõe a cadeia de fallback.
// Chaves/credenciais vivem SOMENTE no backend (env + config criptografada);
// nenhum campo de `AiModel`/`GenerationResult` carrega segredo.

/** Capacidades que um modelo declara (filtro do auto-modo, §13). */
export type ModelCapability = 'chat' | 'vision' | 'code' | 'reasoning' | 'long_context';

/** Modelo descoberto dinamicamente (dados reais da API; nada inventado). */
export interface AiModel {
  /** Identificador técnico usado nas chamadas (ex.: `gemini-1.5-flash`). */
  id: string;
  /** Nome legível (ex.: `Gemini 1.5 Flash`); undefined quando a API não traz. */
  name?: string;
  /** Janela de contexto em tokens, se a API expuser (usado pelo auto-modo). */
  contextWindow?: number;
  /** Modalidades de entrada aceitas (`text`, `image`, ...). */
  input?: string[];
  /** Capacidades (chat/vision/code/reasoning/long_context). */
  capabilities?: ModelCapability[];
}

/** Provedor de IA abstrato (implementações: OmniRouter + Google Gemini + extensível). */
export interface AiProvider {
  /** Id estável (`omni`, `gemini`). */
  id: string;
  /** Nome legível para a UI. */
  name: string;
  /** Se tem credencial configurada (sem expor a chave em si). */
  configured: boolean;
  /** Descoberta dinâmica de modelos (cache aplicada pelo `discovery`). */
  listModels: (opts?: { signal?: AbortSignal }) => Promise<{
    models: AiModel[];
    /** 'api' = lista real; 'fallback' = degenerou para o modelo padrão; 'none' = nada. */
    source: 'api' | 'fallback' | 'none';
    fetchedAt: number;
  }>;
  /** Gera uma resposta. Lança em erro de 4xx firme; fallback cuida do resto. */
  generate: (req: {
    prompt: string;
    system?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
    signal?: AbortSignal;
  }) => Promise<{ text: string; model: string; usage?: AiUsage }>;
}

/** Uso de tokens (contagens reais; nunca inventadas, §10/§18). */
export interface AiUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
}

/** Pedido de geração (facade). */
export interface GenerationRequest {
  prompt: string;
  /** Tarefa curta que orienta o auto-modo (ex.: 'resumo', 'análise longa'). */
  task?: string;
  system?: string;
  /** Modelo explícito (senão auto-modo escolhe por capacidade). */
  model?: string;
  /** Força um provedor específico (senão percorre a cadeia). */
  provider?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

/** Resultado da geração com fallback. `ok=false` + `error` honesto (nunca inventa). */
export interface GenerationResult {
  ok: boolean;
  text?: string;
  /** Modelo efetivo usado (o provedor pode reesolver alias). */
  model?: string;
  /** Provedor que executou. */
  provider?: string;
  /** `true` quando um provedor anterior falhou e outro da cadeia assumiu. */
  fallbackUsed?: boolean;
  usage?: AiUsage;
  /** Erro legível (quando `ok=false`). Sem credenciais no texto. */
  error?: string;
}
