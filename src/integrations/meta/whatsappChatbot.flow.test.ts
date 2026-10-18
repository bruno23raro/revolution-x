// FASE 3 · slice 2 — Fluxo visual (steps), variáveis {{nome}} e quick replies.
//
// Motor puro e determinístico (sem rede/banco): entrada da cadeia, avanço por
// nextStepId, branches condicionais, proteção de loop, ponteiros quebrados e
// o fall-through para as regras planas quando o fluxo não dispara.

import {
  evaluateChatbot,
  evaluateSteps,
  interpolateVars,
  type ChatbotConfig,
  type ChatbotStep,
} from '@/integrations/meta/whatsappChatbot';

describe('interpolateVars', () => {
  it('substitui chaves conhecidas', () => {
    expect(interpolateVars('Oi {{nome}}, seu plano é {{plano}}', { nome: 'Zé', plano: 'PRO' })).toBe(
      'Oi Zé, seu plano é PRO',
    );
  });

  it('preserva chaves desconhecidas (não inventa valor)', () => {
    expect(interpolateVars('{{ausente}} e {{ok}}', { ok: 'x' })).toBe('{{ausente}} e x');
  });

  it('aceita espaços no chave e texto vazio/sem vars passa por inteiro', () => {
    expect(interpolateVars('a {{ k }} b', { k: 'K' })).toBe('a K b');
    expect(interpolateVars('', { k: 'K' })).toBe('');
    expect(interpolateVars('sem variáveis', undefined)).toBe('sem variáveis');
  });
});

describe('evaluateSteps (fluxo visual)', () => {
  it('null / vazio → null (fall-through para as regras planas)', () => {
    expect(evaluateSteps(null, 'oi')).toBeNull();
    expect(evaluateSteps(undefined, 'oi')).toBeNull();
    expect(evaluateSteps([], 'oi')).toBeNull();
  });

  it('entrada incondicional + cadeia: respostas unidas com \\n\\n', () => {
    const steps: ChatbotStep[] = [
      { id: 'a', response: 'A', nextStepId: 'b' },
      { id: 'b', response: 'B' },
    ];
    expect(evaluateSteps(steps, 'qualquer')).toEqual({ text: 'A\n\nB', lastStepId: 'b' });
  });

  it('interpola {{vars}} em cada nó da cadeia', () => {
    const steps: ChatbotStep[] = [
      { id: 'a', response: 'Oi {{nome}}', nextStepId: 'b' },
      { id: 'b', response: 'Planos a partir de {{preco}}' },
    ];
    const r = evaluateSteps(steps, 'oi', { nome: 'Zé', preco: 'R$99' });
    expect(r?.text).toBe('Oi Zé\n\nPlanos a partir de R$99');
  });

  it('branch: condição do nó destino não casa → para antes', () => {
    const steps: ChatbotStep[] = [
      { id: 'a', response: 'A', nextStepId: 'b' },
      { id: 'b', matchType: 'keyword', pattern: 'preço', response: 'B' },
    ];
    const r = evaluateSteps(steps, 'oi');
    expect(r?.text).toBe('A');
    expect(r?.lastStepId).toBe('a');
  });

  it('entrada por nó condicional que casa; null quando todos são condicionais e nenhum casa', () => {
    const steps: ChatbotStep[] = [
      { id: 'a', matchType: 'keyword', pattern: 'preço', response: 'PA', nextStepId: 'b' },
      { id: 'b', response: 'PB' },
    ];
    const hit = evaluateSteps(steps, 'qual é o PREÇO?');
    expect(hit?.text).toBe('PA\n\nPB');

    const onlyConditional: ChatbotStep[] = [
      { id: 'a', matchType: 'keyword', pattern: 'preço', response: 'PA' },
      { id: 'c', matchType: 'keyword', pattern: 'entrega', response: 'PC' },
    ];
    expect(evaluateSteps(onlyConditional, 'xyz')).toBeNull();
  });

  it('quickReplies: o último nó da cadeia com botões vence', () => {
    const steps: ChatbotStep[] = [
      { id: 'a', response: 'A', quickReplies: ['x', 'y'], nextStepId: 'b' },
      { id: 'b', response: 'B', quickReplies: ['z'] },
    ];
    expect(evaluateSteps(steps, 'oi')?.quickReplies).toEqual(['z']);
  });

  it('nó só com quickReplies → resultado sem texto (não é "nada")', () => {
    const steps: ChatbotStep[] = [{ id: 'a', quickReplies: ['A1', 'A2'] }];
    const r = evaluateSteps(steps, 'oi');
    expect(r).toEqual({ quickReplies: ['A1', 'A2'], lastStepId: 'a' });
    expect(r?.text).toBeUndefined();
  });

  it('proteção de loop (a→b→a): para na visita duplicada', () => {
    const steps: ChatbotStep[] = [
      { id: 'a', response: 'A', nextStepId: 'b' },
      { id: 'b', response: 'B', nextStepId: 'a' },
    ];
    const r = evaluateSteps(steps, 'oi');
    expect(r?.text).toBe('A\n\nB');
    expect(r?.lastStepId).toBe('b');
  });

  it('end: true encerra a cadeia (ignora nextStepId)', () => {
    const steps: ChatbotStep[] = [
      { id: 'a', response: 'A', nextStepId: 'b', end: true },
      { id: 'b', response: 'B' },
    ];
    expect(evaluateSteps(steps, 'oi')?.text).toBe('A');
  });

  it('ponteiro quebrado (nó removido) → para com honestidade', () => {
    const steps: ChatbotStep[] = [{ id: 'a', response: 'A', nextStepId: 'removida' }];
    const r = evaluateSteps(steps, 'oi');
    expect(r?.text).toBe('A');
    expect(r?.lastStepId).toBe('a');
  });
});

describe('evaluateChatbot + fluxo visual', () => {
  const mk = (patch: Partial<ChatbotConfig>): ChatbotConfig => ({
    enabled: true,
    rules: [],
    ...patch,
  });

  it('steps vencem regras planas quando o fluxo dispara', async () => {
    const cfg = mk({
      rules: [{ matchType: 'keyword', pattern: 'oi', response: 'regra' }],
      steps: [{ id: 'a', response: 'etapa' }],
    });
    const d = await evaluateChatbot(cfg, { text: 'oi' });
    expect(d.source).toBe('step');
    expect(d.text).toBe('etapa');
    expect(d.matchedStepId).toBe('a');
  });

  it('nenhuma entrada de step casa → cai nas regras', async () => {
    const cfg = mk({
      rules: [{ matchType: 'keyword', pattern: 'preço', response: 'R$99' }],
      steps: [{ id: 'a', matchType: 'exact', pattern: 'xyz', response: 'nada' }],
    });
    const d = await evaluateChatbot(cfg, { text: 'qual o preço?' });
    expect(d.source).toBe('rule');
    expect(d.text).toBe('R$99');
  });

  it('saudação (1º contato) vem antes do fluxo', async () => {
    const cfg = mk({ greeting: 'Bem-vindo!', steps: [{ id: 'a', response: 'etapa' }] });
    const d = await evaluateChatbot(cfg, { text: 'oi', firstContact: true });
    expect(d.source).toBe('greeting');
    expect(d.text).toBe('Bem-vindo!');
  });

  it('fora da janela de horas → passos não rodam (só fallback)', async () => {
    const cfg = mk({
      timezone: 'America/Sao_Paulo',
      activeFromHour: 9,
      activeToHour: 18,
      fallback: 'amanhã',
      steps: [{ id: 'a', response: 'etapa' }],
    });
    const d = await evaluateChatbot(cfg, { text: 'oi', now: new Date('2026-10-18T02:00:00Z') }, {
      nowOverride: new Date('2026-10-18T02:00:00Z'),
    });
    expect(d.source).toBe('fallback');
    expect(d.text).toBe('amanhã');
  });

  it('nó só com quickReplies → responde sem texto (decisão carrega quickReplies)', async () => {
    const cfg = mk({ steps: [{ id: 'a', quickReplies: ['Sim', 'Não'] }] });
    const d = await evaluateChatbot(cfg, { text: 'oi' });
    expect(d.respond).toBe(true);
    expect(d.source).toBe('step');
    expect(d.quickReplies).toEqual(['Sim', 'Não']);
    expect(d.text).toBeUndefined();
  });
});
