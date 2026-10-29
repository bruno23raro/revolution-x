# RX_APP_MARKETING_API_ACCESS_TIER_20261027 — Nível de Acesso da Marketing API

## Standard vs Advanced

| Nível | Classificação | Requisitos | Ação |
|-------|--------------|------------|------|
| **Standard** | LIMITED | - >=500 chamadas Marketing API em 15 dias <br> - Erro <15% nas últimas 500 chamadas | Solicitar em App Dashboard > App Review > Permissions and Features |
| **Advanced** | FULL | - >=500 chamadas Marketing API em 15 dias <br> - Erro <15% nas últimas 500 chamadas <br> - Acesso a todos os endpoints <br> - Webhook de conversão completo | Solicitar upgrade após 30 dias de uso stable |

## Nossa Situação Atual

- **App**: revolutionx.com.br (App ID: 1112157761403064)
- **Status**: Padrão (LIMITED) — 11 permissões solicitadas cobrem o fluxo necessário
- **Chamadas esperadas**: ~200 chamadas/mês no piloto; <50 chamadas/dia em produção
- **Plano de aquecimento**: 40 chamadas/rodada em `GET /act_{id}/insights?date_preset=last_7d&fields=impressions,spend,clicks,reach`

## Solicitação de Acesso

1. Acessar: `https://developers.facebook.com/apps/1112157761403064/`
2. Menu: **App Review** > **Permissions and Features**
3. Clicar em **Request Access**
4. Selecionar: `ads_read`, `business_management`, `pages_show_list`, `instagram_basic`, `instagram_content_publish`, `pages_manage_posts`, `whatsapp_business_messaging`
5. Preencher justificativas usando `RX_DOC_PADROES_SCREENCAST_20261027.md`
6. Submeter e aguardar 24-72h

## Plan de Aquecimento (Warm-up)

| Etapa | Chamadas | Endpoint | Objetivo |
|-------|----------|----------|----------|
| 1 | 20 calls | `GET /{ad-account-id}/insights?date_preset=last_7d` | Testar `ads_read` |
| 2 | 20 calls | `GET /{page-id}/insights?date_preset=last_30d` | Testar `pages_read_engagement` |
| 3 | 20 calls | `GET /me/accounts` | Testar `pages_show_list` |
| 4 | 20 calls | Instagram Graph API basic fetch | Testar `instagram_basic` |
| 5 | 20 calls | Facebook Page posts API | Testar `pages_manage_posts` |
| 6 | 20 calls | WhatsApp API send message | Testar `whatsapp_business_messaging` |
| **Total** | **120 calls** em **15 dias** | — | **Alcance da meta de 500 chamadas** |

## Pós-Submissão

Após aprovação do Meta Review:
- Nível sobe de LIMITED para FULL
- Todos os 11 escopos ficam disponíveis sem restrições
- Screencasts podem usar dados reais de produção
- Formulário de re-review anual necessário

---

# RX_APP_MANAGE_APP_SOLUTION_20261027 — Gerenciar App Solution

## Dependências

- **Business Verification** — necessário antes de solicitar acesso avançado a `whatsapp_business_messaging` ou `whatsapp_business_management`
- **Advanced access** — requisitado a `whatsapp_business_messaging` OU `whatsapp_business_management` como dependência

## Decisão: CORTAR se não houver cenário Tech Provider

Como o Revolution X não tem um cenário de "Tech Provider" (aplicativo que gestiona múltiplos clientes WhatsApp Business em nome de terceiros), a decisão é:

**CORTAR** a solicitação de `manage_app_solution` do escopo inicial.

## Justificativa

- `manage_app_solution` é necessário apenas para provedores de tecnologia que gerenciam contas WhatsApp Business de múltiplos clientes
- O Revolution X é um aplicativo de uso próprio (single-tenant/limitado multi-tenant)
- Todas as funcionalidades WhatsApp são gerenciadas diretamente pelo negócio próprio
- Incluir `manage_app_solution` sem cenário Tech Provider aumenta risco de rejeição do Meta Review

## Alternativa

Se no futuro o Revolution X precisar suportar gestão de contas WhatsApp de provedores terceiros, então:
1. Solicitar Business Verification no Meta Developer Console
2. Solicitar `manage_app_solution` como permissão adicional
3. Incluir na justificativa: "Tech Provider management - connecting WhatsApp Business accounts for multiple business clients"
4. Acompanhar com screenshots de onboarding de novos clientes

## Status Atual

- [ ] `manage_app_solution` — CORTADO deste pacote inicial
- [ ] Caso necessário no futuro: solicitar separadamente após 30 dias de uso estável
- [ ] As 11 permissões atuais são suficientes para o fluxo do Revolution X