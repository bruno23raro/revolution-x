// FASE 10 — AI Service (preparado, não inventado)
// Baseado: README Fase 10 = IA
// Dependência externa: chave OpenAI / Anthropic (não fornecida)
// Não inventa: prompts específicos, respostas automáticas, classificação
// Prepara: interface de completions, configuração, documentação

export interface AIConfig {
  provider: 'openai' | 'anthropic';
  apiKey?: string;
  model?: string;
}

export async function generateResponse(config: AIConfig, prompt: string): Promise<{ text?: string; error?: string }> {
  // BLOQUEADO EXTERNAMENTE — chave API necessária
  return { error: 'BLOQUEADO — chave API IA não fornecida' };
}
