// FASE 1 — Chatbot de WhatsApp configurável: motor de regras puro.
//
// Determinístico e injetável (IA e relógio são parâmetros → 100% testável).
// Ordem de decisão:
//   1. desligado → não responde;
//   2. fora da janela de horas → só fallback (se existir);
//   3. primeiro contato com saudação → saudação;
//   4. regras (keyword/contains/exact/regex), em ordem;
//   5. IA (opcional, quando `useAI` e houve match de nenhuma regra);
//   6. fallback;
//   7. senão, nada.

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

export interface ChatbotConfig {
  enabled: boolean;
  greeting?: string;
  fallback?: string;
  /** IANA (ex.: "America/Sao_Paulo"). Padrão: fuso local do processo. */
  timezone?: string;
  activeFromHour?: number;
  activeToHour?: number;
  rules: ChatbotRule[];
  useAI?: boolean;
  aiSystemPrompt?: string;
}

export interface ChatbotInput {
  text: string;
  firstContact?: boolean;
  now?: Date;
}

export type AiFn = (system: string, user: string) => Promise<string>;

export type DecisionSource = 'greeting' | 'rule' | 'fallback' | 'ai' | 'none';

export interface ChatbotDecision {
  respond: boolean;
  text?: string;
  source: DecisionSource;
  matchedRuleId?: string;
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

function ruleMatches(rule: ChatbotRule, text: string): boolean {
  switch (rule.matchType) {
    case 'exact':
      return text.toLowerCase() === rule.pattern.trim().toLowerCase();
    case 'contains':
    case 'keyword':
      return text.toLowerCase().includes(rule.pattern.trim().toLowerCase());
    case 'regex':
      try {
        return new RegExp(rule.pattern, rule.flags ?? '').test(text);
      } catch {
        return false;
      }
    default:
      return false;
  }
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
