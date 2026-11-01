# Implementation Complete: Admin Endpoints for n8n Workflows

## Overview
All missing admin endpoints required by the n8n workflows (WF-01 through WF-05) have been implemented for the Revolution X platform.

## Endpoints Created

### 1. `POST /api/admin/alerts` ✅
Stores alerts in the database — used by n8n WF-03 (schema drift) and WF-04 (5xx errors).
- Auth: Admin/Owner role
- Body: `type`, `severity`, `title`, `message`, `statusCode`, `route`, `metadata`

### 2. `GET /api/admin/alerts` ✅
Lists recent alerts for dashboard.
- Auth: Admin/Owner role
- Returns: Paginated list with organization/user info

### 3. `GET /api/admin/schema/diff` ✅
Generates schema diff between local Prisma and production — used by n8n WF-03 nightly cron.
- Auth: Admin/Owner role
- Returns: `{ hasDrift, localSchemaVersion, appliedMigrations, missingTables, ... }`

### 4. `POST /api/admin/notify-slack` ✅
Sends alert to Slack channel — used by n8n WF-04.
- Auth: Admin/Owner role
- Body: `channel`, `text`, `severity`, `title`, `message`

### 5. `POST /api/admin/notify-whatsapp` ✅
Sends alert to WhatsApp — used by n8n WF-04.
- Auth: Admin/Owner role
- Body: `to`, `text`, `severity`, `title`, `message`

## Supporting Changes

### Prisma Schema
- Added `AdminAlert` model with fields: `id`, `organizationId`, `userId`, `type`, `severity`, `title`, `message`, `statusCode`, `route`, `metadata`, `timestamp`
- Indexes on `organizationId` and `createdAt`

### Environment Variables (`.env.local`)
```bash
ADMIN_ALERT_TOKEN=Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
ALERT_WHATSAPP_NUMBER=5511999999999
SLACK_ALERT_CHANNEL=#alerts-production
SYSTEM_USER_TOKEN=11121577...KF8s        # valor puro só em .env.local
```

### Files Modified
- `prisma/schema.prisma` — Added `AdminAlert` model
- `app/api/admin/alerts/route.ts` — New (POST + GET)
- `app/api/admin/schema-diff/route.ts` — New (GET)
- `app/api/admin/notify-slack/route.ts` — New (POST)
- `app/api/admin/notify-whatsapp/route.ts` — New (POST)
- `.env.local` — Added 4 new env vars
- `docs/N8N.md` — Updated comprehensive documentation

## Workflow Integration Status
All 5 n8n workflows now have their required admin endpoints:
- ✅ WF-01: Ingest webhook (`/api/webhooks/meta` — already exists)
- ✅ WF-02: CAPI retry (uses existing Meta Graph API)
- ✅ WF-03: Nightly schema diff (`/api/admin/schema/diff` — **NEW**)
- ✅ WF-04: 5xx alerts + notifications (`/api/admin/alerts`, `/api/admin/notify-slack`, `/api/admin/notify-whatsapp` — **NEW**)
- ✅ WF-05: 4x/day integration poll (`/api/integrations/status` — already exists)

All endpoints follow the project's authentication pattern (admin/owner role verification via Supabase) and are ready for n8n integration.

---

## Bloco D — Verificação empírica (2026-10-31)

### D1–D2 · Testes reais dos 4 endpoints (`src/tests/admin-routes.test.ts`)
- 65 testes na suíte admin (antes 53). Cobrem: 401 sem sessão/papel, 401 bearer ausente vs. errado (idênticos, sem oráculo), 422 validação C4 (severity/message/source), POST /alerts persiste (`prisma.adminAlert.create` com organizationId/userId/type/severity/statusCode/route/metadata), GET pagina por cursor (`take=limit+1`, `cursor:{id}`, `skip:1`, `nextCursor=null` no fim, clamp limit 1–100), notify-slack (channel body→env→default, eco severity/title), notify-whatsapp (message obrigatório 400, `to` body→env→default).

### D3 · Drift detectado ao vivo
- Sonda `c:\tmp\d3_live_diff.js` (mesma lógica da rota) contra o dev DB: com `AdminAlert` intacta → sem drift na tabela; `ALTER TABLE "AdminAlert" ADD COLUMN "driftProbe" TEXT` → sonda reportou a coluna extra nominalmente; coluna removida → voltou a limpo. Unit tests equivalente no jest (extra/missing column nomeados na saída).

### D4 · RLS
- `src/tests/rls.test.ts` 11/11 verdes; política `AdminAlert_tenant` (ENABLE+FORCE, `organizationId IS NULL OR = current_setting('app.current_org_id', true)::uuid`) aplicada no dev DB.

### D5 · Sem regressão
- Suíte completa: **775/775** (56 suítes; antes do bloco: 761). `tsc --noEmit` = 0 erros. ESLint 0 erros (2 warnings pré-existentes).

### D7 · Migração aplicada
- `supabase/migrations/022_admin_alerts.sql` (reescrita com identificadores citados camelCase, como 014) aplicada no dev DB (`docker exec … psql`); `\d` confirma `"AdminAlert"` com 11 colunas, 3 índices, RLS forçado + política. O diretório `prisma/migrations/` duplicado foi removido (convenção do repo = `supabase/migrations/` apenas).

### Hardening C1–C5 — CONFIRMED
| # | Item | Evidência |
|---|------|-----------|
| C1 | Bearer timing-safe | `timingSafeEqual` XOR de tempo constante em `alerts/route.ts`; tokens ausente vs. errado retornam 401 idêntico (testado) |
| C2 | Prefixo "Bearer " tolerante | `RAW_ADMIN_ALERT_TOKEN` strip regex; `ADMIN_ALERT_TOKEN` presente em `.env.local` |
| C3 | Cache schema/diff 60s + timeout 10s | teste "duas chamadas seguidas = 1 consulta" verde (`$queryRaw` chamado 1x) |
| C4 | Validação payload 422 | 3 regras testadas com mensagens específicas em `details[]` |
| C5 | Contrato retry WhatsApp | message obrigatório (400), rota nunca throws; retry 2x/backoff fica no n8n (WF-02/WF-04), documentado no route |

## A-FIX2 — Nomenclatura do token do sistema (decidido 2026-10-31)

**Canônica: `SYSTEM_USER_TOKEN`** — é o nome que o WF-05 lê (`$env.SYSTEM_USER_TOKEN`) e o único com consumidor real. A duplicata `META_SYSTEM_USER_TOKEN` (mesmo valor, zero referências em código) foi removida do `.env.local`. A variante numerada `META_SYSTEM_USER_TOKEN_1421814643397349` nunca existiu como variável — ideia de `plan_meta_system_user.md` para token do app 1421814643397349 ainda não gerado; quando for gerado, adicionar como variável NOVA com o sufixo do app_id (não substitui a canônica). Bônus corrigido: comentário inline em `ALERT_WHATSAPP_NUMBER` vazava para o valor da env (linha 58 do formato antigo) — movido para linha própria; `.env.local` reescrito UTF-8 sem BOM.

## Bloco G — Validação em produção (2026-10-31)

Commits `980cc03` (Bearer service sem sessão) + `27d7a16` (tolerância a prefixo "Bearer Bearer") deployados no Hostinger (auto-deploy, ~3 min). Sondas ao vivo em `https://revolutionx.com.br`:

| Probe | Resultado |
|---|---|
| `POST /api/admin/notify-slack` (Bearer) | 200 `{"ok":true,"sent":true,"channel":"#rx-alerts","severity":"critical"}` |
| `POST /api/admin/notify-whatsapp` (Bearer) | 200 `{"ok":true,"sent":true,"number":"5511999999999"}` |
| `POST /api/admin/alerts` (Bearer) | 201 `{"ok":true}` — linhas `smoke_g`/`smoke_g_dup`/`x` gravadas em `AdminAlert` com `organizationId=null` |
| `GET /api/admin/schema/diff` (Bearer) | 200 diff real (hasDrift=true; faltam RiskLog, ScraperConfig; extra integrations) |
| sem header / token errado | 401 idêntico `{"error":"Unauthorized"}` (sem oráculo — C1 provado ao vivo) |
| prefixo duplicado `Bearer Bearer …` nos 3 endpoints | WA 200 / Slack 200 / Alerts 201 (C2 provado ao vivo) |

**WF-04 re-smoke pós-deploy** (exec 54, webhook `alerta-5xx`): todos os nós `err=false` — `Send WhatsApp Critical` → 200 `{"ok":true,"sent":true}` (antes: "Authorization failed — papel admin/owner exigido"). Observação menor: o body do nó WhatsApp não envia `severity`, então o log grava `warning` por default — cosmetic, envio ok.

## Bloco H — System user token (app 1421814643397349) — BLOQUEADO, evidenciado

Sonda da Etapa 1 do plano (`oauth/access_token?client_id=1421814643397349&client_secret=…`): **error 101 "Error validating application"** com o único secret disponível (`ff2edcde…a3ab`). App controle `1112157761403064` + o MESMO secret → token válido, provando que o método funciona e o secret pertence ao app 1112157761403064, não ao alvo.

Evidências adicionais:
- `debug_token` do `SYSTEM_USER_TOKEN` atual → `type=APP` do app 1112157761403064 (não é system user de verdade); `/1112157761403064/roles` → vazio (nenhum system user criado nesse app).
- Único system user real encontrado: token CAPI (`META_CAPI_ACCESS_TOKEN`) do app 1410364207725643 "Conversions API Application", escopo `read_ads_dataset_quality` apenas.
- `act_984184351272559` → erro #200 (faltam `ads_management`/`ads_read` no token); página `645320171988542` → erro #100 (falta `pages_read_engagement`).

**Conclusão:** o sucesso de `plan_meta_system_user.md` é inalcançável só com CLI/segredos locais. Caminho humano obrigatório: (1) obter o App Secret real de 1421814643397349 no Meta Console (ou migrar as permissões para o app 1112157761403064), (2) criar system user + senha via Business Manager, (3) gerar token com `ads_management`/`ads_read`/`pages_*` aprovados. Então gravar como `META_SYSTEM_USER_TOKEN_1421814643397349` (variável NOVA, por A-FIX2). Nada foi sobrescrito; `.env.local` e `CREDENCIAIS.md` permanecem como estavam.

