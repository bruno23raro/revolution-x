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