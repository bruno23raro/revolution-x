# BRIEFING — REVOLUTION X (2026-10-15)

> **Propósito**: auto-suficiente para outra IA (ou pessoa) entender o projeto,
> o que foi pedido, o que já foi feito (verificado), o que falta e os próximos passos.
> **Regra**: cada afirmação tem evidência (`file:line`, comando ou doc) ou está
> marcada **NÃO VERIFICADO**.
> **Método**: 6 análises em paralelo + reverificação executada nesta sessão
> (jest 15/135 PASS, tsc 0 erros, build 37 páginas).

## 1. Projeto e stack

SaaS multi-tenant (organizações → membros → CRM contatos/leads/deals/pipelines):

- **Next.js 14.2 (App Router) + React 18.3 + TS 5.4 + Tailwind 3.4**; Prisma 7.10
  com `@prisma/adapter-pg`; Supabase (Auth GoTrue + PostgreSQL + RLS);
  Jest 29 + ts-jest (unit + integração contra PostgreSQL local isolado).
  **Sem Playwright/E2E** (ausente do `package.json`).
- Produção: **Hostinger** (`revolutionx.com.br`) + Supabase cloud.
  Dev/testes: PostgreSQL local (`.env.test` → `TEST_ADMIN_DATABASE_URL`
  [BYPASSRLS] e `TEST_RLS_DATABASE_URL` [role restrito `revx_test`];
  banco de teste `revolution_x_rls_test`).
- Identidade: **Supabase Auth é a via exclusiva ao vivo**; `public."User"` é
  espelho ligado só por UUID (`auth.users.id = "User".id`) com
  `password_hash` = placeholder — a senha real vive no GoTrue. O caminho
  legado bcrypt (`src/services/authService.ts:23,31,38`) é **código morto**.
- **Duas séries de migration coexistem (verificado)**: `migrations/` =
  001–008 + 011–012 (Prisma, nomeação por fase) vs `supabase/migrations/` =
  005–009 + 014.
- **Caveat de desenho**: o app conecta via Prisma como `postgres`
  (BYPASSRLS) → o RLS só gata o caminho da **API Supabase**; o isolamento no
  Prisma/CRM vem dos filtros `where organizationId` + `withTenantContext`
  (GUC `app.current_org`).

### Verificação ao vivo (executada nesta sessão, 2026-10-15)

- `jest` → **15 suítes / 135 testes PASS** (15,58s, exit 0)
- `tsc --noEmit` → **0 erros** (tsconfig inclui `src/**` e `app/**`)
- `next build` → **37 páginas**
- Migration **014** no banco de teste local: 4 tabelas com
  `relrowsecurity=true` e `relforcerowsecurity=true`
  (provado por `src/tests/task-queue-rls.test.ts` → 10/10 PASS)

## 2. O QUE FOI PEDIDO

### 2.1 Documentado no repo
| Pedido | Fonte | Estado |
|---|---|---|
| Roadmap de 12 FASES ("nunca pular") | `README.md:6-19` | 1–6 e 11 ✅; 7–8 🟡 (segredos Meta ausentes); 9 ❌; 10 🟡; 12 🟡 em curso |
| Meta/WhatsApp obrigatório (fases 7–10) | `docs/SETUP_GUIDE.md:20` | OAuth + webhook + processor ✅; `META_APP_*`/`META_WEBHOOK_VERIFY_TOKEN` ausentes |
| Missões 5c/5d/5f/5g + 6 | `docs/PHASE6_*.md`, `docs/PHASE7_REPORT.md` | concluídas (relatórios de classe B registrados) |
| Rollout 007/008/009 p/ produção | `docs/STAGING_ROLLOUT_PLAN.md:80-117` | **EM PRODUÇÃO desde 2026-10-15** |
| FASE AGENT Phase 2 (014: fila + memória) | `docs/STAGING_ROLLOUT_PLAN.md:121-184` | código ✅ + staging 10/10; **promoção aguarda usuário** |
| Regras de autonomia + limites de segurança | `CLAUDE.md:12-53` | em vigor |

### 2.2 PROMPT MESTRE (§3–§16) — texto NÃO está no repo, só na memória do usuário

Mapa de cobertura (verificado por grep no código, 2026-10-15):

| § | Funcionalidade | Estado |
|---|---|---|
| §3 | UI de chat administrativo | ✅ `app/admin/chat/page.tsx` |
| §4 | Reuse do OmniRouter | ✅ `src/ai/omniRouter.ts` |
| §5 | Ponte local Claude Code | ❌ AUSENTE |
| §7 | Memória persistente do agente | ✅ `AgentMemory` + injeção no system prompt |
| §8 | Progresso % real via SSE | ✅ lógica (percentual real da fila); transporte sem teste |
| §9 | Fila de tarefas persistente | ✅ `src/lib/taskQueue.ts` |
| §10 | Automação de navegador "Manus-like" com pausa em auth | ❌ AUSENTE (sem Playwright) |
| §11 | Inventário MCP/CLI | ❌ AUSENTE |
| §12 | Hub de integrações | ❌ AUSENTE (só a rota Meta existe) |
| §13 | Hub Meta | 🟡 parcial (OAuth + webhook + processor; sem UI de status/refresh de token/health) |
| §14 | Segurança (sem segredos no frontend, sem bypass de auth) | ✅ respeitado na auditoria |
| §15 | Multi-tenant em produção | ✅ RLS em produção; 014 pendente |
| §16 | Testes obrigatórios por módulo | 🟡 forte em `src/`; **zero testes nas rotas `app/api/admin/*`** |

## 3. O QUE JÁ FOI FEITO (verificado)

### 3.1 Re-executado nesta sessão
- `jest` 15/135 PASS; `tsc --noEmit` 0 erros; `next build` 37 páginas (citado acima).
- 014 no banco de teste local (schema + RLS + app path, 10/10).

### 3.2 Confirmado por leitura de código (evidência)
| Área | O que existe | Evidência |
|---|---|---|
| Auth (4 rotas + callbacks) | login/logout/session/register/forgot/reset/verify/resend + callback Supabase PKCE + callback Meta (state CSRF com timing-safe, Graph v26.0) | `app/api/auth/**`, `app/api/auth/callback/meta/route.ts` |
| 007/008/009 em produção | `supabase db query --linked -f` em 2026-10-15; validação isolada **41/41** (`rls` 11 + `b4-rls` 8 + `token-rls` 19 + `prisma-tenant` 3); FORCE RLS em 21 tabelas; snapshot de rollback em `backups/rls-{before,after}-007-009_{policies,flags}.json`; 3 bugs latentes corrigidos nos .sql (quoting/escaping `''''`, `quote_ident`, guard `to_regrole('revx_test')`) | `docs/STAGING_ROLLOUT_PLAN.md:80-117`; `supabase/migrations/007-009*.sql` |
| 014 staging-first | suíte RLS em banco real: policies exatas; GUC vazio/ausente → fail-closed (0 linhas); INSERT cross-tenant rejeitado (PG **42501**, `WITH CHECK`); UPDATE cross-tenant → **0 linhas**; ciclo de vida 33→66→100; `AgentMemory` por usuário | `src/tests/task-queue-rls.test.ts` (10) |
| FASE AGENT | chat SSE (fetch+ReadableStream real); máquina de estados `queued→running→completed/failed/canceled/waiting_human↔running`; progresso `done/total` real (`taskQueue.ts:139-148`); degradação honesta (503 `queue_unavailable`, `router_not_configured` — nunca simula); `requireAdmin` (admin/owner em qualquer membership; duplicado em 4 rotas) | `src/lib/taskQueue.ts`, `app/api/admin/{chat,tasks,tasks/[id],memory}/route.ts` |
| OmniRouter | fallback `OMNIROUTER_*` → `ANTHROPIC_*` → `OPENAI_*` (baseUrl em `omniRouter.ts:85-107`; key; modelo padrão `Modelos-Gratis`, sem fallback de `OPENAI_MODEL`); 6 testes (1 condicional de live) | `src/ai/omniRouter.ts`, `src/tests/omni-router.test.ts` |
| Webhook Meta | HMAC-SHA256 `X-Hub-Signature-256` + `timingSafeEqual`; GET `verify_token`; limite 10MB; idempotência via `webhook_events` + `ON CONFLICT (meta_event_id)`; `whatsappProcessor` com 6 testes co-localizados | `app/api/webhooks/meta/route.ts:21-34,59-66,79-141` |
| Meta/WhatsApp | OAuth + state CSRF; `meta_integrations` (token AES-256-GCM em repouso); RLS por tenant; GET/DELETE nunca expõem segredo; **IDOR testado (8)** | `src/integrations/meta/**`, `src/tests/meta-idor.test.ts` |
| Email | providers Noop/Console/Resend; tokens sha256; 7/7 testes | `src/lib/email.ts:26-90,126-150`, `src/tests/email-provider.test.ts` |
| CRM (fases 3–5) | rotas contatos/leads/deals/pipelines + produtos + relatórios; repositório com filtro de tenant | `app/api/crm/**`, `src/repositories/crmRepoReal.ts` |
| Segurança auth | 21 testes (anti-enumeração, validação de token, middleware read-only) | `src/tests/auth-security.test.ts` |
| Git/segredos | nenhum segredo real em arquivo rastreado (hits de `sk_`/`eyJ` são placeholder de teste e nome de policy); `.env*` fora do git (só `.env.example`, valores vazios) | `.gitignore:3-5`; varredura por grep |

### 3.3 NÃO re-verificado em execução (limites honestos)
- **Turno SSE real autenticado** (admin Supabase → LLM): não existe teste de rota
  para `app/api/admin/*` (jest varre só `roots: ['src']`, `jest.config.cjs:4`).
- **Email/WhatsApp reais**: os 7 testes do Resend passam, mas `.env` tem
  `RESEND_API_KEY` e o código lê `EMAIL_API_KEY`/`EMAIL_FROM` (nomes diferentes!)
  → na prática o provider efetivo é Noop **hoje**; segredos Meta ausentes →
  integração Meta inerte.
- **Deploys em produção** (Hostinger/dashboard Supabase): afirmados pelos docs,
  não reconfirmáveis a partir desta máquina (sem acesso daqui).
- `backup-pre-rls-007-009.sql` = **0 bytes**: o dump prometido nunca foi gerado;
  o rollback efetivo é o snapshot de policies em `backups/*.json` + PITR do Supabase.

## 4. O QUE FALTA

### 4.1 Pendências GATED no usuário (bloqueantes)
1. **014 em produção** — aguarda autorização explícita. Passo documentado
   (`docs/STAGING_ROLLOUT_PLAN.md:156-165`):
   `supabase db query --linked -f supabase/migrations/014_agent_task_queue.sql`
   + smoke (`GET /admin/chat` 200; `GET /api/admin/tasks` admin→200 `[]`;
   sem sessão→401). DDL aditivo idempotente; rollback =
   `DROP TABLE "AgentMemory","TaskEvent","TaskStep","Task"`.
   Até lá, o chat admin em produção degrada honestamente (503 `queue_unavailable`).
2. **Roteador de IA em produção** — definir no env do servidor Hostinger:
   `OMNIROUTER_BASE_URL` + `OMNIROUTER_API_KEY` (ou `ANTHROPIC_BASE_URL` +
   `ANTHROPIC_AUTH_TOKEN`). O OmniRouter local (`localhost:20128`) é
   inacessível do servidor. Verificação pós-deploy (sem custo de LLM):
   `GET /api/admin/chat` → `{"routerConfigured":true,...}`.
3. **Rotacionar a senha de produção do Supabase** (exposta acidentalmente
   em 2026-10-14 — o app usa `postgres`, não o papel `api`, então o impacto
   é credencial/auditoria, não RLS; mas a rotação segue em pé).

### 4.2 Gaps no código (executáveis sem depender do usuário)
| # | Gap | Onde |
|---|---|---|
| G1 | **Zero testes de rota** em `app/api/admin/*`: gate `requireAdmin` (401 / admin não-primário), transporte SSE happy/error, cancel/resume, injeção de memória no prompt, persistência de token-usage — FASE AGENT é classe "C" no nível HTTP | `app/api/admin/{chat,tasks,tasks/[id],memory}/` |
| G2 | **Escopo do jest**: `roots: ['<rootDir>/src']` → testes co-localizados em `app/` (ex.: `app/api/auth/callback/meta/route.test.ts`) **não rodam** no `npm test` (só quando chamados explicitamente) | `jest.config.cjs:4` |
| G3 | **Race de idempotência no webhook Meta**: pré-checagem + `ON CONFLICT(meta_event_id)` não protege `Message.externalId` contra duplicata concorrente → processamento duplo | `app/api/webhooks/meta/route.ts:79-141` |
| G4 | **404 pós-OAuth Meta**: callback redireciona para `/onboarding/success` e `/onboarding/error` — rotas que **não existem** | `app/api/auth/callback/meta/route.ts:157,161` |
| G5 | **Email inativo**: `.env` tem `RESEND_API_KEY`, código lê `EMAIL_API_KEY`/`EMAIL_FROM` → mismatch de nomes → Noop (resend ^6.33.0 no package.json mas o código usa `fetch` global) | `src/lib/email.ts:126-150` vs `.env` |
| G6 | **`generateState` inseguro**: `Math.random` — trocar por `crypto.randomBytes` | `src/integrations/meta/auth/oauth.ts:19-21` |
| G7 | **URL de onboarding WhatsApp** fora do formato oficial Meta Embedded Signup (`business.whatsapp.com/embed?org=<org>`) | `src/integrations/meta/whatsapp/onboarding.ts:11-14` |
| G8 | **`dotenv` não declarado** em `package.json` (transitivo v17.4.2 — risco em install limpo; as suítes de banco o importam) | `src/tests/*.test.ts` |
| G9 | **Não gitignored** (entrariam num `git add .`): `backups/`, `backup-pre-rls-007-009.sql` (0 bytes), `send.js`, `test-whatsapp.js`, `test-zernio.js`, `zernio-tudo.js` | raiz do repo |
| G10 | **Zernio morto**: `@zernio/node ^0.2.119` em `package.json` com ZERO uso em `src/`/`app/` (só scripts soltos) — decidir: construir a integração ou remover | `package.json` |
| G11 | **Docs defasados**: `REVOLUTION_X_MEMORY.md` (raiz) ainda diz "Auth BLOCKED (GoTrue 500)" / "webhook placeholder" (checkpoint antigo); contagens divergem entre docs (85→100→125→135) | raiz + `docs/` |
| G12 | **PROMPT MESTRE §5/§10/§11/§12/§13**: ponte local Claude Code, automação de navegador com pausa em auth, inventário MCP/CLI, hub de integrações, hub Meta — todos ausentes do código (ver §2.2) | — |

## 5. PRÓXIMOS PASSOS (ordenados)

### P0 — quick wins (independentes do usuário)
- [ ] **Commit** do trabalho sujo (todo o FASE AGENT + correções pós-promoção
      de 007/008/009 + tsconfig + docs + `app/admin/` + `app/api/admin/` +
      `src/lib/taskQueue.ts` + `src/ai/omniRouter.ts` + 4 suítes novas) —
      usuário decide o timing; commit único ou fatiado por área.
- [ ] G8: declarar `dotenv` em `devDependencies`.
- [ ] G9: gitignorar `backups/`, `*.sql` da raiz e os 4 scripts soltos
      (ou movê-los para fora do repo).
- [ ] G2: alargar `roots` do jest para `['<rootDir>/src', '<rootDir>/app']`
      (ou migrar o teste do callback para `src/tests/`).
- [ ] G4: criar `/onboarding/success` e `/onboarding/error` (telas simples)
      OU apontar o callback para `/dashboard`.
- [ ] G5: alinhar nomes de env do email (`EMAIL_API_KEY`/`EMAIL_FROM` ↔
      `RESEND_API_KEY`) para o Resend funcionar de fato.
- [ ] G6: `generateState` com `crypto.randomBytes`.

### P1 — qualidade (gaps de teste/segurança)
- [ ] G1: suíte de rotas `app/api/admin/*` (401 no gate; admin não-primário
      ok; SSE happy/failure com mock do OmniRouter; cancel/resume).
- [ ] G3: guard único ao redor de `Message.externalId` + suíte da rota do
      webhook Meta.
- [ ] G7: validar/corrigir a URL de onboarding WhatsApp contra o formato
      oficial Meta.
- [ ] G11: atualizar `REVOLUTION_X_MEMORY.md` da raiz com o estado real
      (135/135; 014 staging-first).

### P2 — gated no usuário (executar quando autorizado)
- [ ] Autorização de 014 → `supabase db query --linked -f ...` + smoke
      (comando em §4.1.1).
- [ ] Env `OMNIROUTER_BASE_URL` + chave no servidor Hostinger → verificar
      `GET /api/admin/chat` (`routerConfigured:true`).
- [ ] Rotação da senha do banco de produção do Supabase.

### P3 — escopo restante da missão (novo)
- [ ] §11 inventário MCP/CLI → página que lista MCPs disponíveis + CLIs do
      repo com status.
- [ ] §12 hub de integrações → UI de status por provider + rota de health
      (checar `token_expires_at`) + config per-tenant.
- [ ] §13 hub Meta → job de refresh de token + tela de onboarding + segredos
      no env.
- [ ] §10 automação de navegador com pausa em auth → instalar Playwright;
      o estado `waiting_human` já existe na fila (`taskQueue.ts:304`) —
      falta o executor.
- [ ] §5 ponte local Claude Code → executor com file locks + fila offline
      (reaproveita `waiting_human`).

## 6. RISCOS & PONTOS DE ATENÇÃO

1. **BYPASSRLS do app**: Prisma roda como `postgres` → RLS só protege a API
   Supabase. O RLS é a 2ª barreira; a 1ª é o filtro `where` + GUC.
   Qualquer query nova sem `organizationId` no filtro vaza cross-tenant.
2. **Dual-schema / dual-series**: duas séries de migration com colisão de
   numeração (005–008 de cada lado) + PascalCase vs snake_case
   (`meta_integrations`, `webhook_events`, `User` snake_case no banco de
   teste) — fonte recorrente de bug (há um em `crmRepoReal.ts`).
3. **Gap de identidade**: onboarding que falha NÃO derruba o registro
   (`app/api/auth/register/route.ts:94-96` — catch→log) → usuário pode
   existir no GoTrue sem linha/membership em `public."User"` →
   `getAuthenticatedUser` retorna null (`src/lib/auth.ts:58-66`) →
   bloqueado do app mesmo com sessão válida.
4. **Backup efetivo**: `backup-pre-rls-007-009.sql` = 0 bytes; o rollback
   real é `backups/rls-*-007-009_*.json` + PITR do Supabase.
5. **Trabalho de alto valor não versionado**: 014 + correções de 007/008/009
   + todo o FASE AGENT estão só na working tree (9 modified + 12 untracked).
6. **Regime local**: se o computador desligar/desconectar, tarefas locais
   ficam aguardando (regra §14) — nada se executa sem ele.

## 7. COMANDOS PARA REPRODUZIR

```bash
npm test                      # 15 suítes / 135 testes (suítes de banco precisam do Postgres local + .env.test)
npm run typecheck             # tsc --noEmit (src + app)
npx next build                # 37 páginas
npx jest task-queue-rls       # só a suíte de RLS da 014

# PENDING AUTORIZAÇÃO DO USUÁRIO:
# supabase db query --linked -f supabase/migrations/014_agent_task_queue.sql
```

Banco de teste: `revolution_x_rls_test` local via `.env.test`
(`TEST_ADMIN_DATABASE_URL` = BYPASSRLS, caminho do app;
`TEST_RLS_DATABASE_URL` = `revx_test`, asserções de RLS).
**Nunca** usar `DATABASE_URL`/`DIRECT_URL`/credenciais Supabase como
fallback de `TEST_*_DATABASE_URL` (regra CLAUDE.md).

## 8. ESTADO DO GIT (2026-10-15)

- Branch `main`, HEAD `58491e6` ("fix(auth): add setSession to login route…").
- **9 modified**: `prisma/schema.prisma` (+92, FASE AGENT), `src/ai/aiService.ts` (+60),
  `app/dashboard/page.tsx` (+18, card do chat), `tsconfig.json` (+2, inclui `app/**`),
  `docs/STAGING_ROLLOUT_PLAN.md` (+111), `supabase/migrations/007,008,009`
  (correções pós-promoção), `app/api/auth/callback/meta/route.test.ts` (refactor).
- **12 untracked**: FASE AGENT → `app/admin/`, `app/api/admin/`,
  `src/ai/omniRouter.ts`, `src/lib/taskQueue.ts`,
  `src/tests/{omni-router,task-queue,task-queue-rls}.test.ts`,
  `supabase/migrations/014_agent_task_queue.sql`;
  rascunhos → `send.js`, `test-whatsapp.js`, `test-zernio.js`,
  `zernio-tudo.js`, `backups/`, `backup-pre-rls-007-009.sql` (0 bytes).
- Nenhum segredo real em arquivo rastreado (varredura confirmada).
- Commits relevantes: `b983768` (Mission 6) → `5fe9d40` (staging plan) →
  `a03eafb`/`adc4c2b` (auth) → `58491e6` (HEAD).

## 9. NÍVEL DE CONFIANÇA

- **ALTO (re-executado 2026-10-15)**: 135/135, tsc 0, build 37 pág.,
  014 no banco de teste local (10/10), 007/008/009 em produção
  (registrado em `docs/STAGING_ROLLOUT_PLAN.md:80-92` com smoke no ar).
- **MÉDIO (documentado, não re-confirmado a partir daqui)**: deploys
  Hostinger, estado do dashboard Supabase, entrega real de email/WhatsApp.
- **NÃO ASSUMIR**: §5/§10/§11/§12/§13 do prompt mestre (ausentes do
  código); qualquer afirmação do `REVOLUTION_X_MEMORY.md` da raiz (obsoleto).

---
*Se um `file:line` citado mudou, o código é a verdade — re-consulte-o.
Este briefing foi gerado em 2026-10-15 a partir de 6 sub-analises +
reverificação por execução.*
