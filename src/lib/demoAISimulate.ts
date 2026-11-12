// FASE 6 — Simulador de respostas de IA para modo demo
// Retorna respostas fake quando providers não configurados

import { demoModeEnabled } from './demoMode';

export interface AiSimulatedResponse {
  ok: true;
  response: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: 'mock-gpt-4-demolition';
  _demo: true;
}

/**
 * Simula respostas de IA baseadas em keywords do prompt
 * Usado quando nenhum provider está configurado ou no modo demo
 */
export function simulateAIResponse(
  prompt: string,
  options?: {
    task?: string;
    system?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }
): AiSimulatedResponse {
  const lower = prompt.toLowerCase();

  // Simulação baseada em contexto/tarefa
  const task = (options?.task || '').toLowerCase();

  // Detectar tipo de conteúdo esperado
  if (task.includes('campanha') || lower.includes('campanha')) {
    return simulateCampaignResponse(prompt, options);
  }

  if (task.includes('copy') || task.includes('mensagem') || lower.includes('whatsapp')) {
    return simulateCopyResponse(prompt, options);
  }

  if (task.includes('resumo') || task.includes('summary')) {
    return simulateSummaryResponse(prompt, options);
  }

  if (task.includes('ideia') || task.includes('ideias') || task.includes('brainstorm')) {
    return simulateIdeationResponse(prompt, options);
  }

  if (task.includes('email') || task.includes('e-mail') || lower.includes('email')) {
    return simulateEmailResponse(prompt, options);
  }

  if (task.includes('headline') || lower.includes('título') || lower.includes('titular')) {
    return simulateHeadlineResponse(prompt, options);
  }

  if (task.includes('social') || lower.includes('post') || lower.includes('publicação')) {
    return simulateSocialResponse(prompt, options);
  }

  if (task.includes('imagem') || task.includes('visual') || lower.includes('descrição de imagem')) {
    return simulateImageDescriptionResponse(prompt, options);
  }

  if (task.includes('lead') || task.includes('lead magnet') || lower.includes('gerar leads')) {
    return simulateLeadResponse(prompt, options);
  }

  // Response genérica de fallback
  return simulateGenericResponse(prompt, options);
}

function simulateCampaignResponse(
  prompt: string,
  options?: { task?: string; model?: string; maxTokens?: number; temperature?: number }
): AiSimulatedResponse {
  const responses = [
    `Idéias para campanha baseadas no prompt:

1. **Campanha de boas-vindas** - Onboarding sequencial com mensagens personalizadas
2. **Campanha de upsell** - Oferta de upgrade com prova social e depoimentos
3. **Campanha de reengajamento** - Sequência de 3 mensagens com oferta de reaproximação

**Próximos passos sugeridos:**
- Segmentar público com base em comportamento
- Criar variações A/B testáveis
- Definir janela de engajamento (24h pós-compra = 48% CTR médio)
- Configurar tracking UTM para atribuição`,
    `Campanha sugerida:

**Nome:** Identidade Revolução X - Demo Agent

**Público-alvo:** Usuários que demonstraram interesse em automação

**Mensagens:**
1. Boas-vindas com valor imediato
2. Social proof com cases reais
3. Oferta limitada com urgência

**Canais recomendados:** WhatsApp, Email, Instagram

**KPIs:** Taxa de abertura > 35%, CTR > 8%, Conversão > 2%`,
  ];

  const response = responses[Math.floor(Math.random() * responses.length)];

  return {
    ok: true,
    response,
    usage: {
      promptTokens: Math.floor(prompt.length / 4),
      completionTokens: Math.floor(response.split(' ').length * 1.3),
      totalTokens: Math.floor((prompt.length / 4) + (response.split(' ').length * 1.3)),
    },
    model: 'mock-gpt-4-demolition',
    _demo: true,
  };
}

function simulateCopyResponse(
  prompt: string,
  options?: { task?: string; model?: string; maxTokens?: number; temperature?: number }
): AiSimulatedResponse {
  const templates = [
    `🔥 **Oferta irresistível!**

Olá {{1}}, sua campanha especial está aqui!

✅ Benefício 1: Resultado rápido
✅ Benefício 2: SimplicidadeTotal
✅ Benefício 3: Suporte 24/7

📲 Garanta agora - vagas limitadas!

---

*P.S.: Esta é uma cópia gerada em modo demo para testes.*`,
    `🎯 **Sua solução está aqui!**

Oi {{1}}, tudo bem?

Precisando de ajuda com {{2}}? A gente pode te orientar!

📞 Estou aqui para contribuir para o seu sucesso.

---

*Resposta gerada em modo demonstração*`,
  ];

  const response = templates[Math.floor(Math.random() * templates.length)];

  return {
    ok: true,
    response,
    usage: {
      promptTokens: Math.floor(prompt.length / 4),
      completionTokens: Math.floor(response.split('\n').length * 8),
      totalTokens: Math.floor(prompt.length / 4 + response.split('\n').length * 8),
    },
    model: 'mock-gpt-4-demolition',
    _demo: true,
  };
}

function simulateSummaryResponse(
  prompt: string,
  options?: { task?: string; model?: string; maxTokens?: number; temperature?: number }
): AiSimulatedResponse {
  const summary = `## Resumo do conteúdo

**Tópicos principais:**
- Ideia central identificada
- Pontos de ação recomendados
- Próximos passos estratégicos

**Insight principal:** O conteúdo apresenta valor claro para o público-alvo com boas oportunidades de conversão.

**Recomendações:**
1. Reforçar a proposta de valor no início
2. Adicionar prova social (depoimento ou case)
3. Criar call-to-action claro e urgente`;

  return {
    ok: true,
    response: summary,
    usage: {
      promptTokens: Math.floor(prompt.length / 4),
      completionTokens: summary.split(' ').length * 1.5,
      totalTokens: Math.floor(prompt.length / 4 + summary.split(' ').length * 1.5),
    },
    model: 'mock-gpt-4-demolition',
    _demo: true,
  };
}

function simulateIdeationResponse(
  prompt: string,
  options?: { task?: string; model?: string; maxTokens?: number; temperature?: number }
): AiSimulatedResponse {
  const ideas = `🚀 **Brainstorm de ideias**

1. **Gamificação** - Sistema de pontos e recompensas
2. **Conteúdo educacional** - Série de mini-cursos
3. **Community building** - Grupo exclusivo no WhatsApp
4. **Cross-selling** - Cruzamento de produtos servidos
5. **Personalização** - Conteúdo adaptado ao comportamento

**Trendspotting 2024:**
- Micro-influencers regionais
- Conteúdo de curta duração
- Interatividade via polls/enquetes`;

  return {
    ok: true,
    response: ideas,
    usage: {
      promptTokens: Math.floor(prompt.length / 4),
      completionTokens: ideas.split(' ').length * 1.5,
      totalTokens: Math.floor(prompt.length / 4 + ideas.split(' ').length * 1.5),
    },
    model: 'mock-gpt-4-demolition',
    _demo: true,
  };
}

function simulateEmailResponse(
  prompt: string,
  options?: { task?: string; model?: string; maxTokens?: number; temperature?: number }
): AiSimulatedResponse {
  const subjectLines = [
    '🎯 Sua solução está pronta para você!',
    '💡 Dica rápida que vai mudar seu dia',
    '📈 Resultados que você pode alcançar hoje',
    '🔥 Oferta especial para você, cliente valioso!',
  ];

  const subject = subjectLines[Math.floor(Math.random() * subjectLines.length)];

  const body = `Olá {{1}},

Tudo bem?

Estou escrevendo para compartilhar algo que acho que você vai achar valioso.

**O que vem por aí:**
- Benefício 1 comprovado
- Benefício 2 transformador
- Benefício 3 com suporte dedicado

**Próximos passos:**
Clique no link abaixo para descobrir mais:
[LINK]

Qualquer dúvida, estou à disposição!

Até breve,
{{2}}

---
*Este e-mail foi gerado em modo demo para testes*`;

  return {
    ok: true,
    response: `Assunto: ${subject}\n\n${body}`,
    usage: {
      promptTokens: Math.floor(prompt.length / 4),
      completionTokens: Math.floor(body.split(' ').length * 1.5),
      totalTokens: Math.floor(prompt.length / 4 + body.split(' ').length * 1.5),
    },
    model: 'mock-gpt-4-demolition',
    _demo: true,
  };
}

function simulateHeadlineResponse(
  prompt: string,
  options?: { task?: string; model?: string; maxTokens?: number; temperature?: number }
): AiSimulatedResponse {
  const headlines = [
    'Como transformar 5 minutos por dia em 10x mais produtividade',
    'O segredo que 97% dos concorrentes não querem que você descubra',
    'Por que essa estratégia simples é a chave do sucesso',
    'Você não vai acreditar no resultado após aplicar isso',
    'A técnica que provou-se 3x mais eficaz que a concorrência',
  ];

  return {
    ok: true,
    response: headlines[Math.floor(Math.random() * headlines.length)],
    usage: {
      promptTokens: Math.floor(prompt.length / 4),
      completionTokens: 10,
      totalTokens: Math.floor(prompt.length / 4 + 10),
    },
    model: 'mock-gpt-4-demolition',
    _demo: true,
  };
}

function simulateSocialResponse(
  prompt: string,
  options?: { task?: string; model?: string; maxTokens?: number; temperature?: number }
): AiSimulatedResponse {
  const caption = `📸 Nova postagem no feed!

${'🌟 ' + ' '.repeat(10)}

#RevolutionX #MarketingDigital #Automação

Você sabia que...?
✅ Dica rápida
✅ Resultado comprovado
✅ Fácil de implementar

Comente "QUERO SABER MAIS" que eu te mando o detalhe!

👇 Deixe seu comentário 👇`;

  return {
    ok: true,
    response: caption,
    usage: {
      promptTokens: Math.floor(prompt.length / 4),
      completionTokens: caption.split(' ').length * 1.3,
      totalTokens: Math.floor(prompt.length / 4 + caption.split(' ').length * 1.3),
    },
    model: 'mock-gpt-4-demolition',
    _demo: true,
  };
}

function simulateImageDescriptionResponse(
  prompt: string,
  options?: { task?: string; model?: string; maxTokens?: number; temperature?: number }
): AiSimulatedResponse {
  const description = `Imagem gerada em modo demo:

**Visual:** Tela moderna com interface clean de automação marketing
**Cores:** Paleta escura com destaque em roxo/violeta
**Elementos:** Dashboard com gráficos, botões de ação, notificações
**Estilo:** Minimalista, profissional, tecnologia avançada

**Descrição para acessibilidade:**
Interface de automação marketing com fundo escuro, mostrando gráficos de engajamento e botão central "Iniciar Campanha". Texto em branco e tons pastéis de roxo.`;

  return {
    ok: true,
    response: description,
    usage: {
      promptTokens: Math.floor(prompt.length / 4),
      completionTokens: description.split(' ').length * 1.2,
      totalTokens: Math.floor(prompt.length / 4 + description.split(' ').length * 1.2),
    },
    model: 'mock-gpt-4-demolition',
    _demo: true,
  };
}

function simulateLeadResponse(
  prompt: string,
  options?: { task?: string; model?: string; maxTokens?: number; temperature?: number }
): AiSimulatedResponse {
  const leadMagnet = `
**Lead Magnet sugerido:**

📋 **Ebook: "Guia Prático de Automação WhatsApp 2024"**

**Formato:** PDF + Templates prontos
**Tópicos:**
- Configuração inicial sem complicação
- Templates de boas-vindas e reengajamento
- Estratégias de resposta rápida
- Erros comuns e como evitar

**CTA:** "Baixe agora e receba 3 templates exclusivos!"

**Prova social:** +1000 profissionais já usando
`;

  return {
    ok: true,
    response: leadMagnet,
    usage: {
      promptTokens: Math.floor(prompt.length / 4),
      completionTokens: leadMagnet.split(' ').length * 1.2,
      totalTokens: Math.floor(prompt.length / 4 + leadMagnet.split(' ').length * 1.2),
    },
    model: 'mock-gpt-4-demolition',
    _demo: true,
  };
}

function simulateGenericResponse(
  prompt: string,
  options?: { task?: string; model?: string; maxTokens?: number; temperature?: number }
): AiSimulatedResponse {
  const response = `🚀 **Resposta gerada em modo demonstração**

Seu prompt foi processado com sucesso no ambiente de demostração. Aqui está uma resposta simulada que você pode personalizar conforme necessário.

**Funcionalidades testadas:**
- ✅ Autenticação de usuário
- ✅ Contexto de organização
- ✅ Geração de conteúdo
- ✅ Tradução e resumo

**Próximos passos:**
1. Ajuste o conteúdo conforme sua necessidade
2. Salve como rascunho
3. Envie para testes

---
*Este é um mock para demonstração. Em produção, conecte providers reais de IA.*`;

  return {
    ok: true,
    response,
    usage: {
      promptTokens: Math.floor(prompt.length / 4),
      completionTokens: response.split(' ').length * 1.3,
      totalTokens: Math.floor(prompt.length / 4 + response.split(' ').length * 1.3),
    },
    model: 'mock-gpt-4-demolition',
    _demo: true,
  };
}

/**
 * Detecta se deve usar simulação baseado em demo mode e disponibilidade de providers
 */
export function shouldSimulateAI(): boolean {
  if (!demoModeEnabled()) return false;

  // No modo demo sem providers configurados, simular
  const providers = process.env.OPENAI_API_KEY ||
                    process.env.ANTHROPIC_API_KEY ||
                    process.env.GOOGLE_API_KEY ||
                    process.env.AI_PROVIDER; // Providers custom

  return !providers;
}