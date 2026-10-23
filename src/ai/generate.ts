// FASE 18 — Geração com cadeia de fallback (§13: NUNCA depender de 1 provedor).
//
// Percorre os provedores configurados na ordem da cadeia; ao primeiro erro
// firme/transiente passa ao próximo. Marca `fallbackUsed` quando um anterior
// falhou e outro assumiu. Sem provedor configurado → resultado BLOQUEADO
// honesto (NUNCA inventa resposta, §10/§18). Erros nunca carregam credenciais.

import type { AiModel, AiProvider, GenerationRequest, GenerationResult } from './aiTypes';
import { selectModelForTask, type AutoSelectPrefs } from './autoSelect';

export interface GenerateOptions {
  /** Cadeia de provedores (a ordem = ordem do fallback). */
  providers: AiProvider[];
  request: GenerationRequest;
  /** Modelos descobertos por provedor (para o auto-modo). Se omitido, usa
   *  `request.model` ou o default interno do provedor. */
  modelsByProvider?: Record<string, AiModel[]>;
  autoPrefs?: AutoSelectPrefs;
}

export async function generateWithFallback(opts: GenerateOptions): Promise<GenerationResult> {
  const { providers, request } = opts;

  const configured = providers.filter((p) => p.configured);
  if (configured.length === 0) {
    return {
      ok: false,
      error: 'BLOQUEADO — nenhum provedor de IA configurado (falta a chave do servidor).',
    };
  }

  // Provedor explícito restringe a cadeia; se ele não existe/configura,
  // percorre a cadeia inteira (nunca silencia).
  const chain = request.provider ? configured.filter((p) => p.id === request.provider) : configured;
  const target = chain.length > 0 ? chain : configured;

  let lastError = 'sem tentativa';
  let fallbackUsed = false;

  for (let i = 0; i < target.length; i++) {
    if (i > 0) fallbackUsed = true; // um provedor anterior falhou e outro assumiu
    const p = target[i];

    // Modelo: explícito > auto (por capacidade) > default do provedor.
    let model = request.model;
    if (!model && p.id in (opts.modelsByProvider ?? {})) {
      model = selectModelForTask(opts.modelsByProvider![p.id] ?? [], request.task, opts.autoPrefs)?.id;
    }

    try {
      const res = await p.generate({
        prompt: request.prompt,
        system: request.system,
        model,
        maxTokens: request.maxTokens,
        temperature: request.temperature,
        signal: request.signal,
      });
      return {
        ok: true,
        text: res.text,
        model: res.model,
        provider: p.id,
        fallbackUsed,
        usage: res.usage,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      // passa ao próximo da cadeia
    }
  }

  return {
    ok: false,
    error: `Todos os provedores falharam. Último erro: ${lastError}`,
    fallbackUsed: target.length > 1,
  };
}
