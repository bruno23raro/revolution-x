// FASE 2 — AI Service (estende o stub de FASE 10).
// ------------------------------------------------------------------
// Mantém a interface `AIConfig` / `generateResponse` (compatível com
// quem a importava) e, agora, delega ao OmniRouter quando existe
// chave. Sem chave => preserva o fallback "BLOQUEADO" (não inventa).
// A chave NUNCA sai do backend; ver src/ai/omniRouter.ts.

import {
  chatCompletion,
  resolveOmniRouterConfig,
  type OmniRouterResult,
} from './omniRouter';

export interface AIConfig {
  provider?: 'openai' | 'anthropic';
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  system?: string;
  maxTokens?: number;
}

export interface AIGenerationResult {
  text?: string;
  usage?: OmniRouterResult['usage'];
  error?: string;
}

export async function generateResponse(
  config: AIConfig,
  prompt: string,
): Promise<AIGenerationResult> {
  const router = resolveOmniRouterConfig({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
  });

  if (!router) {
    // Mesma semântica do stub original: bloqueado externamente, sem chave.
    return { error: 'BLOQUEADO — chave API IA não fornecida' };
  }

  try {
    const res = await chatCompletion(
      [{ role: 'user', content: prompt }],
      {
        model: config.model,
        system: config.system,
        maxTokens: config.maxTokens,
      },
      router,
    );
    return { text: res.text, usage: res.usage };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
