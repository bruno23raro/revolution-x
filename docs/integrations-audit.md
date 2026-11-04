# Fase 0 — Auditoria do Módulo de Integrações

## 0.1 Diagnóstico Executado

Esta seção cataloga todo o código e dados relacionados a integrações no repositório Revolution X, identificando duplicidades, caminhos conflitantes e pontos de convergência necessários para a refatoração solicitada.

---

## 0.2 Rotas e Páginas

| Rota | Arquivo | Funcionalidade | Status |
|---|---|---|---|
| `/integrations` | `src/app/integrations.*` | Área única de integrações (nova) | Ativa |
| `/hub-integracoes` | `src/app/hub-integracoes.*` | Área antiga (deve 301) | Duplicada — remover |
| `/integrations/credentials` | `src/settings/integrations-credentials.tsx` | (pendente — ainda não existe) | Não criado |
| `/onboarding/success` | `src/app/onboarding/success.tsx` | Confirmação de onboarding | Ativa |
| `/integrations/meta` | `src/app/integrations.meta.tsx` | Sub-rota Meta (Facebook/IG/WA OAuth) | Ativa |

**Arquivos de rota confirmados:**
- `src/app/integrations.*` (página principal)
- `src/app/integrations.meta.tsx` (rota filha Meta)
- `src/app/integrations.html` (HTML legacy)
- `src/app/integrations.rsc` (RSC server component)

**Rotas duplicadas / antigas:**
- `hub-integracoes` — deve ser removido ou 301 para `/integrations`

---

## 0.3 Componentes e Páginas

### Área WhatsApp

| Componente | Arquivo | Modo | Observação |
|---|---|---|---|
| `WhatsAppOfficialCard` | `src/integrations/whatsapp/provider.ts` | oficial (OpenBSP) | Factory `getWhatsAppProvider()` |
| `meta_direct` | `src/integrations/whatsapp/meta_direct/reserved.ts` | reserva Meta direto | `WHATSAPP_PROVIDER=meta_direct` |
| `WhatsAppNonOfficialCard` | `src/integrations/whatsapp/` | não-oficial (Evolution/QR) | Fluxo QR Code |
| `WhatsAppMetaDirectCard` | `src/integrations/whatsapp/meta_direct/` | oficial (Meta direto) | Botão "Conta sem API do WhatsApp" mistura modos |

**Problema identificado:** Dois cards para WhatsApp oficial:
1. Card "WhatsApp Business — Oficial Meta" (conexão direta com Meta)
2. Card "WhatsApp API Oficial — Cloud API via OpenBSP"

Eles servem ao mesmo canal (WhatsApp) mas por caminhos diferentes. O card oficial contém botão "Conta sem api do WhatsApp" que mistura modo oficial com não-oficial.

### Área Instagram

| Componente | Arquivo | Modo | Observação |
|---|---|---|---|
| `InstagramPublisher` | `src/integrations/meta/instagramPublisher.ts` | non_official (session_login) | Login por sessão redirect |
| `Instagram OAuth` | `src/integrations/tiktok/auth/oauth.ts` | oficial (oauth_meta) | Atrás de flag `ENABLE_META_OAUTH` |

### Área Facebook

| Componente | Arquivo | Modo | Observação |
|---|---|---|---|
| `FacebookPublisher` | `src/integrations/meta/facebookPublisher.ts` | non_official (session_login) | Login por sessão redirect |
| `Facebook OAuth` | `src/integrations/meta/` | oficial (oauth_meta) | Atrás de flag |

### Outras Telas

| Componente | Arquivo | Observação |
|---|---|---|
| `ApiBadge` | `src/components/ApiBadge.tsx` | Badge de API na UI |
| `RiskBanner` | `src/components/RiskBanner.tsx` | Banner de risco |
| `HealthPill` | `src/components/HealthPill.tsx` | Pílula de saúde |
| `OutboundExecutors` | `src/integrations/outboundExecutors.ts` | Executores de envio |
| `riskAcknowledgment` | `src/integrations/riskAcknowledgment.tsx` | Acknowledgment de risco |
| `qrCodeGenerator` | `src/integrations/qrCodeGenerator.ts` | Geração de QR |
| `manual` | `src/integrations/manual.ts` | Rotinas manuais |
| `manualLogin` | `src/integrations/manualLogin.tsx` | Login manual |

---

## 0.4 Serviços e Jobs

| Serviço | Arquivo | Observação |
|---|---|---|
| `tiktokScheduler` | `src/jobs/tiktokScheduler.ts` | Agendador TikTok |
| `whatsappProcessor` | `src/integrations/whatsappProcessor.ts` | Processador de payload WhatsApp |
| `whatsappSender` | `src/integrations/whatsappSender.ts` | Enviador de mensagens WhatsApp |
| `crmService` | `src/services/crmService.ts` | Consome integrações |
| `productService` | `src/services/productService.ts` | Consome integrações |
| `scheduleService` | `src/services/scheduleService.ts` | Consome integrações |

---

## 0.5 Webhooks

| Endpoint | Arquivo | Observação |
|---|---|---|
| `webhook handler` | `src/integrations/meta/webhooks/handler.ts` | Processa payloads Meta (WA, IG, FB) |
| `capi test` | `src/integrations/meta/capi.test.ts` | Teste de conversões API |
| `capi` | `src/integrations/meta/capi.ts` | Conversões API Meta |

---

## 0.6 Tabelas Supabase

### Tabela `meta_integrations` (migração 005)

| Coluna | Tipo | Restrição | Observação |
|---|---|---|---|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `organization_id` | UUID | FK → organizations NOT NULL | RLS policy: `organization_id = current_setting('app.current_org', TRUE)::UUID` |
| `provider` | TEXT | CHECK (facebook, instagram, whatsapp) | |
| `meta_page_id` | TEXT | | Instagram page ID |
| `instagram_account_id` | TEXT | | |
| `whatsapp_business_account_id` | TEXT | | WABA ID |
| `meta_app_id` | TEXT | | ID do app Meta |
| `encrypted_access_token` | TEXT | NOT NULL, AES-256-GCM | |
| `token_expires_at` | TIMESTAMPTZ | | |
| `connected_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| `disconnected_at` | TIMESTAMPTZ | | |
| `status` | TEXT | CHECK (PENDING, AUTHENTICATED, CONNECTED, DISCONNECTED, ERROR, EXPIRED, REVOKED, PENDING_WHATSAPP) | |
| `last_error` | TEXT | | |
| `webhook_secret` | TEXT | | |

**Constraint:** UNIQUE(organization_id, provider) — um provedor por organização.

### Tabela `integrations` (migração 018 + 021)

| Coluna | Tipo | Restrição | Observação |
|---|---|---|---|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `user_id` | UUID | FK → auth.users ON DELETE CASCADE | **Por usuário**, não organização |
| `channel` | TEXT | CHECK (facebook, instagram, whatsapp, meta) | |
| `status` | TEXT | CHECK (PENDING, AUTHENTICATED, CONNECTED, DISCONNECTED, ERROR, EXPIRED, REVOKED) | |
| `access_token` | TEXT | | (token em claro usado em tempo de uso) |
| `refresh_token` | TEXT | | |
| `expires_at` | TIMESTAMPTZ | | |
| `meta_account_id` | TEXT | | ID da conta Meta |
| `meta_account_name` | TEXT | | Nome da conta |
| `phone_number` | TEXT | | Número de telefone |
| `waba_id` | TEXT | | ID da WhatsApp Business Account |
| `metadata` | JSONB | DEFAULT '{}' | Campos extras da plataforma |
| `last_error` | TEXT | | |
| `created_at` | TIMESTAMPTZ(6) | NOT NULL DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ(6) | NOT NULL DEFAULT now() | |
| `mode` | TEXT | NOT NULL DEFAULT 'OFFICIAL'; CHECK (OFFICIAL, MANUAL) | **Migração 021** |

**Constraints:**
- UNIQUE(user_id, channel, meta_account_id) — multi-conta por usuário
- Indexes: user_id, channel, status, user_channel, waba_id (WHERE waba_id IS NOT NULL)
- RLS FORÇADO: `user_id = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid`

---

## 0.7 Consumidores que dependem do formato antigo

1. `crmService.ts` — consulta `meta_integrations` para dados de conta
2. `productService.ts` — pode referenciar tabelas legadas
3. `scheduleService.ts` — agenda pode usar credenciais de integração
4. `whatsappProcessor.ts` — processa payloads Webhook da WhatsApp
5. `whatsappSender.ts` — envia mensagens usando credenciais armazenadas
6. `tiktokScheduler.ts` — scheduler específico TikTok
7. `fase1-routes.test.ts` — testes de rotas que podem testar formatação antiga
8. `integrations-oauth.spec.ts` — especs de OAuth

---

## 0.8 Credenciais necessárias hoje

| Credencial | Onde vive | Status | Necessidade |
|---|---|---|---|
| `META_APP_ID` | `.env.local` | Configurada (11121577) | OAuth Meta (oficial) |
| `META_APP_SECRET` | `.env.local` | Configurada | OAuth Meta (oficial) |
| `META_WEBHOOK_VERIFY_TOKEN` | `.env.local` | Configurada | Webhook validação |
| `META_TOKEN_ENCRYPTION_KEY` | `.env.local` | Configurada | Criptografia de token |
| `OPENBSP_API_KEY` | `.env.local` | Configurada (sk_dcca...) | OpenBSP oficial (WhatsApp) |
| `WHATSAPP_PROVIDER` | `.env.local` | `openbsp` | Define provedor WhatsApp |
| `ENABLE_META_OAUTH` | code (flag) | Não verificado | Controla caminho OAuth |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` | Configurada | Admin introspecção |

---

## 0.9 Resumo dos Pontos Críticos

1. **Duas áreas concorrentes**: `/hub-integracoes` vs `/integrations` — deve unificar em `/integrations` com 301.
2. **Dois cards WhatsApp oficial**: OpenBSP vs Meta direto — consolidar em OpenBSP único.
3. **Card oficial mistura modos**: botão "Conta sem api do WhatsApp" dentro de card oficial.
4. **Sem modelo `connection_mode`/`provider` persistente** para escolher adaptador por integração.
5. **Estado `conectando` sem timeout** nem retry explícito.
6. **Login Instagram/FB via sessão** implementado mas sem validação de 2FA/ checkpoint explícita.
7. **OAuth Meta** implementado mas atrás de flag, precisa de `ENABLE_META_OAUTH`.
8. **Duas tabelas de integração**: `meta_integrations` (legada, por org) e `integrations` (nova, por usuário) — precisa de migração/backfill.
9. **Crendenciais ausentes** não travam UI hoje — boas práticas, mas precisa de fluxo `pending_credentials` formalizado.
10. **Nenhum adaptador de fábrica** que resolva (`channel`, `provider`, `mode`) → card correto.

---

## 1. Recomendações de Ação Imediata

1. **Deletar `/hub-integracoes`** e adicionar redirect 301 para `/integrations`.
2. **Remover card Meta direto** de WhatsApp, manter apenas OpenBSP.
3. **Migrar dados** de `meta_integrations` → `integrations` com backfill de `mode`/`provider`.
4. **Adicionar `connection_mode`** e `provider` columns se não existirem (já via migração 021 `mode` OFFICIAL/MANUAL).
5. **Criar adaptador de fábrica** que, dada (`channel`, `provider`, `mode`), retorna o adaptador correto.
6. **Formalizar fluxo `pending_credentials`** nos cards.
7. **Adicionar timeout 90s** ao estado `conectando` em todos os cards.
8. **Adicionar seletor de modo global** (API Oficial | Sem API) persistido por usuário.
9. **Marcar features** indisponíveis no modo errado ("Requer modo sem API", "Requer API oficial").
10. **Manter compatibilidade** com consumidores existentes via adaptadores.

**Próximo passo:** Fase 1 — Criar modelo de dados unificado e adaptadores. Somente depois avancemos ao código.