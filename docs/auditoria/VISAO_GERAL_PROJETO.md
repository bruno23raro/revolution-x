# VISÃO GERAL DO PROJETO — Revolution X

> Auditoria: 2026-11-06. Papéis assumidos: arquiteto, full-stack, integrações/OAuth,
> banco/infra, DevOps, agente de IA, segurança/qualidade, gerência técnica.
> Nenhum código foi alterado nesta primeira passada. Afirmações com evidência em
> TESTES_E_VALIDACOES.md e docs/auditoria/evidencias/.

## A. O que o produto é

SaaS multi-tenant de automação de marketing omnichannel (tenant = organization_id).
Público: pequenas/médias empresas brasileiras, leigas em tecnologia. Daí as exigências
de fluxo de 1 clique, linguagem simples e separação visual entre "API Oficial" e
"Sem API / Avançado".

Produção: https://revolutionx.com.br (Hostinger Node.js + deploy automático por push).

## B. Roadmap original (12 fases, README.md)

1. Inicialização + análise de ambiente
2. Auth + multi-tenant (users, organizations, roles, permissions)
3. Banco + CRM (contatos, leads, deals, pipelines)
4. Produtos + mídia
5. Publicador + calendário
6. Vídeo
7. WhatsApp
8. Central de mensagens
9. Campanhas de tráfego pago
10. IA (assistente central)
11. Relatórios
12. Segurança + produção

Regras permanentes: nenhuma API inventada; classificar automação em
A) automática / B) homologação / C) assistido / D) manual; nunca armazenar senha
(only OAuth/tokens); dados sempre por organization_id; commit pequeno com teste.

## C. PROMPT MESTRE — escopo real (§1–§8)

Texto original recebido em 2026-10-18, refletido em docs/PROJECT_REQUIREMENTS_MATRIX.md §E.

- §3.1 Login por canal (oficial e "sem API"): Instagram, Facebook, WhatsApp Business, TikTok
- §3.2 WhatsApp: disparo em massa, templates Meta, chatbot configurável, respostas
  automáticas, extração de contatos (sem API, com aviso de risco)
- §3.3/§3.4/§3.5 Instagram / Facebook / TikTok: publicação, agendamento, automações sem
  API (seguir/interagir/grupos/Marketplace), tracking
- §3.6 Tracking em tempo real do Gerenciador de Anúncios (Meta e TikTok Ads)
- §3.7 Integrações: Meta API, n8n, Zapier/Make/webhooks, hub com botão "Integrar"
- §3.8 Chatbot visual com fluxos, condições e variáveis
- §4 UX: 1 clique, botões grandes, fluxos guiados, feedback imediato, separação
  oficial/sem-API, avisos de risco
- §5 Design: lilás + preto + branco, glassmorphism leve, responsivo
- §6 Arquitetura: Next.js + TS + Tailwind + PostgreSQL + Prisma, fila de jobs, logs, monitoramento

Reclassificações consolidadas (não reabrir): "ponte local Claude Code" e "inventário
MCP/CLI" = ferramentas de dev → FORA de escopo. Browser automation como MÉTODO de produto
na seção "Sem API / Avançado" → EM escopo.

## D. Estado real da entrega (resumo)

| Camada | Estado real |
|---|---|
| Infra/deploy | funcionando — produção no ar, deploy por push, GET / = 200 |
| Auth + multi-tenant | código completo, smoke ok; isolamento RLS em produção MUITO aquém do documentado |
| Banco | 41 tabelas em produção; schema aplicado à mão; _prisma_migrations com 2 linhas (drift não rastreado) |
| CRM / produtos / calendário / relatórios | implementados, testados em nível de unidade |
| WhatsApp oficial | caminho OpenBSP pronto (backend + UI); NENHUM canal conectado (meta_integrations = 0 linhas) |
| Meta OAuth (IG/FB/WA) | QUEBRADO no HEAD atual (callback deletado, init aponta para rota inexistente); flag ENABLE_META_OAUTH desligada |
| IA | roteador com fallback OK em dev; produção depende de credenciais no hPanel |
| Scrapers / "Sem API" | UI existe mas devolve texto simulado ([PLACEHOLDER]) — apresenta-se como real |
| Segurança | CRÍTICO: segredos reais versionados em repo PÚBLICO |

## E. Desconhecidos (registrados, não inventados)

1. Texto integral do PROMPT MESTRE que circulou como §3–§16 antes de 2026-10-18: a própria
   matriz registra que essa numeração era reconstrução inventada. Vale §1–§8.
2. Regra de negócio de planos/preços: tabelas Plan/Subscription/BillingEvent existem,
   mas não há cobrança, limite de plano ou gating implementado nem especificado.
3. Definição formal de "Fase 6" que destrava ENABLE_META_OAUTH (citada em
   docs/evidence/f2-gate-1.md sem documento de definição).
4. Contrato comercial/técnico do OpenBSP (SLA, preço, limites de envio, revenda
   multi-cliente) além do resumo em docs/RX_OPENBSP_CONTRACT_SUMMARY.md.
5. Quais variáveis estão HOJE populadas no hPanel da Hostinger (inventário local é de
   2026-10 e só registra sufixos de 4 caracteres).
