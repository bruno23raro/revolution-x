# RX — Mapa do Sistema para Integração OpenBSP (PASSO A)

Gerado 2026-10-29 por leitura direta do repo (5 varreduras paralelas: schema, rotas, UI, adapters, jobs).
Princípio: SÓ ACRESCENTAR. Nada aqui será apagado/renomeado.

## 1. Schema Prisma (`prisma/schema.prisma`, 575 linhas)

| Model | Papel | Campos-chave |
|---|---|---|
| `User` | identidade | `id Uuid`, `email`, `emailVerified` |
| `Organization` | tenant | `id`, `slug`, `planId`, `status` |
| `OrganizationMember` | vínculo user↔org | `role VarChar(50) default "member"`, `@@unique([organizationId,userId])` |
| `MetaIntegration` `@@map("meta_integrations")` | WhatsApp Cloud legado/multicontas | `accessToken`, `phoneNumberId VarChar(50)?`, `accountId`, `status="connected"` |
| `WebhookEvent` `@@map("webhook_events")` | idempotência webhook Meta | `metaEventId`, `integrationId`, `payloadHash VarChar(64)` |
| `Message` | inbox | `fromChannel default "whatsapp"`, `direction`, `externalId`, `contactId?` |
| `Campaign` | campanhas multicanal | `channel VarChar(30)`, `accountId?`, `status="draft"`, contadores `sent/failed/skipped/total`, `batchJson`, `audienceJson` |
| `CampaignRecipient` | por destinatário | `status="pending"`, `attempts`, `externalMessageId`, `lastError`, `@@unique([campaignId,contactId])` |
| `Contact` | CRM + **opt-in** | `waId`, `phone`, **`consentMarketing`**, `consentSource`, `consentAt`, **`optOut`** |

**Não existe**: model `Integration` (tabela `integrations` da migração 018 NÃO está no Prisma — é acessada via PostgREST/service-role nos scripts e rotas), nenhum model de QR/Baileys, nenhum model de template.

**Migrações Supabase**: últimas `015_webhook_idempotency`, `016_multi_meta_accounts`, `017_campaigns_contacts`, `018_integrations_oauth`. → **019 está livre** (nossa).

Decisão de design que se impõe: NÃO duplicar o que 017/`Campaign` já resolve (campanhas + recipients + contadores). O que falta e é genuinamente novo: **canal OpenBSP por tenant** (waba_id/access_token/phone_number_id originados do onboarding OpenBSP) e **templates WhatsApp** (CRUD + status PENDING/APPROVED). Ver PASSO C.

## 2. Padrão das rotas API (Next 14 App Router)

Cânone (de `app/api/integrations/config/route.ts`, `app/api/campaigns/route.ts`, `app/api/webhooks/inbound/route.ts`):

- Sessão: `getAuthenticatedUser(req)` de `@/lib/auth` → `{ id, email, organizationId, role } | null`; multi-org: `getAllOrganizationMemberships(req)`.
- Tenant SEMPRE de `user.organizationId`, nunca do body. Mass-assignment guard: `delete body.organizationId; delete body.userId;`.
- Erros: `NextResponse.json({ error: 'codigo_snake' }, { status })`; 401 `Unauthorized`, 400 validação, 503 `TaskQueueUnavailableError`.
- Body: `req.json()` try/catch → `isRecord()` → validação campo-a-campo.
- **Webhook receiver existente** (`/api/webhooks/inbound`): auth por headers `x-organization-id` + `x-webhook-secret` (secret em `AgentMemory` kind `integration:webhook_inbound`), comparação constant-time, ack 200 sempre, hash SHA-256 p/ idempotência. → nosso incoming OpenBSP/Meta segue o MESMO padrão, com `verify_token` no lugar do secret compartilhado.
- Alias tsconfig: `@/* → ./src/*` (rotas importam `@/lib/...`, repos em `@/src/repositories/...`).

## 3. UI `/integracoes`

- Grid auto-fit `minmax(300px,1fr)` (`app/integracoes/page.tsx:181`); 4 cards: `WhatsAppApiCard`, `InstagramCard`, `FacebookPagesCard`, `WhatsAppQrCard` (este = QR legado, NÃO tocar).
- Props `IntegrationCardProps` (`IntegrationCard.tsx:15`): `{ channel, title, subtitle, icon, status:{connected,accountRef?}, actions, onDisconnect?, children? }`.
- Popup: `window.open('/api/auth/meta?provider=X', nome, 'width=600,height=700,...')`; listener `message` valida `e.origin`; payload `{type:'OAUTH_SUCCESS',provider}` → `onConnected()` → `loadStatus()` (GET `/api/integrations/status`).
- Desconexão: modal → POST `/api/integrations/disconnect`.
- Card novo entra como 5º item do grid + seção Tabs pós-conexão (Templates/Campanhas) — aditivo.

## 4. Adapters existentes (`src/integrations/`)

- `meta/capi.ts` — **o padrão a copiar**: `fetchImpl` injetável, env fallback, retorna `{ok, error, errorDetail}`, nunca lança.
- `meta/whatsappSender.ts` — Cloud API direta: `sendWhatsAppText/Template/Button(access,to,...)`, `runMassSend` (delayMs; NOSSA fila vai por cima disto, não substitui).
- `meta/whatsappProcessor.ts` — `processWhatsAppPayload(payload, organizationId, tx)` inbound → Contact+Message.
- `meta/whatsappTemplates.ts` — CRUD templates via Graph API JÁ EXISTE (list/create/delete) — reutilizar via factory, apontando para o token do canal OpenBSP.
- `meta/whatsappChatbot.ts` + `chatbotAutoReply.ts` — motor de resposta; consome processor+sender.
- Cripto: `src/lib/token-encryption.ts` `encryptToken(token,userId)`/`decryptToken(encrypted,userId)` (PBKDF2+AES-GCM, formato `salt:iv:ct:tag`) — É ESTE o da tabela `integrations` (018). `src/lib/encryption.ts` = legacy chave estática usado pelo cron `refresh-tokens.js`.
- E-mail `src/lib/email.ts`: provider por env com Noop/Console/Resend — mesmo shape da factory `WHATSAPP_PROVIDER`.

## 5. Jobs / infra

- **Sem BullMQ/Redis.** Fila existente: `src/jobs/tiktokScheduler.ts` (Prisma-based, disparado por `/api/cron/tiktok` com `CRON_SECRET`) + `Task/TaskStep/TaskEvent` no schema. → fila WhatsApp replica ESTE padrão (cron hPanel → rota tick autenticada por `CRON_SECRET`), com nota de escala p/ BullMQ futuro.
- `scripts/refresh-tokens.js`: carrega `.env.local`/`.env` próprio, PostgREST direto com service key, AES-GCM legacy — modelo dos crons novos (`poll-template-status.js`, `whatsapp-dispatch-tick.js`).
- Supabase server: `src/lib/supabase/server.ts` → `createClient()` (anon+cookies) e `createServiceRoleClient()` (bypass RLS, ops privilegiadas).

## 6. Pontos de impacto da feature (todos aditivos)

| Área | Arquivo/área | Ação |
|---|---|---|
| Schema | `supabase/migrations/019_*.sql` (novo) | `whatsapp_channels`, `whatsapp_templates` (+RLS FORCE) |
| Prisma | `prisma/schema.prisma` | +models novos (NADA de mexer nos existentes) |
| Factory | `src/integrations/whatsapp/**` (novo) | `IWhatsAppProvider`, openbsp/*, meta_direct/reserved |
| Rotas | `app/api/integrations/openbsp/**`, `app/api/whatsapp/**` (novas) | connect/callback/incoming/templates/campaigns |
| UI | 1 card + tabs novos em `src/components/integrations/` | popup web.openbsp.dev + postMessage |
| Crons | `scripts/poll-template-status.js`, `scripts/whatsapp-dispatch-tick.js` | hPanel `*/15` e `* * * * *` |
| Testes | `src/integrations/whatsapp/*.test.ts` + E2E novo | fetch mockado, gates 1–5 |

Nenhum arquivo existente precisa ser MODIFICADO além de: page.tsx de /integracoes (inserir card), `.env.local` (novas vars), package.json (nenhuma dep nova).
