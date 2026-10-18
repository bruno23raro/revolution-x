// FASE 1 — Chatbot de WhatsApp configurável: motor de regras puro.
// FASE 3 · slice 2 — fluxo visual (steps) + variáveis + quick replies.
//
// Determinístico e injetável (IA e relógio são parâmetros → 100% testável).
// Ordem de decisão:
//   1. desligado → não responde;
//   2. fora da janela de horas → só fallback (se existir);
//   3. primeiro contato com saudação → saudação;
//   4. fluxo visual (steps), antes das regras planas;
//   5. regras (keyword/contains/exact/regex), em ordem;
//   6. IA (opcional, quando `useAI` e houve match de nenhuma regra);
//   7. fallback;
//   8. senão, nada.

export type MatchType = 'keyword' | 'contains' | 'exact' | 'regex';

export interface ChatbotRule {
  id?: string;
  matchType: MatchType;
  pattern: string;
  /** Flags para regex (ex.: "i"). */
  flags?: string;
  response: string;
  /** Efeito colateral descritivo (ex.: "criar_lead"). Não executa aqui. */
  action?: string;
  enabled?: boolean;
}

/**
 * Nó (etapa) do fluxo visual (FASE 3 · slice 2).
 *
 * Semântica determinística e sem estado (o config é o JSON inteiro):
 *  - nó **sem condição** = incondicional; com condição, só dispara se a
 *    mensagem recebida casa com ela;
 *  - a entrada do fluxo é o **primeiro** nó da lista que seja incondicional
 *    ou tenha condição matcheando; o resto da cadeia avança por `nextStepId`
 *    (a condição do nó destino, se houver, é re-chequeada contra a MESMA
 *    mensagem);
 *  - `end: true` para a cadeia após este nó;
 *  - proteção de loop: conjunto de visitados + limite de saltos.
 */
export interface ChatbotStep {
  /** Identificador estável (usado pelos ponteiros nextStepId). */
  id?: string;
  /** Condição opcional. Ausente ou padrão vazio = nó incondicional. */
  matchType?: MatchType;
  pattern?: string;
  flags?: string;
  /** Resposta deste nó (suporta {{variavel}} de `vars`). */
  response?: string;
  /** Quick replies (botões) sugeridos junto à resposta. */
  quickReplies?: string[];
  /** Próximo nó da cadeia (null/ausente = fim do fluxo). */
  nextStepId?: string | null;
  /** Termina o fluxo após este nó (não segue nextStepId). */
  end?: boolean;
}

export interface ChatbotConfig {
  enabled: boolean;
  greeting?: string;
  fallback?: string;
  /** IANA (ex.: "America/Sao_Paulo"). Padrão: fuso local do processo. */
  timezone?: string;
  activeFromHour?: number;
  activeToHour?: number;
  rules: ChatbotRule[];
  /** Fluxo visual (etapas conectadas). Avaliado antes das `rules`. */
  steps?: ChatbotStep[];
  /** Variáveis para interpolação {{nome}} nas respostas dos steps. */
  vars?: Record<string, string>;
  useAI?: boolean;
  aiSystemPrompt?: string;
}

export interface ChatbotInput {
  text: string;
  firstContact?: boolean;
  now?: Date;
}

export type AiFn = (system: string, user: string) => Promise<string>;

export type DecisionSource = 'greeting' | 'step' | 'rule' | 'fallback' | 'ai' | 'none';

export interface ChatbotDecision {
  respond: boolean;
  text?: string;
  source: DecisionSource;
  matchedRuleId?: string;
  /** ID do último step respondido (source = 'step'). */
  matchedStepId?: string;
  /** Quick replies do último step com botões (source = 'step'). */
  quickReplies?: string[];
  action?: string;
}

function hourOf(d: Date, tz?: string): number {
  if (!tz) return d.getHours();
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hour12: false }).formatToParts(d);
    const h = parts.find((p) => p.type === 'hour');
    const n = h ? Number(h.value) : d.getHours();
    return n % 24; // '24' pode aparecer à meia-noite; normaliza para 0.
  } catch {
    return d.getHours();
  }
}

function withinActiveHours(cfg: ChatbotConfig, hour: number): boolean {
  const from = cfg.activeFromHour;
  const to = cfg.activeToHour;
  if (from === undefined && to === undefined) return true;
  const f = from ?? 0;
  const t = to ?? 23;
  if (f <= t) return hour >= f && hour <= t;
  return hour >= f || hour <= t; // janela que cruza a meia-noite
}

function matchesPattern(
  matchType: MatchType,
  pattern: string,
  flags: string | undefined,
  text: string,
): boolean {
  switch (matchType) {
    case 'exact':
      return text.toLowerCase() === pattern.trim().toLowerCase();
    case 'contains':
    case 'keyword':
      return text.toLowerCase().includes(pattern.trim().toLowerCase());
    case 'regex':
      try {
        return new RegExp(pattern, flags ?? '').test(text);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

function ruleMatches(rule: ChatbotRule, text: string): boolean {
  return matchesPattern(rule.matchType, rule.pattern, rule.flags, text);
}

/**
 * Substitui {{nome}} pelo valor em `vars`. Chaves desconhecidas permanecem
 * como estão (degradação honesta — nunca inventa valor).
 */
export function interpolateVars(
  text: string,
  vars: Record<string, string> | null | undefined,
): string {
  if (!text) return '';
  if (!vars || Object.keys(vars).length === 0) return text;
  return text.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole,
  );
}

function stepConditionMet(step: ChatbotStep, text: string): boolean {
  if (!step.matchType || !step.pattern?.trim()) return true;
  return matchesPattern(step.matchType, step.pattern, step.flags, text);
}

interface StepFlowResult {
  text?: string;
  quickReplies?: string[];
  lastStepId?: string;
}

/**
 * Percorre o fluxo visual: encontra a entrada (primeiro nó incondicional ou
 * com condição matcheando), responde e avança por nextStepId, re-checando a
 * condição de cada nó destino contra a MESMA mensagem. Respostas da cadeia
 * são unidas com "\n\n". Devolve null quando nada dispara (fall-through
 * para as regras planas). Puro: sem rede, sem banco.
 */
export function evaluateSteps(
  steps: ChatbotStep[] | null | undefined,
  text: string,
  vars?: Record<string, string>,
): StepFlowResult | null {
  if (!Array.isArray(steps) || steps.length === 0) return null;

  const entryIdx = steps.findIndex((s) => stepConditionMet(s, text));
  if (entryIdx === -1) return null;

  const visited = new Set<string>();
  const responses: string[] = [];
  let quickReplies: string[] | undefined;
  let lastStepId: string | undefined;

  const maxHops = steps.length + 2; // proteção contra nextStepId cíclico
  let idx = entryIdx;
  for (let hop = 0; hop < maxHops; hop++) {
    const step = steps[idx];
    if (!step) break;
    const key = step.id ?? `#idx:${idx}`;
    if (visited.has(key)) break;
    visited.add(key);

    lastStepId = step.id;
    const resp = step.response?.trim();
    if (resp) responses.push(interpolateVars(resp, vars));
    const q = Array.isArray(step.quickReplies)
      ? step.quickReplies.map((x) => String(x).trim()).filter(Boolean)
      : [];
    if (q.length > 0) quickReplies = q;

    if (step.end === true) break;
    if (!step.nextStepId) break;
    const nextIdx = steps.findIndex((s) => s.id === step.nextStepId);
    if (nextIdx === -1) break; // ponteiro quebrado (nó removido)
    if (!stepConditionMet(steps[nextIdx], text)) break; // fora da branch
    idx = nextIdx;
  }

  const joined = responses.join('\n\n').trim();
  if (!joined && !quickReplies) return null;
  return { text: joined || undefined, quickReplies, lastStepId };
}

export interface EvaluateDeps {
  ai?: AiFn;
  nowOverride?: Date;
}

export async function evaluateChatbot(
  cfg: ChatbotConfig | null | undefined,
  input: ChatbotInput,
  deps: EvaluateDeps = {},
): Promise<ChatbotDecision> {
  if (!cfg || !cfg.enabled) return { respond: false, source: 'none' };

  const now = deps.nowOverride ?? input.now ?? new Date();

  // Janela de horas: fora dela, apenas fallback.
  if (!withinActiveHours(cfg, hourOf(now, cfg.timezone))) {
    if (cfg.fallback?.trim()) return { respond: true, text: cfg.fallback, source: 'fallback' };
    return { respond: false, source: 'none' };
  }

  const text = (input.text ?? '').trim();

  // Primeiro contato → saudação (se definida).
  if (input.firstContact && cfg.greeting?.trim()) {
    return { respond: true, text: cfg.greeting, source: 'greeting' };
  }

  // Fluxo visual (steps) — avaliado antes das regras planas.
  const flow = evaluateSteps(cfg.steps, text, cfg.vars);
  if (flow) {
    return {
      respond: true,
      text: flow.text,
      source: 'step',
      matchedStepId: flow.lastStepId,
      quickReplies: flow.quickReplies,
    };
  }

  // Regras, em ordem.
  for (const rule of cfg.rules ?? []) {
    if (rule.enabled === false) continue;
    if (!rule.response?.trim()) continue;
    if (ruleMatches(rule, text)) {
      return { respond: true, text: rule.response, source: 'rule', matchedRuleId: rule.id, action: rule.action };
    }
  }

  // IA opcional.
  if (cfg.useAI && deps.ai) {
    try {
      const out = await deps.ai(
        cfg.aiSystemPrompt ?? 'Você é um assistente de WhatsApp. Responda de forma curta, clara e útil.',
        text,
      );
      const t = out?.trim();
      if (t) return { respond: true, text: t, source: 'ai' };
    } catch {
      /* degrada para fallback */
    }
  }

  // Fallback.
  if (cfg.fallback?.trim()) return { respond: true, text: cfg.fallback, source: 'fallback' };
  return { respond: false, source: 'none' };
}
