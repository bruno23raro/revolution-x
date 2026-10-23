// FASE 18 — Auto-modo de escolha de modelo (§13): DETERMINÍSTICO.
//
// "Não simplesmente o maior ou mais recente": o auto-modo filtra por
// capacidade exigida, pondera por capacidades inferidas da tarefa (soft) e
// calibra pela janela de contexto — tarefa curta → janela menor (custo),
// tarefa longa → janela maior. Janela desconhecida é tratada como
// "não comprovável" e fica atrás das comprovadas. Tie-break final por `id`
// (estável e reprodutível). Nunca há sinal de "recência".

import type { AiModel, ModelCapability } from './aiTypes';

export interface AutoSelectPrefs {
  /** Capacidades OBRIGATÓRIAS (filtro duro). Default: ['chat']. */
  requiredCapabilities?: ModelCapability[];
  /** Estimativa de tokens de contexto para calibrar a janela. */
  contextEstimateTokens?: number;
  /** Modelos preferidos (restringe o pool se algum sobreviver). */
  preferModelIds?: string[];
}

const SENTINEL_MAX = 1_000_000_000;
const SHORT_TASK_TOKENS = 8000;

function capsOf(m: AiModel): ModelCapability[] {
  return m.capabilities && m.capabilities.length > 0 ? m.capabilities : ['chat'];
}

/** Capacidades SOFT inferidas da tarefa (só ponderam; nunca eliminam). */
function inferCaps(task: string): ModelCapability[] {
  const t = task.toLowerCase();
  const out: ModelCapability[] = [];
  if (/(imagem|image|foto|vision|screenshot|print)/.test(t)) out.push('vision');
  if (/(c[oó]digo|code|programa|debug|refator)/.test(t)) out.push('code');
  if (/(longo|resumir|analisar|documento|relat[oó]rio|report|transcri)/.test(t)) out.push('long_context');
  if (/(racio[cç]inar|reason|deduzir|l[oó]gica|estrat[aé]gia|plano)/.test(t)) out.push('reasoning');
  return out;
}

/**
 * Escolhe o melhor modelo para a tarefa a partir dos modelos disponíveis de
 * um provedor. Retorna `null` quando nenhum atende ao filtro duro — o chamante
 * degrada honestamente (o provedor usa seu modelo default).
 */
export function selectModelForTask(
  models: AiModel[],
  task?: string,
  prefs: AutoSelectPrefs = {},
): AiModel | null {
  if (!models.length) return null;

  const hard: ModelCapability[] = prefs.requiredCapabilities?.length
    ? prefs.requiredCapabilities
    : ['chat'];
  let pool = models.filter((m) => hard.every((c) => capsOf(m).includes(c)));
  if (pool.length === 0) return null;

  if (prefs.preferModelIds && prefs.preferModelIds.length > 0) {
    const pref = pool.filter((m) => prefs.preferModelIds!.includes(m.id));
    if (pref.length > 0) pool = pref;
  }

  const soft = task ? inferCaps(task) : [];
  const estimate = prefs.contextEstimateTokens;
  const short = estimate !== undefined && estimate < SHORT_TASK_TOKENS;

  const scored = pool.map((m) => ({
    m,
    softHits: soft.filter((c) => capsOf(m).includes(c)).length,
  }));

  scored.sort((a, b) => {
    if (b.softHits !== a.softHits) return b.softHits - a.softHits;
    if (estimate !== undefined) {
      // Janela desconhecida: atrás das comprovadas nas duas direções.
      const aw = a.m.contextWindow ?? (short ? SENTINEL_MAX : 0);
      const bw = b.m.contextWindow ?? (short ? SENTINEL_MAX : 0);
      if (aw !== bw) return short ? aw - bw : bw - aw;
    }
    // Sem estimativa: pura estabilidade por id (nada de "o maior/morecente").
    return a.m.id.localeCompare(b.m.id);
  });

  return scored[0]?.m ?? null;
}
