# DECISÕES PENDENTES — dependem do dono do projeto

> Cada decisão tem: contexto, opções, recomendação do auditor. Nada abaixo foi assumido.

## D-1 — Repo: privado ou purga pública? (aguarda só o OK de 1 palavra)
O repo está público COM segredos reais versionados (C-1). Recomendo: **privar imediatamente**
e, depois, purgar histórico + revolver credenciais. Alternativa: manter público e purgar —
mais trabalho, e os segredos têm que ser revolvidos de qualquer forma.
**Recomendação: privado agora.**

## D-2 — Revolver credenciais (consequência de D-1)
Revogar/rotacionar: senha Postgres, META_APP_SECRET (invalida tokens OAuth emitidos com o
app secret antigo? o access token existente sobrevive em geral, mas o refresh precisa do
novo secret), META_TOKEN_ENCRYPTION_KEY (**decidir estratégia de re-encrypt**: hoje
meta_integrations tem 0 linhas → **momento perfeito, custo zero**), Resend, OpenBSP,
CRON_SECRET, ADMIN_ALERT_TOKEN, service_role, JWT_SECRET.
**Recomendação: girar tudo AGORA que não há tokens de clientes gravados.**

## D-3 — Qual geração de OAuth Meta sobrevive?
Geração antiga (`auth/meta` + `auth/callback/meta`, destruída) vs nova (`oauth/callback/*`,
órfã). **Recomendação: consolidar na nova** (callbacks separados por provider já casam com
a UI de cards), restaurar cobertura de testes, apagar a antiga.

## D-4 — "Sem API / Avançado": entregar, congelar ou cortar?
O PROMPT MESTRE pede scrapers/automação de navegador; a UI hoje **simula** resultado.
Opções: (a) congelar UI honesta ("em breve") e priorizar oficiais; (b) construir executores
reais (Playwright worker + fila + RiskBanner + consentimento LGPD registrado por tenant);
(c) remover do produto.
Custo/benefício: (b) é semanas de trabalho + risco jurídico/ToS por plataforma + banimentos
frequentes dos números/contas dos clientes. **Recomendação: (a) agora; (b) só para 1 fluxo
comprovadamente útil (ex.: extração de perfil público do Instagram via publicScraper já
existe) depois do go-live oficial.**

## D-5 — Custo de conversas WhatsApp
A Meta cobra por conversa; o OpenBSP adiciona margem por conexão. O SaaS precisa repassar
ou embutir. Sem decisão, cada cliente novo pode gerar prejuízo. **Recomendação: plano por
conexão + franquia de mensagens, repassando custo variável.**

## D-6 — OpenBSP: fornecedor sancionado?
Tudo depende dele para o WhatsApp oficial multi-tenant. Precisa: preço por conexão, limites,
SLA, política anti-banimento, plano B (Evolution self-hosted / WABA direta). Enquanto não
houver contrato/plano claro, não vender WhatsApp como recurso pago.

## D-7 — IA em produção
Sem OMNIROUTER_* no hPanel, IA degrada honesto. Opções: gateway pago (OpenAI/Anthropic
pay-per-use), modelo aberto no próprio VPS (Ollama) com custo zero por token e latência
maior, ou híbrido (local p/ rascunho, API p/ final). **Recomendação: híbrido com
fallback; definir teto de custo por tenant.**

## D-8 — Google Ads e Fase 6 (Vídeo) do roadmap
Google Ads: API oficial possível, custo de integração alto, zero código hoje. Vídeo: só
placeholder. **Precisa dizer: mantém no escopo deste ciclo ou arquiva formalmente?**
**Recomendação: arquivar Vídeo (dobrar upload em Publicador), Google Ads vira backlog pós-go-live.**

## D-9 — Planos, limites e cobrança
Schema existe (Plan/Subscription/Usage/BillingEvent); não há gating nem checkout. Go-live
comercial precisa de: lista de planos, limites por plano (mensagens, conexões, tenants),
meio de pagamento (Stripe? Mercado Pago? Pix?). **É a maior lacuna de produto que nenhum
documento resolve.**

## D-10 — Quando ligar ENABLE_META_OAUTH
Só depois de: D-3 concluído + App Review aprovado (H-2) + smoke OAuth com conta real.
Aguarda humano/metamensagem quando o review sair.

## D-11 — Infra de automação (n8n) em produção
O n8n roda no Docker da máquina de desenvolvimento. Em produção isso não existe. Opções:
(a) n8n num VPS sempre-on; (b) internalizar WF-02/WF-05 como rotas cron internas (já há
infra de cron/secret). **Recomendação: (b) — menos peça móvel, menos custo.**
