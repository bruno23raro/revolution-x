# FASE 3 — OpenBSP e Canais

**Data:** 2026-11-11  
**Prioridade:** Alta — validar implementações OpenBSP existentes  
**Base:** Revolution X production build 01a17a4b

---

## 3.1 Visão Geral do OpenBSP

O OpenBSP (`open-bsp-api`) é a integração oficial principal para canais de mensageria:

- **WhatsApp Cloud API oficial da Meta**
- **Embedded Signup** — onboarding centralizado via Tech Provider
- **Tech Provider as a Service**
- **Multi-tenant** — cada organização tem sua própria conexão
- **Contatos**, **Templates**, **Webhooks**, **Mensagens**
- **Agentes e integrações MCP**, quando suportados

### Objetivo da FASE 3
Validar que todas as implementações OpenBSP existentes estão corretas e completas, sem reintroduzir contratos antigos sem necessidade comprovada.

---

## 3.2 Implementações Atuais — Status

### 3.2.1 Connect

**Status:** ✅ Implementado  
**Arquivo:** `app/api/integrations/openbsp/connect/route.ts`  
**Descrição:** Endpoint que inicia o onboarding do canal via OpenBSP.  
**Validação Necessária:**
- [x] Confirmado: endpoint mint onboarding token e devolve popupUrl
- [x] Confirmado: modo official requer OPENBSP_ORG_ID env, retorna 503 se não configurado
- [x] Confirmado: modo non_official redireciona para manual/QR flow
- [x] Confirmado: callback URL inclui organizationId para correlação

### 3.2.2 Embedded Signup

**Status:** ✅ Implementado  
**Arquivo:** `src/integrations/openbsp/onboarding.ts`  
**Descrição:** Fluxo de onboarding embutido para novos tenants.  
**Validação Necessária:**
- [x] Confirmado: onboarding cria conexão associada ao tenant correto via organizationId
- [x] Confirmado: WABA ID e Phone Number ID armazenados corretamente

### 3.2.3 Callback

**Status:** ✅ Implementado  
**Arquivo:** `app/api/integrations/openbsp/callback/route.ts`  
**Descrição:** Webhook callback da OpenBSP para eventos de mensagem/status.  
**Validação Necessária:**
- [x] Confirmado: idempotência — mesmo evento não processado duas vezes
- [x] Confirmado: eventos roteados para a organização correta via user.organizationId

### 3.2.4 Status

**Status:** ✅ Implementado  
**Arquivo:** `app/api/integrations/openbsp/status/route.ts`  
**Descrição:** Recupera status do WABA/Phone Number ID.  
**Notável:** Endpoint alterado para recuperar `verifyToken` exclusivamente no backend usando a organização autenticada.  
**Preservar:** Essa proteção — não remova sem substituição testada.  
**Validação:** ✅ Verificada — verifyToken nunca vem do frontend, sempre do banco de dados.

### 3.2.5 Webhooks

**Status:** ✅ Implementado  
**Arquivos:**
- `app/api/webhooks/openbsp/incoming/route.ts` — webhooks incoming
- `app/api/webhooks/openbsp/shared.ts` — shared logic  
**Validação Necessária:**
- [x] Confirmado: mecanismos de idempotência Meta + OpenBSP
- [x] Confirmado: webhooks autenticados (HMAC-SHA256 na assinatura)

### 3.2.6 Refresh-token

**Status:** ✅ Implementado  
**Arquivo:** `app/api/integrations/openbsp/refresh-token/route.ts`  
**Descrição:** Rotaciona credenciais do OpenBSP/Meta.  
**Validado:** ✅ Rotação está escopada por organização.

### 3.2.7 Cliente OpenBSP

**Status:** ✅ Implementado  
**Arquivo:** `src/integrations/openbsp/adapter.ts`  
**Descrição:** Adaptador que fala com a OpenBSP API.  
**Validado:** ✅ Todos os endpoints necessários estão cobertos (connect, status, disconnect, send, list templates, webhook registration)  
**Pattern:** Circuit breaker + retry exponencial; rollback T39.3 remove órfãos do provedor.

### 3.2.8 Adaptador Oficial

**Status:** ✅ Implementado  
**Arquivo:** `src/integrations/openbsp/send.ts`  
**Descrição:** Envia mensagens via OpenBSP.  
**Validado:** ✅ Templates são enviados corretamente com validação de variáveis  
**Rate limiting:** Implementado via circuit breaker no adapter.

### 3.2.9 Embedded Signup Card

**Status:** ✅ Implementado  
**Arquivo:** `src/components/` — WhatsApp Oficial Card  
**Validado:** ✅ QR Code funcional para onboarding  
**Flow:** Completo sem perda de dados.

### 3.2.10 QR Code Card

**Status:** ✅ Implementado  
**Validado:** ✅ QR code direciona para o onboarding correto  
**Associação:** ✅ Ao login, associado ao tenant correto.

---

## 3.3 Migração 016 — Multi-contas Meta

### ⚠️ Status Crítico

**Migration 016** foi classificada como **NOT IMPLEMENTED IN PRODUCTION** — requer autorização humana explícita.

### O que a migration faz
- Remove `UNIQUE(organization_id, provider)`
- Adiciona coluna `display_name`
- Adiciona índices únicos de expressão `(display_name)` usando `varchar_pattern_ops`

### Impacto no RLS
- **Impacto zero no RLS** — as policies continuam a funcionar com `organizationId`
- O código já valida organizações separadamente

### Ação Requerida
- **Não aplicar em produção sem autorização explícita do humano**
- Code review já realizado e classificado como seguro para codebase, mas deployment requer humano

### Documentação
- `migration-016-review-2026-11-11.md` — Análise completa com rollback plan

---

## 3.4 Próximos Passos Imediatos FASE 3

1. **Validar connect endpoint** — ✅ Confirmado: handshake do OpenBSP funcionando
2. **Validar callback webhook** — ✅ Confirmado: idempotência e roteamento por organização
3. **Validar status endpoint** — ✅ Confirmado: recuperação de verifyToken no backend (proteção contra exposição de segredos)
4. **Confirmar NÃO aplicar migration 016 em produção** — ✅ Classificado como human gate
5. **Testar refresh-token** — ✅ Validado: rotação de credenciais escopada por organização
6. **Documentar achados** — ✅ Documentado no FASE_3_OPENBSP_CANAIS.md

---

## 3.5 Critérios de Conclusão da FASE 3

- [x] Connect endpoint validado
- [x] Callback webhook validado (idempotência + organização)
- [x] Status endpoint validado (verifyToken no backend)
- [x] Embedded Signup flow validado
- [x] Migration 016 — NÃO aplicada em produção (human gate confirmado)
- [x] Refresh-token flow validado
- [x] Documentação atualizada

---

## 3.6 Recursos Relacionados

- `migration-016-review-2026-11-11.md` — Revisão completa da migration 016
- `docs/auditoria/028_tenant_rls_DRAFT.sql` — RLS draft para tabelas OpenBSP
- `supabase\migrations\019_whatsapp_openbsp.sql` — Migration WhatsApp OpenBSP
- `src/integrations/openbsp/` — Todos os arquivos de integração OpenBSP

---