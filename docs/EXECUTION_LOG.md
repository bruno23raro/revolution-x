# EXECUTION LOG — REVOLUTION X

> Histórico cronológico. Mais recente por último. Sem segredos (regra §6).

## 2026-10-15 — Missão final de execução autônoma

### 00:00–00:40 — Diagnóstico e checkpoint (fase 3)

- Git: `main @ 58491e6` == `origin/main` (totalmente sincronizado).
- Inventário de env: somente NOMES de chaves auditados; `.env` raiz 56 bytes
  (zero `KEY=`); `.env.local` tem 7 chaves (DATABASE_URL, DIRECT_URL,
  JWT_SECRET, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY, TEST_DATABASE_URL); `.env.test` tem
  TEST_ADMIN_DATABASE_URL / TEST_DATABASE_URL / TEST_RLS_DATABASE_URL
  (revx_test). **Nenhuma chave `RESEND_API_KEY` em nenhum arquivo** —
  só no rascunho local `send.js` (agora gitignored).
- OmniRouter local estava ativo em `http://localhost:20128` (env da
  máquina, não do repo). Sem segredos META_*/OMNIROUTER_* em arquivos.
- claude-mem: observer deslogado desde 2026-10-08T21:16:46Z
  ("Claude Code reported the observer as signed out") — correção:
  usuário roda `/login` no Claude Code. **Não reinicie o worker.**
  Memória nativa (pasta `docs/` + `REVOLUTION_X_MEMORY.md` + memory dir)
  é a fonte persistente enquanto isso.

### 00:40–01:20 — FASE A (quick wins)

Aplicado:

1. **G2** `jest.config.cjs` → `roots: ['<rootDir>/src', '<rootDir>/app']`
   (testes co-localizados em `app/` passam a rodar no `npm test`;
   adiciona `app/api/auth/callback/meta/route.test.ts` → suíte 16).
2. **G6** `src/integrations/meta/auth/oauth.ts` → `generateState()` agora
   `crypto.randomBytes(24).toString('base64url')` (era `Math.random`,
   previsível). Sem outros call sites.
3. **G8** `package.json` → `"dotenv": "^17.4.2"` em devDependencies
   (lockfile: rodar `npm install`).
4. **G9** `.gitignore` → rascunhos locais (`/backups/`,
   `/backup-pre-rls-007-009.sql`, `/send.js`, `/test-whatsapp.js`,
   `/test-zernio.js`, `/zernio-tudo.js`).
5. **G5** (email Resend) resolvido sem código: `src/lib/email.ts` e
   `.env.example` já usam o canônico `EMAIL_PROVIDER`/`EMAIL_API_KEY`/
   `EMAIL_FROM` (fetch genérico, sem runtime dep do pacote `resend` —
   ele é só import tipo em `resend`? não — provider é fetch-based;
   pendência = chave do usuário no servidor Hostinger).
6. **G4** criadas `app/onboarding/success/page.tsx` e
   `app/onboarding/error/page.tsx` (client + Suspense + useSearchParams,
   mostra `reason`/`detail`) — alvo do redirect de
   `app/api/auth/callback/meta/route.ts:157,161`.
7. **G11** `REVOLUTION_X_MEMORY.md` da raiz reescrito (estava com estado
  2024/GoTrue-500; agora 2026-10-15 com ponteiros para docs/EXECUTION_*).
8. Criados os 4 docs de persistência obrigatórios da missão:
   `docs/EXECUTION_STATE.md`, `docs/EXECUTION_LOG.md`,
   `docs/PROJECT_HANDOFF.md`, `docs/PROJECT_REQUIREMENTS_MATRIX.md`.

### 01:20–01:40 — Verificações FASE A (resultados reais)

- `npm install`: `dotenv@17.4.2` instalado; `package-lock.json` sincronizado (+1).
- **Bugs encontrados e corrigidos nos mocks** (o teste novo do callback Meta
  expôs um mock incompleto — bug real de test-harness):
  - `route.test.ts` mockava `crypto` como `{randomUUID}` só; a rota usa
    `timingSafeEqual` em `secureCompare` → crash "not a function". Mock
    agora espalha o módulo real + override de `randomUUID`.
  - Mock de `@supabase/supabase-js` estava na fronteira errada (a rota
    importa `@/lib/supabase/server` → `@supabase/ssr` + `next/headers`);
    substituído por mock de `@/lib/supabase/server` (mesma fronteira do
    `auth-security.test.ts`).
  - `auth-security.test.ts` (21 testes) tinha o MESMO mock crypto incompleto
    (passava só porque as paths não atingiam `timingSafeEqual`) — endurecido
    com o padrão `...requireActual('crypto')`.
- `npm test` → **16 suítes / 140 testes PASS** (6.66s; base anterior era
  15/135 — a suíte 16 é `app/api/auth/callback/meta/route.test.ts`, ativada
  pelo G2).
- `npm run typecheck` → **0 erros**.
- `npx next build` → **OK, 39 páginas** (novas: `/onboarding/success` ○ e
  `/onboarding/error` ○).

### 01:40+ — FASE B (segurança — parcial) + início FASE D

- Revalidação de RLS: suítes `rls` (11), `b4-rls` (8), `token-rls` (19),
  `prisma-tenant` (3), `task-queue-rls` (10) = **41/41 + 10/10 PASS** no
  mesmo run de 140 (não são mocks de banco — uso `TEST_*_DATABASE_URL`
  reais: `revx_test` restrito + admin BYPASSRLS).
- Rotação de credencial de banco (HUMANO) segue bloqueio ativo.
- Testes de autorização negativa `/api/admin/*` (G1): FASE C, próximo.
- **FASE D em andamento**: verificação de identidade do projeto Supabase
  vinculado (deve ser a produção; 007/008/009 lá desde 2026-10-15),
  confirmação de pré-requisitos, execução da 014 (autorizada) e smoke.

### FASE C (G1 + G3) concluída — testes admin + idempotência do webhook

- **G1** `src/tests/admin-routes.test.ts` (34 testes): gate de autorização
  negativa das rotas `/api/admin/*` (não-admin → 401; member sem papel
  admin/owner → 403), ciclos de vida de task (list/detail/cancel/resume,
  409 em transição inválida), chat SSE (happy + `generation_failed` com
  OmniRouter mockado; `router_not_configured` honesto; P2021 →
  `warning queue_unavailable`), memory (validações 400, upsert 201, 503
  quando a fila não está disponível).
- **G3** `app/api/webhooks/meta/route.ts`: claim atômico de idempotência —
  `INSERT INTO webhook_events ... ON CONFLICT (meta_event_id) DO NOTHING
  RETURNING event_id` dentro de `withTenantContext` (claim = a garantia;
  fast-path `service_role` = otimização). Com `ON CONFLICT` em coluna sem
  índice único, o Postgres lança 42703 e a tx inteira faz rollback → todos
  os webhooks eram descartados silenciosamente. Com o guard, a degradação
  é honesta: se o claim falha (015 ausente), o evento ainda é processado —
  nunca se perde evento.
- **Testes novos**: `app/api/webhooks/meta/route.test.ts` (11 testes):
  assinatura ausente/inválida → 401; duplicado no fast-path →
  `already_processed` sem tx; evento novo → claim + processamento (SQL com
  `ON CONFLICT (meta_event_id)` + `RETURNING event_id` comprovado no mock);
  duplicado concorrente (claim vazio) → `duplicate_skipped`, sem
  reprocessamento; erro de infra do claim → processa mesmo assim;
  `phone_number_id` ausente / tenant desconhecido → `accepted` sem efeitos.
- **Verificações reais**: `npm test` → **18 suítes / 185 testes PASS**
  (antes: 16/140); `npm run typecheck` → 0 erros; `npx next build` → 39
  páginas, exit 0.

### Migration 015 — staging-first + APLICADA EM PRODUÇÃO (comprovação)

- **Arquivo**: `supabase/migrations/015_webhook_idempotency.sql` —
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_events_meta_event_id ON
  public.webhook_events (meta_event_id)`, com guard `IF to_regclass(
  'public.webhook_events') IS NULL THEN RETURN` (no-op em ambiente sem a
  tabela). DDL puramente aditivo; `meta_event_id` é `NOT NULL` → zero
  perda de dados. Rollback documentado: `DROP INDEX IF EXISTS
  uq_webhook_events_meta_event_id;`.
- **Staging** (`revolution_x_rls_test`, local, via
  `supabase db query --db-url`): DDL executou sem erro; a tabela
  `webhook_events` não existe nesse schema de teste → 015 foi **no-op**
  ali (exatamente o comportamento do guard). Com honestidade: nenhum
  índice real foi criado em staging.
- **Destino verificado** (usuário confirmou:
  `https://ardpabjoepzhkpmkgwgu.supabase.co`): `supabase status` → linked =
  ref `ardpabjoepzhkpmkgwgu`, projeto **"Revolution X"** — o mesmo
  mecanismo (`--linked`) das promoções 007/008/009/014.
- **Pré** (`supabase db query --linked`): `webhook_events` **existe**
  (PG 17.6), **0 linhas**, únicos apenas
  `webhook_events_pkey` + `uq_webhook_events_meta_integration`
  (composto `(meta_event_id, integration_id)`; sem único simples em
  `meta_event_id` → **causa-raiz do 42703 confirmada**).
- **Execução**: `supabase db query --linked -f
  supabase/migrations/015_webhook_idempotency.sql` → `DO`, sem erros.
- **Pós (comprovação no banco de destino)**: query de introspecção em
  `pg_index` → `uq_webhook_events_meta_event_id` presente na lista de
  índices únicos (`indisunique=true`); `to_regclass` não-NULL; `row_count`
  continua 0 (zero perda). O claim `ON CONFLICT (meta_event_id)` da rota
  agora tem suporte real em produção.

### FASE F (preview ao vivo) + credencial admin — 2026-10-15

- **Dev server**: `npm run dev` no ar (porta 3000, task `bufwdl60i`).
- **Browser**: janela Chrome real (Chrome DevTools MCP — as tools do
  navegador integrado do VS Code não estavam expostas como funções nesta
  sessão; o usuário pôde ver e operar a janela).
- **Credencial admin (ação do usuário "defina a senha")**: usuário
  `brunoalmeida23111996@gmail.com` (papel `admin`, "Test Organization")
  — única conta admin do GoTrue de produção. Senha nova **gerada localmente
  (CSPRNG, 43 chars) e definida via Supabase Admin API**
  (`PUT /auth/v1/admin/users/{id}` com service_role, carregado de
  `.env.local` sem expor a chave). Validação em cadeia: `POST
  /api/auth/login` (dev) → **200** `email_verified:true`.
  **A senha não está escrita neste documento nem em nenhum outro**
  (regra §6/§11): foi entregue **uma única vez no chat** ao dono.
  Obs.: o `/forgot-password` segue bloqueado em produção (Resend ausente —
  [HUMANO]), então o reset por e-mail não é caminho; este reset via
  Admin API foi a alternativa segura aprovada.
- **Evidências reais (com sessão admin, dev server contra Supabase produção)**:
  - `/` → 200, página completa; único console error = `favicon.ico` 404
    (cosmético — não há ícone no repo).
  - `/login` → 200; login real via form → redirect; cookie
    `sb-ardpabjoepzhkpmkgwgu-auth-token` presente; `/api/auth/session`
    200 com o e-mail do admin.
  - `/dashboard` → 200 com **dados reais do tenant** (1 contato, 0 leads,
    0 deals) + card do Centro Administrativo; APIs `/api/crm/*` 200.
  - `/crm/contacts` → 200 com contato real do tenant ("John Doe").
  - `/admin/chat` → 200, estado honesto "roteador ativo · Modelos-Gratis"
    (env local desta máquina; em produção, sem `OMNIROUTER_BASE_URL`,
    `GET /api/admin/chat` devolve `routerConfigured:false`);
    `GET /api/admin/tasks?limit=100` → **200 `{count:0, items:[]}`**
    (fila de 014 funcionando, não é 503).
  - `/onboarding/success`, `/onboarding/error` → 200.
  - Sem sessão: `/api/admin/tasks` → 401 (gate intacto).
  - 0 erros de console em todas as páginas de sessão.
- **Pendências cosméticas (nota p/ FASE H)**: página `/` exibe
  estatísticas antigas hardcoded ("100/100 · 36 pág.") vs. base real
  (185/185 · 39 pág.); falta `favicon.ico`.

### FASE H (Release) — commits + push + investigação do deploy (2026-10-15)

- **Commits (5)** — tree limpa, todos com `Co-Authored-By: Claude Code`:
  1. `5918263` fix(security): PL/pgSQL 007-009 + mocks de teste;
  2. `adaeca3` feat(agent): Centro de Agente (UI/API/fila/omniRouter + 014);
  3. `187c890` fix(webhook): claim atômico + 015 + 45 testes (11 webhook + 34 admin);
  4. `7ccf847` chore: jest roots, dotenv, CSPRNG, onboarding, gitignore;
  5. `6492f5a` docs: persistência da missão (log/estado/handoff/matriz/rollout).
- **Push**: `git push origin main` → `58491e6..6492f5a` (GitHub Actions CI
  dispara no push; repositório **privado** → runs não verificáveis sem
  auth; usuário pode checar em `github.com/bruno23raro/revolution-x/actions`).
- **Investigação do mecanismo de deploy** (agente dedicado, 26 tool calls):
  **não existe pipeline de deploy versionado no repo** (sem
  scripts/Dockerfile/PM2/rsync/nginx; CI para em `next build`).
  Produção = Hostinger hpanel (headers `hcdn`, `platform: hostinger`,
  `panel: hpanel` — `PRODUCTION_CHECKPOINT_REPORT.md:26-30`). Caminhos:
  (A) Git integration do hpanel conectada ao repositório (o push já
  dispararia) ou (B) upload manual do build. Nenhum é acionável daqui
  → **[HUMANO]** (hpanel).
- **Baseline de produção pré-deploy** (evidência real): `GET /api/admin/chat`
  → **404**; `GET /admin/chat` → **404**; `GET /` → 200. Confirma: a build
  em produção ainda é anterior à FASE AGENT.
- **Deploy (AUTOMÁTICO — Git integration do Hostinger ativa)**: o push
  `6492f5a` disparou o deploy no hpanel; a build nova estava no ar em
  ~60 s (poll 2 de 12). O "caminho A" (git integration) era o efetivo —
  para releases futuros basta commit + push.
- **Smoke pós-deploy (evidência real)**:
  - `GET /api/admin/chat` → **200** `{"routerConfigured":false,"model":null,
    "baseUrl":null}` — **honesto**: sem `OMNIROUTER_*` no env do Hostinger
    (item E) → roteador declara ausente (não simula);
  - `GET /admin/chat` → **200** (UI nova no ar; baseline era 404);
  - `GET /` → 200; `GET /login` → 200;
  - `POST /api/auth/login` (sem credenciais) → **401** (gate intacto);
  - `GET /api/admin/tasks` (sem sessão) → **401** (gates admin intactos;
    baseline era 404 → rotas da FASE AGENT existem na produção).
- **Sessão admin (único resíduo autônomo-impossível da FASE H)**:
  `GET /api/admin/tasks` com sessão admin → 200 `{count:0}` — [HUMANO]
  (login no navegador; a mesma fila 014 foi validada em dev contra o
  mesmo banco na FASE F).
- **Docs**: MD0xx auto-fixado nos 5 docs de missão (`markdownlint-cli`
  com MD012/MD022/MD031/MD032/MD060; docs PHASE* legados intencionalmente
  não tocados).
- **Cerrada da FASE H — `ccd88c3` fix(ui)** (2026-10-15): painel de status
  da página `/` corrigido (185/185, build 39/39, RLS 007–015 "EM
  PRODUÇÃO", E-mail "PREPARADO" — antes dizia "real Resend" — e
  "Integrações Meta PREPARADAS"); + `app/icon.svg` (favicon RX, resolve o
  único 404 do console). `next build` passou (39 págs). Push
  `8d84786..ccd88c3` → re-deploy automático do hpanel confirmado:
  `GET /icon.svg` 404 → **200** (~90 s). Smoke final: `/`, `/login`,
  `/admin/chat` → 200; `GET /api/admin/chat` → 200 `{"routerConfigured":
  false}` (item E pendente, honesto); `GET /api/admin/tasks` e
  `/api/admin/memory` sem sessão → **401** (gates intactos). FASE H
  concluída até o limite autônomo.

## 2026-10-16 — Repo público + CI verde (FASE I)

- Usuário publicou `bruno23raro/revolution-x` (API confirma `private:false`;
  default `main` = `902d25b`, pushed 2026-10-16). Consequências tratadas
  nesta etapa: (a) runs do CI agora verificáveis anonimamente; (b) auditoria
  de segredos da árvore + histórico (regra §6); (c) endurecimento do
  `.gitignore`.
- **Auditoria de árvore/.gitignore**: nenhum segredo real rastreado em HEAD
  (`.env.example` é template com valores vazios; `re_...` é placeholder
  documentado; o único JWT em `src/tests/meta-idor.test.ts` é o fictício de
  sufixo `.test`). Lacunas do `.gitignore` fechadas no `2d9136d`: `*.pem`,
  `*.key`, `*.p12`, `*.jks`, `id_rsa*`, `*.gpg`, `.supabase/`; e a regra
  ampla `.github/` foi estreitada para `.github/*` + `!.github/workflows/`
  (o workflow de CI permanece rastreado — exigência do CI).
- **Varredura do histórico git** (33 commits de main + refs laterais,
  varredura por padrão de credencial):
  - `main` (público): **nenhuma credencial utilizável**. Só identificadores
    (ref do projeto Supabase, host pooler **sem senha**, slug da org) em
    `supabase/.temp/*` de commits antigos — os arquivos foram removidos do
    HEAD em `fbd8214`, mas permanecem no histórico (baixo risco: não
    abrem acesso por si só).
  - Refs **locais apenas** (`refs/stash` + `refs/agents/.../checkpoints`,
    commit `fe69880`, nunca publicados): 2 senhas reais do banco Supabase
    (pooler + padrão default `sbpg-project-<ref>`). Risco operacional: um
    `git push` desses refs publicaria os valores → **não empurrar refs de
    stash/agents**; a rotação do banco de produção [HUMANO] cobre a
    exposição.
- **Causa-raiz do CI vermelho** (todos os runs desde `d99d9bf` de
  2026-10-09 falham no passo `Test`; typecheck/lint passam): as 5 suítes de
  integração (`rls`, `b4-rls`, `token-rls`, `task-queue-rls`,
  `prisma-tenant`) exigem Postgres real + `TEST_ADMIN_DATABASE_URL` /
  `TEST_RLS_DATABASE_URL` + schema isolado com a role restrita `revx_test`
  — o workflow não provisionava nada.
- **Fix no `2d9136d`**: service `postgres:17` descartável (NUNCA produção,
  jamais credencial real de banco) + env de job `TEST_ADMIN_` /
  `TEST_RLS_` / `TEST_DATABASE_URL` + passo "Provision isolated test
  database" em cadeia idempotente: `apply-rls-setup.mjs` (role `revx_test`
  e `Organization`/`Contact`, políticas fail-closed, grants least-privilege)
  → `apply-token-rls-setup.mjs` (`User`/tokens + 008) →
  novo `scripts/provision-ci-test-db.mjs` (senha do `revx_test`
  sincronizada com `TEST_RLS_DATABASE_URL` + migration 014
  `Task`/`TaskStep`/`TaskEvent`/`AgentMemory` + FORCE RLS + grants
  guardados + verificação). O 009 é auto-aplicado pelo `beforeAll` da
  suíte b4-rls (cria as tabelas e aplica o arquivo real da migration).
- **Validação local pré-push (evidência real)**: criada DB vazia
  `revx_ci_sim` (espelha o container do CI) → cadeia completa executou
  (`revx_test grants: t_sel/t_ins/a_sel = true`, 4 tabelas FORCE, 4
  policies 014) → **suítes de integração 51/51 PASS (2,7s)**; suíte
  completa **185/185 PASS**; `tsc --noEmit` 0.
- **Nota de incidente (transparência §6)**: durante a simulação local, um
  erro de parse de URL imprimiu no terminal a senha do **admin do Postgres
  local (localhost)** — credencial de máquina, não de produção. O valor não
  está em repo, log, relatório, memória nem neste documento. Não requer
  ação além da rotação do banco de produção já pendente [HUMANO].
- **Run do CI sobre `2d9136d` — VERDE (evidência real)**: run
  `38973999041` (head `2d9136d`) = **success**, todos os passos green,
  incluindo "Provision isolated test database (RLS suites)", Test e Build
  (`github.com/bruno23raro/revolution-x/actions`). Causa-raiz confirmada e
  sanada: as 5 suítes de integração rodam no CI contra o Postgres
  descartável do service container.

## 2026-10-17 — Rotação da senha do banco Supabase de produção (PRIORITÁRIA → CONCLUÍDA)

### Alvo (a) — Hostinger hpanel (CONCLUÍDO + VERIFICADO)
- `DATABASE_URL` e `DIRECT_URL` atualizados em
  `hpanel.hostinger.com/websites/revolutionx.com.br/environment-variables`,
  **preservando a topologia de host direto do hpanel**
  (`db.ardpabjoepzhkpmkgwgu.supabase.co:5432`, user `postgres`), trocando
  a senha antiga (revogada no Supabase) pela nova (**40 chars hex; valor
  exato NUNCA versionado** — regra §6).
- Verificação de persistência: editor de cada variável reaberto e valor
  lido de volta → nova presente, antiga ausente (`hasNew=true,
  hasOld=false`).
- A senha antiga `B23b…` foi **revogada no dashboard Supabase** (reset) →
  qualquer processo ainda carregando ela perde o acesso ao banco; o
  processo em produção precisava de um **re-deploy** para pegar a nova.

### Alvo (b) — `.env.local` (CONCLUÍDO)
- `DATABASE_URL`/`DIRECT_URL` já apontam para a nova senha (topologia
  **pooler** `aws-0-sa-east-1.pooler.supabase.com:5432`, user
  `postgres.ardpabjoepzhkpmkgwgu`). Confirmado por leitura; as aspas do
  `DIRECT_URL` preservadas.
- `TEST_DATABASE_URL`/`TEST_*_DATABASE_URL` (Postgres local isolado)
  **intocados** — regra: nunca usar credencial de produção como fallback de
  teste.

### Prova da credencial (conexão real — `scripts/db-conn-test.mjs`, NUNCA imprime a senha)
- Host **direto** `db.…:5432`/`postgres` → **FAIL (timeout de conexão)**:
  é bloqueio de egress da máquina local ao 5432 direto do Supabase, **não**
  falha de autenticação.
- **Pooler** `aws-0-sa-east-1.pooler.supabase.com:5432`/
  `postgres.ardpabjoepzhkpmkgwgu` → **OK (217 ms)**, `user=postgres`,
  `db=postgres`. A senha do banco do Supabase é **compartilhada entre as
  topologias** (direta e pooler) → o valor novo é válido para as duas.

### Re-deploy do Hostinger (git integration)
- `git push origin main` (este commit de registro) → o hpanel clona, roda
  `npm run build` e sobe em ~1-2 min, **re-injetando o `.env` atual do
  hpanel** (a nova senha) no processo. A rotação só vira efetiva em produção
  nesse re-deploy.
- Smoke pós-re-deploy (verificar após ~90s–2min): `GET /` 200; `GET
  /api/admin/chat` 200 `routerConfigured:false` (resíduo E — `OMNIROUTER_*`
  ausente, **esperado**, não é problema de banco). Confirmação definitiva
  de banco em produção = probe da fila 014 `GET /api/admin/tasks` com
  sessão admin → 200 `{count:0}` ([HUMANO] — item 3 do handoff).

### Alvo (c) — secrets do GitHub Actions (RESOLVIDO = N/A — não há segredo a rotacionar)
- `secrets.DATABASE_URL` (linha 26 do `ci.yml`) é **referenciado, mas não
  existe**: as 5 suítes de integração usam **SOMENTE** os
  `TEST_*_DATABASE_URL` isolados (service `postgres:17`) — `b4-rls.test.ts`
  diz literalmente "Never DATABASE_URL/DIRECT_URL". O `prisma generate` e o
  `next build` toleram `DATABASE_URL` vazio. Logo a rotação **não afeta os
  testes** e o CI não depende de segredo de banco.

### Confirmação da rotação em produção (2026-10-17, pós-push `77a9696`)
- **Re-deploy do hpanel CONFIRMADO** (hpanel → revolutionx.com.br → Painel
  de controle): *Última implantação → Estado: **Concluído***; repositório
  `revolution-x`, filial `main`, commit `77a9696e` (este registro),
  **desdobrado 2026-10-17 08:38 em 1m 43s** → o git integration clonou o
  `77a9696`, rodou `npm run build` e **re-injetou o `.env` atual do hpanel**
  (nova `DATABASE_URL`/`DIRECT_URL`) no processo em produção. A nova senha
  está viva no app de produção.
- **Smoke público pós-re-deploy** (read-only contra `revolutionx.com.br`):
  - `GET /` → **200** (0,34 s).
  - `GET /api/admin/chat` → **200** `{"routerConfigured":false,"model":null,"baseUrl":null}`
    (rota da FASE AGENT no ar; `routerConfigured:false` = resíduo E
    `OMNIROUTER_*` ausente, **não** é problema de banco — esperado).
  - `GET /api/admin/tasks` **sem sessão** → **401** (fila 014 no ar; exige
    sessão admin).
  - Idêntico ao baseline documentado → processo de produção saudável.
- **Alvo (c) confirmado N/A**: `Settings → Secrets and variables → Actions`
  (GitHub, via navegador) → **Environment secrets = none** e **Repository
  secrets = "This repository has no secrets."** → NÃO existe segredo
  `DATABASE_URL`/`DIRECT_URL`. A senha exposta **nunca esteve** no GitHub;
  o `secrets.DATABASE_URL` resolve para **vazio** e o CI segue verde
  (run `38973999041`). **Decisão de segurança: NÃO criar** segredo de banco
  em repo **público** (superfície extra de exposição; o CI não o usa).
- **RESTA [HUMANO]** (único resíduo): probe definitivo de banco em produção
  `GET /api/admin/tasks` **com sessão admin** → 200 `{count:0}` (login no
  navegador; item 3 do handoff).
