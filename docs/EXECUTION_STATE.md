# EXECUTION STATE — REVOLUTION X (missão final, 2026-10-15)

> Estado canônico do trabalho contínuo. Atualizar ao final de cada etapa
> significativa e antes de qualquer interrupção (regra §6 da missão).

## Etapa atual

> **Atualizado 2026-10-19:** a etapa mais recente está no bloco
> **2026-10-19 — FASE 2–4 do PROMPT MESTRE** abaixo (FASE 4 · slice 2
> concluída, commit `cb48089`). O texto original a seguir cobre FASE A–I
> da missão de 2026-10-15/16 (histórico).

FASES A/B/C/D/F/G **concluídas**. **FASE H concluída** (close-out em
`902d25b`; deploy automático + smoke pós-deploy com evidência real).
**FASE I (repo público + CI verde) concluída até o limite autônomo**
(2026-10-16): commit `2d9136d` (provisionamento do Postgres de teste no
CI + `scripts/provision-ci-test-db.mjs` + endurecimento do `.gitignore`),
push `902d25b..2d9136d`. O repositório ficou **PÚBLICO** (`private:false`
confirmado via API) — runs do CI agora verificáveis anonimamente.
**Causa-raiz do CI vermelho sanada**: as 5 suítes de integração exigiam
Postgres real + `TEST_*_DATABASE_URL` + role `revx_test`, e o workflow
não provisionava nada. Fix: service `postgres:17` descartável + env de
job + cadeia idempotente `apply-rls-setup` → `apply-token-rls-setup` →
`provision-ci-test-db` (014; o 009 é auto-aplicado pela suíte b4-rls).
**Evidências**: simulação local em DB nova (`revx_ci_sim`: 51/51
integração, 185/185 geral, tsc 0) + **Actions run `38973999041` (head
`2d9136d`) = success em todos os passos** (provision, Test, Build).
Auditoria §6 (árvore + histórico): nenhuma credencial utilizável no
histórico público — só identificadores (ref Supabase, host pooler sem
senha, slug da org); senhas reais existem apenas em refs **locais**
(`refs/stash`, `refs/agents/...`, commit `fe69880`, nunca publicados) →
**não empurrar esses refs**. Restam [HUMANO]: credenciais E
(Meta/Resend/OmniRouter) + claude-mem `/login`. **O probe admin da rotação
do banco ficou CONCLUÍDO 2026-10-17** (`GET /api/admin/tasks` → 200
`{count:0}` na sessão admin de produção; ver bloco **2026-10-17** abaixo). Detalhes:
`docs/EXECUTION_LOG.md` §FASE I.

## 2026-10-19 — FASE 2–4 do PROMPT MESTRE (hub de integrações)

**Etapa atual: FASE 2 (IG/FB/TikTok oficial), FASE 3 (slices 1–4) e
FASE 4 · slices 1–2 (executor do agendamento TikTok c/ retry+backoff)
CONCLUÍDAS e push em `origin/main`.**

- Commits: `3648f3a` (FASE 3 · slice 2 — chatbot visual + auto-reply no
  webhook Meta) → `0ccc12a` (slice 3 — executores de saída n8n/Zapier/Make/
  webhook genérico + `/api/integrations/execute`) → `b4657de`
  (`checkRiskAcknowledgment` em `riskAcknowledgment.ts`, never-throw,
  usado por `qrCodeGenerator.ts`) → `5e649af` (slice 4 —
  `publicScraper.ts` c/ guarda SSRF, seção Sem API/Avançado) →
  `8fcd3a4` (teste live OmniRouter resiliente a 503/5xx: retry + adiar
  honesto) → `0e3de63` (**FASE 4 · slice 1**) → `cb48089`
  (**FASE 4 · slice 2**).
- **FASE 4 · slice 1** (`0e3de63`): `src/jobs/tiktokScheduler.ts`
  (núcleo puro `selectDuePosts` + executor `runDueTikTokPosts` c/
  `TickDeps` injetáveis; persistência na AgentMemory/Postgres EXISTENTE
  — zero dep novas; `TickDeps` é o ponto de extensão p/ adaptadores
  BullMQ `REDIS_URL` / Inngest `INNGEST_*`, ambos [HUMANO]) +
  `app/api/tiktok/tick/route.ts` (POST tick 401/503/200 · GET fila
  projetada, últimos 50, sem segredos) + card "Agendados" em `/tiktok`.
  Semântica: acesso indisponível preserva a intenção (itens seguem
  pendentes); publicação ok → `published`+`publishId`; falha →
  `failed`+motivo; fila ausente → `queue_unavailable` (503 honesto).
- **FASE 4 · slice 2** (`cb48089`): RETRY c/ BACKOFF EXPONENCIAL —
  `PendingTikTokPost.attempts?`; `markPendingTikTokPost` aceita
  `attempts`/`scheduledAt`; `TickOptions.maxAttempts` (padrão 3) /
  `retryBaseDelayMs` (padrão 5 min): falha incrementa `attempts` e, até o
  teto, REAGENDA (`scheduledAt = now + base * 2^(attempts-1)`), só então
  `failed` terminal; `TickResult.retried` separado de `failed` (terminais),
  `ok` só por terminais; `PendingTikTokView.attempts` + UI c/ contador
  "tentativa N" e "reagendado(s)". 10 testes novos (5 retry/backoff + 5
  FLUXO PRINCIPAL: `tiktokScheduler.flow.test.ts` exercita
  `bindTikTokSchedulerDeps` real com `TaskQueueUnavailableError` REAL
  p/ `instanceof`).
- **Evidências**: suíte total **34 suítes / 435 testes PASS**; `tsc` 0
  erros; push `ed16d66..cb48089` (deploy automático do hpanel).
- **Próximo autônomo (FASE 4 · slice 3)**: disparo periódico do tick
  (cron; o tick atual é gatilho manual pronto — card "Processar
  agendados" + `POST /api/tiktok/tick` c/ auth). Depois, com
  credenciais [HUMANO] (se o usuário fornecer
  `REDIS_URL`/`INNGEST_*`): adaptadores BullMQ/Inngest plugando no
  MESMO contrato `TickDeps` (executor não muda).
- Demais itens do PROMPT MESTRE (hub de integrações, WhatsApp completo,
  IG/FB/TikTok oficial, tracking de anúncios, Sem API com avisos de
  risco, chatbot visual, n8n/Zapier/Make) estão CONCLUÍDOS nas
  FASE 1–3 — estado completo em `REVOLUTION_X_MEMORY.md` §ESTADO ATUAL
  (2026-10-19).

## 2026-10-17 — Rotação do banco de produção (CONCLUÍDA; resta só confirmação admin [HUMANO])

- **Alvo (a) hpanel** ✅: `DATABASE_URL` + `DIRECT_URL` atualizados para a
  nova senha (40 chars hex; valor **não versionado** — §6) e **persistência
  verificada** (editor reaberto, valor lido de volta). Senha antiga revogada
  no Supabase.
- **Alvo (b) `.env.local`** ✅: `DATABASE_URL`/`DIRECT_URL` já na nova
  senha (topologia pooler); `TEST_*` intocados.
- **Credencial comprovada** em conexão real: pooler OK (217 ms); host
  direto da máquina local dá timeout de egress (não é falha de auth).
- **Re-deploy do hpanel CONFIRMADO** (commit `77a9696`): hpanel →
  *Última implantação: Concluído* (08:38, 1m 43s, `main`) → `.env` novo
  re-injetado. Smoke público pós-deploy: `GET /` 200 · `GET
  /api/admin/chat` 200 `routerConfigured:false` · `GET /api/admin/tasks`
  401 (sem sessão).
- **Alvo (c) secrets do GitHub = N/A** (verificado no navegador): repo tem
  **zero secrets** ("This repository has no secrets"); `secrets.DATABASE_URL`
  resolve vazio e o CI segue verde. **Decisão: não criar** segredo de banco
  em repo público.
- Confirmação final de banco em produção = probe `GET /api/admin/tasks`
  **com sessão admin** → **200 `{count:0}` (CONCLUÍDO 2026-10-17, tarde)**;
  evidência em `docs/EXECUTION_LOG.md` §probe admin (sem segredo no registro).

## 2026-10-17 (tardio) — 2ª rotação: a 1ª senha re-expostou (chat + claude-mem P268)

- A senha da 1ª rotação (`02588aef…`; **valor completo não reproduzido aqui**) ficou **no
  chat e no índice do claude-mem (P268)** → passa a ser tratada como **exposta** de novo.
- **Preparado:** `docs/DB_ROTATION_RUNBOOK.md` (roteiro seguro, **0 valor de segredo**).
  A **fonte Supabase revoga na hora**; o usuário preenche a `NOVA_SENHA` **só nos campos
  seguros** (hpanel `DATABASE_URL`/`DIRECT_URL` + `.env.local` x2; os outros `.env*`
  locais invalidam sozinhos); eu deito o **re-deploy** + **smoke** + **probe admin** sem
  imprimir segredo. Commit local `8222889` (**push segurado**, anda junto com o registro).
- **CONCLUÍDO [HUMANO] 2026-10-17 (tarde):** runbook aplicado (nova senha em
  Supabase/hpanel/`.env.local`), re-deploy + smoke ok, e **probe admin
  `GET /api/admin/tasks` → 200 `{count:0}` na sessão admin de produção**
  (sessão obtida via magic-link do GoTrue consumido em
  `revolutionx.com.br/login` pela `detectSessionInUrl`; sem criar nova
  senha — o update via Admin API deu 405 — e sem DDL em produção).
  A `02588aef…` ficou **revogada na fonte**. **2ª rotação FECHADA.**

## Checklist de fases

- [x] **A — Quick wins**: jest `roots` agora cobre `src` + `app`; `dotenv`
  declarado em devDependencies (^17.4.2, lockfile sincronizado);
  `generateState` → CSPRNG; `/onboarding/success|error` criadas; `.gitignore`
  cobre rascunhos locais; `REVOLUTION_X_MEMORY.md` da raiz atualizada.
  Verificado: **140/140 (16 suítes) · tsc 0 · build 39 páginas**.
  Bônus: corrigidos 2 mocks de teste incompletos (`crypto` sem
  `timingSafeEqual` no `route.test.ts` do callback Meta e no
  `auth-security.test.ts`) + fronteira de mock errada (`@supabase/supabase-js`
  → `@/lib/supabase/server`).
- [x] **B — Segurança (parcial)**: revalidação RLS 41+10 PASS (run de 140,
  bancos de teste reais `revx_test`/admin BYPASSRLS). **Restante**: rotação
  da credencial do banco de produção [HUMANO — dashboard Supabase;
  procedimento em `PROJECT_HANDOFF.md`], testes de autorização negativa
  (juntos com C/G1), validação de assinatura do webhook Meta.
- [x] **C — Testes e bugs**: suíte `src/tests/admin-routes.test.ts`
  (G1: gate `requireAdmin`, SSE happy/error com OmniRouter mockado,
  cancel/resume) — **34 testes**; guard de idempotência do webhook Meta
  (G3: claim atômico `ON CONFLICT (meta_event_id)` em
  `app/api/webhooks/meta/route.ts` + 11 testes em
  `app/api/webhooks/meta/route.test.ts`); **migration 015 APLICADA EM
  PRODUÇÃO e comprovada** (`uq_webhook_events_meta_event_id` em
  `pg_index`, 0 linhas). Verificado: **18 suítes / 185 testes PASS ·
  tsc 0 · build 39 páginas**.
- [x] **D — Migration 014 em produção**: APLICADA (2026-10-15) após
  verificação do destino (linked = "Revolution X", sa-east-1, ACTIVE_HEALTHY),
  pré-requisitos (22 policies `_tenant`, 23 FORCE-RLS) e DDL aditivo
  idempotente. Comprovação: 4 tabelas, 4 FORCE, 4 policies, 12 indexes, 0
  linhas. Smoke de produção: `/` `/login` `/dashboard` 200; APIs 401 sem
  sessão; `/api/admin/*` 404 ESPERADO (build em produção é anterior à FASE
  AGENT — o smoke admin completo roda no post-deploy da FASE H, com sessão
  do admin [usuário]).
- [ ] **E — Integrações reais**: Meta (`META_APP_ID`/`META_APP_SECRET`/
  `META_WEBHOOK_VERIFY_TOKEN` ausentes — [HUMANO]); Resend
  (`EMAIL_PROVIDER=resend` + `EMAIL_API_KEY` + `EMAIL_FROM` — [HUMANO]);
  OmniRouter em produção (`OMNIROUTER_BASE_URL` + chave — [HUMANO]).
  Enquanto ausentes, as integrações degradam honestamente (UI mostra
  "não configurado"; providers Noop).
- [x] **F — UI/preview**: dev server (porta 3000) + janela Chrome real
  (Chrome DevTools MCP — tools do browser integrado do VS Code não
  estavam expostas nesta sessão; o usuário viu/operou a janela). `/`,
  `/login`, `/dashboard` (dados reais do tenant), `/crm/contacts`
  (contato real), `/admin/chat` (estado honesto do roteador),
  `/onboarding/*` → todos 200; 0 erros de console; `GET
  /api/admin/tasks` admin → 200 `{count:0}` (fila 014 ok). Login real
  com credencial admin nova (senha gerada e definida via Supabase Admin
  API a pedido do usuário; valor entregue 1x no chat, **não**
  documentada em lugar nenhum). Único resíduo: `favicon.ico` 404
  (cosmético, nota p/ H).
- [x] **G — Matriz de requisitos**: `PROJECT_REQUIREMENTS_MATRIX.md`
  criado e reconciliado com evidência (G1–G12 com estado + prova;
  §A/§B atualizados após C/F/H; MD0xx auto-fixado).
- [x] **H — Release**: validações (185/185 · tsc 0 · build 39 pág. ·
  next lint 0); scan de segredos limpo; 5 commits com
  `Co-Authored-By: Claude Code`; push `origin/main`; **deploy
  automático (hpanel git integration)**; smoke pós-deploy
  (`/api/admin/chat` 200 `routerConfigured:false`; `/api/admin/tasks`
  401 sem sessão; baseline 404 → agora 200). **Resíduo [HUMANO]**:
  `/api/admin/tasks` com sessão admin (login no navegador) +
  credenciais E + rotação do banco.

## Bloqueios ativos

| Bloqueio | Dependência | O que já foi preparado |
| --- | --- | --- |
| Rotação da senha do banco Supabase (exposta 14/10; ident. públicos) | **CONCLUÍDA 2026-10-17**: hpanel ✅ + `.env.local` ✅ + re-deploy CONFIRMADO ✅ + (c) GitHub = N/A + **probe admin 200 `{count:0}` ✅ (sessão admin de produção)** | Nenhum — 2ª rotação fechada |
| Smoke de sessão admin em produção | Login no navegador (usuário) | Fila 014 validada em dev E em CI (run 38973999041); rotas no ar (401 sem sessão) |
| Credenciais Meta/Resend/OmniRouter | Env no hpanel Hostinger (usuário) | Nomes documentados; `/api/admin/chat` 200 `routerConfigured:false` |
| claude-mem observer deslogado (~8 dias) | `/login` no Claude Code (usuário) | Diagnóstico registrado no log |

## Próximo comando lógico

FASE I chegou ao limite autônomo (repo público auditado, CI verde
comprovado, .gitignore endurecido). Próximos passos, todos [HUMANO], na
ordem de impacto:

1. **Rotação do banco (2026-10-17) — CONCLUÍDA**: hpanel ✅ + `.env.local` ✅
   + re-deploy CONFIRMADO ✅ (`77a9696`, smoke 200); (c) GitHub = N/A;
   **probe admin `GET /api/admin/tasks` → 200 `{count:0}` na sessão admin
   de produção ✅ (2026-10-17, tarde)** — 2ª rotação fechada;
2. **Hostinger hpanel** → definir `META_*`, `EMAIL_*`, `OMNIROUTER_*`
   (item E — integrações reais; o chat admin passa a `routerConfigured:true`);
3. **Sessão admin no navegador** → `GET /api/admin/tasks` 200
   `{count:0}` (fecha a fila 014 em produção);
4. Claude Code `/login` (claude-mem observer deslogado ~8 dias).

Novas releases: **basta commit + push** — CI verde em todo push (run
`38973999041` = evidência) + deploy automático (git integration do hpanel
em ~1-2 min, comprovado 3×).
