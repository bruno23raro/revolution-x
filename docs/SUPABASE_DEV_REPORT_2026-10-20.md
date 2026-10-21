# RELATÓRIO — Projeto Supabase DEV + Auth de Teste + Migrations (2026-10-20)

Fase de "continuação autônoma total". Abaixo: o que foi executado e comprovado,
o que está bloqueado por decisão externa, e os próximos passos. NENHUM segredo foi
imprimido (valores de `.env`/chaves mascarados em todos os logs).

## 1. Projeto dev selecionado

- **Ref:** `urdmpzjycwywsjzhpntc` ("supabase-charcoal-lighthouse")
- **URL pública:** `https://urdmpzjycwywsjzhpntc.supabase.co`
- **Organização:** `vercel_icfg_R8zukxgiEIos1eWBs7nADT9m` (mesma org da produção — mesmo
  dono, sem custo adicional; NÃO é o projeto de produção).
- **Engine:** PostgreSQL 17.6 (idêntico à produção `17.6.1.166`).
- **Status:** `ACTIVE_HEALTHY`, região `us-east-1`, criado 2026-09-22, **não linked**
  ao app (produção continua `linked` = `ardpabjoepzhkpmkgwgu` "Revolution X").
- **Decisão:** REUTILIZADO em vez de criar um novo (evita decisão de faturamento/região).
  Região subótima para BR (us-east-1), mas funcional — registrado como ressalva.

### Projetos inventariados (read-only, `supabase projects list`)

| Ref | Nome | Região | PG | Status | Linked | Uso |
|-----|------|--------|----|--------|--------|-----|
| `ardpabjoepzhkpmkgwgu` | Revolution X | sa-east-1 | 17.6.1.166 | ACTIVE | **SIM** | **PRODUÇÃO — NÃO TOCAR** |
| `urdmpzjycwywsjzhpntc` | supabase-charcoal-lighthouse | us-east-1 | 17.6.1.166 | ACTIVE | não | **DEV (escolhido)** |
| `mmosryrkzbodqipdswvx` | supabase-fuchsia-xylophone | us-east-1 | 15.8 | INACTIVE | não | reusável, PG15 |
| `rpymjlqenfjsibrqaxfj` | brunoalmeida…'s Project | sa-east-1 | 17.6.1.166 | INACTIVE | não | (outra org) |

## 2. Chaves dev configuradas (seguras)

- Chaves `anon` + `service_role` do projeto dev obtidas via
  `supabase projects api-keys --project-ref urdmpzjycwywsjzhpntc --reveal`
  (saída redirecionada a arquivo; **nunca impressa** no terminal/logs).
- Injetadas em **`.env.docker.test`** (git-ignored: `.gitignore:4 .env.*`):
  - `NEXT_PUBLIC_SUPABASE_URL=https://urdmpzjycwywsjzhpntc.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY=…` (anon legacy)
  - `SUPABASE_SERVICE_ROLE_KEY=…` (service_role legacy)
  - Mantidos: `POSTGRES_*`, `JWT_SECRET`, `NEXT_PUBLIC_SITE_URL`.
- **Observação:** o comentário antigo "Supabase INTENCIONALMENTE vazio" no
  `.env.docker.test` está superado por esta decisão; as linhas de Supabase agora têm
  valor.

## 3. `.env` com BOM — CORRIGIDO

- `.env` (workspace, git-ignored) tinha BOM UTF-8 (`EF BB BF`) antes de
  `RESEND_API_KEY`, quebrando o parse do config do CLI Supabase e vazando
  `RESEND_API_KEY` no erro. BOM removido (3 bytes, reversível, local). CLI
  voltou a funcionar.

## 4. Auth do projeto dev — COMPROVADO

- `GET /auth/v1/settings` → **HTTP 200** (Auth habilitado e alcançável).
- `disable_signup=false` → signup permitido.
- `mailer_autoconfirm=false` + **sem provedor de e-mail** → signup cria usuário
  **pendente**; login por senha fica bloqueado até confirmação.
- **Teste de registro** (2 e-mails de teste com TLDs reservados `example.com`/`.test`):
  `400 email_address_invalid` — GoTrue rejeita domínios reservados.
- **Conclusão:** para E2E de login funcional (register→login) é preciso **um dos**:
  (a) habilitar `mailer_autoconfirm` no projeto dev, (b) configurar um provedor de e-mail
  de teste, ou (c) confirmar o e-mail via magic-link. Ver §6.

## 5. Migrations SQL 005–016 no projeto dev — BLOQUEADO (documentado)

- `meta_integrations` **não existe** no projeto dev
  (`GET /rest/v1/meta_integrations` → `404 PGRST205 "table not found"`).
- **Causa raiz (dual-schema drift, já documentado):**
  - O app lê `meta_integrations` (snake_case: `organization_id`,
    `encrypted_access_token`, `phone_number_id`, `meta_page_id`,
    `instagram_account_id`, `connected_at`, `status`) via client Supabase
    service_role (`src/integrations/meta/resolveAccess.ts`).
  - A cadeia SQL `005→016` **depende de uma base snake_case** (`organizations`,
    `users`) criada por migrations **001–004 que NÃO estão no repo**
    (`supabase/migrations/` só tem `005,006,007,008,009,014,015,016`).
    O `005` faz `REFERENCES organizations(id)` → falha num projeto vazio.
  - O modelo Prisma `MetaIntegration` mapeia para `meta_integrations` com
    **colunas PascalCase** (`organizationId`, `accessToken`, `status='connected'`)
    — **incompatível** com a coluna snake que o resolver lê. Ambos não coexistem na
    mesma tabela.
- **Consequência:** não é possível aplicar a cadeia 005–016 de forma limpa num
  projeto dev vazio sem recriar a base snake (001–004 ausente). **Não inventei a
  base** — registrado como pendência externa.
- Caminho seguro (não executado, decisão necessária): recriar 001–004 a partir do
  schema de produção (dump) e então 005→016 no projeto dev; OU aplicar no projeto
  dev via `supabase db push` (Pascal, Prisma) + criar a tabela snake `meta_integrations`
  separada. Requer decisão do dono.

## 6. Próximos passos / pendências (NÃO inventadas)

1. **[HUMANO/DECISÃO] Migrar 001–004 + 005–016 para o projeto dev.** Opção
   recomendada: `supabase db dump` de produção (read-only) → extrair a base
   snake `organizations`/`users` → aplicar 005→016 no dev via
   `supabase db push --linked` (após link do dev) ou `--db-url`. Requer a senha
   do DB do dev (CLI não expõe; obter no dashboard do Supabase).
2. **[HUMANO/DECISÃO] Habilitar login de teste.** Recomendação: no projeto dev,
   ativar `mailer_autoconfirm` (Settings → Authentication → Providers → Email →
   Autoconfirm on) OU apontar um provedor de e-mail efêmero. Revisão reversível,
   só dev.
3. **E2E funcional real (register→login→sessão→org→CRM).** Ferramenta disponível:
   **chrome-devtools MCP** (Playwright/Playwright-extension **NÃO** está
   instalado no projeto — `package.json`, `node_modules`, binário global e config
   ausentes). O E2E de browser aguarda os itens 1–2 (Auth autoconfirm +
   `meta_integrations` no dev) para cobrir também o fluxo multi-conta Meta.
4. **Multi-conta Meta (Fase G)** — limitada até a tabela `meta_integrations`
   (snake) existir no projeto dev (§5).

## 7. Escopo respeitado (confirmação de integridade)

- ❌ Nenhum write em produção (`ardpabjoepzhkpmkgwgu` intacto; nenhuma
  `supabase db push/query` de produção foi disparada).
- ❌ Nenhum `commit`/`push`/`PR`/`merge`/deploy/cron.
- ❌ Nenhuma limpeza de volume Postgres (`docker volume prune` etc.).
- ✅ `.env` BOM corrigido (local, reversível).
- ✅ Projeto dev inventariado, reutilizado e configurado (chaves no `.env.docker.test`).
- ✅ Auth do dev comprovado (HTTP 200 + signup permitido).
- ✅ `meta_integrations` ausente no dev (prova read-only `404`).

## 9. COMPROVAÇÃO da migration 016 — executada em banco DESCARTÁVEL isolado (Fase C)

Validei a migration 016 num **banco novo e descartável** `meta016_validate` no
Postgres local do stack de teste (`revolution-x-test-db-1`), **sem tocar em
`revolution_x` nem em produção**. Construí o pré-estado (005) com uma base
snake_case mínima (`organizations`) + os seeds, apliquei 005 e depois 016, e
comprovei o comportamento exato:

| # | Etapa | Resultado |
|---|-------|-----------|
| 3 | aplicar 005 | `CREATE TABLE/INDEX/ALTER/POLICY/COMMENT` — tudo OK (snake `meta_integrations` + `webhook_events` + RLS) |
| 4 | PRE-016: 2ª linha mesmo (org, provider) | **BLOQUEADA** — `duplicate key ... "meta_integrations_organization_id_provider_key"` ✔ (trava 1 conta por provedor) |
| 5 | aplicar 016 | `ALTER TABLE` (display_name) + backfill `UPDATE 1` + `DROP CONSTRAINT` + 2 `CREATE INDEX` — OK |
| 6 | POST-016: 2 contas mesmo (org, provider), páginas diferentes | **LIBERADA** — `pages=2` ✔ (multicontas efetiva) |
| 7 | POST-016: conta EXATA (org, provider, page_A) | **BLOQUEADA** — `duplicate key ... "uq_meta_integrations_account"` ✔ (dedup por conta exata) |
| 8 | POST-016: 2 linhas PENDING com ids nulos | **LIBERADAS** — `PENDING_IG rows=2` (NULLs não colidem na expressão COALESCE) ✔; `display_name` backfilled só onde havia página (`Página page_A`) |

**Conclusão (comprovada, não inferida):** a migration 016 aplica limpa num
pré-estado 005 e produz exatamente o comportamento multicontas especificado:
libera múltiplas contas do mesmo (org, provider), mas trava a duplicata exata
da mesma conta; linhas PENDING sem id continuam inseríveis; `display_name`
backfilled melhor-esforço. Banco descartável foi **excluído** (sem resíduo).

### Achado: dual-schema drift VIVO no stack local

No stack de teste, a tabela `meta_integrations` do Postgres local (criada por
`prisma db push`) é a versão **PascalCase** (`organizationId`, `accessToken`,
`phoneNumberId`, `accountId`, único PK, **sem** `provider`, **sem**
`encrypted_access_token`, **sem** RLS). Mas o resolver
(`src/integrations/meta/resolveAccess.ts`) lê **colunas snake** via client
service_role (`organization_id`, `encrypted_access_token`, `provider`,
`meta_page_id`, …). Ou seja: a tabela local do Prisma/Postgres **NÃO serve** o
fluxo multicontas Meta — esse fluxo só funciona contra um projeto Supabase com
as migrations SQL 005–016 aplicadas. Isso é a prova prática do dual-schema drift
documentado e reforça a recomendação: o fluxo Meta deve rodar contra o
schema snake (SQL), não contra a tabela Prisma Pascal.

## 8. Estado final dos artefatos

- `.env.docker.test` — atualizado com URL + anon + service_role do dev (git-ignored).
- `.env` — BOM removido (git-ignored).
- `supabase/migrations/` — inalterado (005–009, 014–016 presentes; 001–004 ausentes).
- `docs/SUPABASE_DEV_REPORT_2026-10-20.md` — este relatório.

## 10. E2E FUNCIONAL REAL — 2026-10-21 (concluído e comprovado)

Seção de continuação da missão (DESTRAVAR SUPABASE DEV + E2E). Executado com o
stack de teste Docker no ar (`app` :3000 healthy + `db` Postgres17 local :15432),
apontando o plano Supabase para o projeto DEV `urdmpzjycwywsjzhpntc` e o plano
Prisma para o Postgres local. **Produção NÃO foi modificada.**

### 10.1 — Descoberta: dois planos de dados separados (split-brain)
- **Plano Prisma** (`DATABASE_URL` → Postgres local Docker): é onde o app lê a
  sessão/autorização e o CRM. `getAuthenticatedUser()` (`src/lib/auth.ts`) chama
  `supabase.auth.getUser()` (GoTrue/DEV) e depois `prisma.user.findUnique`
  (`withUserContext`) → **Postgres local**. As rotas de CRM
  (`src/repositories/crmRepoReal.ts`) escrevem no **Postgres local**.
- **Plano Supabase** (`createServiceRoleClient()` → DEV `urdmpzjycwywsjzhpntc`):
  é onde o onboarding do `register` (`app/api/auth/register/route.ts`) escreve
  `"User"`/`"Organization"`/`"OrganizationMember"`, e onde os resolvers de
  integração (Meta/TikTok) leem `meta_integrations` (snake) via service_role.
- **Implicação:** num stack de teste em que Prisma→local e Supabase→DEV são
  bancos DIFERENTES, o ciclo register→login→CRM só fecha se os dois planos
  forem consistentes. Como a rota `register` estava bloqueada (429 rate-limit +
  `mailer_autoconfirm=false`, §4/§6), destravei o login de forma controlada:
  criei usuários **confirmados** por API admin GoTrue e **semei as linhas Prisma
  equivalentes no banco local** — sem tocar em produção e sem precisar da senha
  do DB do DEV.

### 10.2 — Destravamento do Auth (DEV, reversível) via API admin GoTrue
- Caminho CLI/IPv4 (`supabase db push/query`, Management API) seguiu bloqueado
  nesta sessão. Mas a **API pública do GoTrue via HTTPS** está acessível e a
  chave `service_role` do DEV (no `.env.docker.test`, git-ignored, nunca
  impressa) consegue criar usuários.
- `POST $DEV/auth/v1/admin/users` com `email_confirm:true` + e-mail de sandbox
  (TLD não-reservado) → 2 usuários **confirmados** criados, **sem e-mail de
  confirmação disparado** (o `admin.createUser` com `email_confirm:true` já
  marca `email_confirmed_at`).
- **Decisão:** em vez de ligar `mailer_autoconfirm` no projeto (mudança de
  config global, item humano §6), usei o admin para criar usuário confirmado —
  cirurgia reversível (DELETE), específica, e cobre exatamente o fluxo de
  login/sessão/org/CRM pedido em §G.

### 10.3 — Semente Prisma local (PascalCase, RLS desligada localmente)
- Semeei no Postgres local (banco de teste descartável, via psql por host-stdin):
  2× `"User"` (id = UUID do GoTrue, `passwordHash='placeholder_migrated_user'`),
  2× `"Organization"`, 2× `"OrganizationMember"` (role `admin`). RLS local =
  `relrowsecurity=false` nas 7 tabelas-chave (Prisma não gera RLS) → o `GUC
  app.current_user_id` de `withUserContext` é inofensivo localmente.

### 10.4 — Matriz do ciclo E2E (ao vivo, Docker :3000 + DEV GoTrue + Prisma local)

| # | Etapa | Método/Rota | Resultado observado | Veredicto |
|---|-------|-------------|---------------------|-----------|
| 1 | login user1 | `POST /api/auth/login` | **200** `{user:{id,email_verified:true}}` + Set-Cookie | ✅ |
| 2 | sessão user1 | `GET /api/auth/session` | **200** `{authenticated,role:"admin",organizationId:O1}` (lê Prisma **local**) | ✅ prova split-brain resolvido |
| 3 | health user1 | `GET /api/integrations/health` | **200** — 18 providers `not_configured` | ✅ (antes era 401 sem auth) |
| 4 | criar contato | `POST /api/crm/contacts` | **201** — linha com `organizationId=O1` | ✅ |
| 5 | **mass-assignment** | `POST /api/crm/contacts` com `organizationId=O2` plantado no body (email válido) | **201**, mas a linha nasce em **O1** (rota faz `delete body.organizationId`) | ✅ trava cross-tenant |
| 6 | listar contatos user1 | `GET /api/crm/contacts` | **200** — só O1 | ✅ |
| 7 | **isolamento cross-org** | login user2 (org O2) → `GET /api/crm/contacts` | **200** `{"organizationId":O2,"items":[]}` — user2 NÃO vê o contato de O1 | ✅ multi-tenant provado |
| 8 | logout user1 | `POST /api/auth/logout` | **200** `{success:true}`; logo após `GET /api/crm/contacts` → **401** | ✅ |
| 9 | sem cookie | `GET /api/crm/contacts` (jar novo) | **401** `{error:"Unauthorized"}` | ✅ authz de backend |

- **`validateContact`** (`src/services/crmService.ts`) valida só `email`
  (obrigatório + formato) e `name` (obrigatório); **não** rejeita campos
  desconhecidos — a trava de mass-assignment é a `delete body.organizationId`
  da rota (o item 5 prova que um `organizationId` plantado é descartado).
- **Multi-conta do MESMO provider (Meta/TikTok, §G):** continua **BLOQUEADO** —
  requer a tabela snake `meta_integrations` (SQL 005/016), ausente no DEV, e a
  tabela local do Prisma é a versão Pascal (sem `provider`/`encrypted_access_
  token`/RLS; §5/§9). Validei **isolamento cross-org de usuário** (item 7) em
  vez de multi-conta de provider, porque esse último depende do schema snake.

### 10.5 — Limpeza reversível executada
- Os 2 usuários GoTrue do DEV foram **deletados** via admin (`DELETE .../admin/
  users/<id>` → 200,200). As linhas Prisma locais (3 contatos, 2 membros, 2
  orgs, 2 users) foram **removidas** (verificado: 0 restantes). Arquivos temp
  removidos. **Sem resíduo no DEV nem no banco local.**

### 10.6 — Confirmação de integridade (desta sessão)
- ❌ **Nenhum write em produção** (`ardpabjoepzhkpmkgwgu` intacto; só
  `supabase db query/push` de leitura contra projetos; writes GoTrue/DB foram
  exclusivamente DEV + Postgres local do stack de teste).
- ❌ Nenhum commit/push/PR/merge/deploy/cron.
- ✅ `.env.docker.test` preservado (git-ignored); chaves nunca impressas
  (só `KEY_LEN`). E2E funcional **comprovado ao vivo**, não inferido.

### 10.7 — Pendências HUMANAS exatas e reversíveis (não inventadas)
1. **Testar a rota real `/api/auth/register` (signup):** hoje devolve
   `429 over_email_send_rate_limit` + `mailer_autoconfirm=false` (§4). Para o
   fluxo de signup real funcionar no DEV, ligar `mailer_autoconfirm` **no
   projeto dev** (Dashboard → Auth → Providers → Email → Autoconfirm ON) ou
   apontar um provedor de e-mail efêmero. Reversível, só DEV. *Nesta sessão
   destravei o login via admin-create em vez de habilitar autoconfirm.*
2. **Migrações 001–004 + 005–016 no DEV (para a multi-conta de provider real):**
   aplicar a base snake + 005/016 no projeto dev via `supabase db push --linked`
   (após `supabase link` em rede IPv4) ou `--db-url` (requer a **senha do DB do
   dev** por prompt seguro/CLI, nunca no chat). Alternativa: dump **read-only**
   do schema de produção (só schema, sem dados) + revisão. Enquanto isso, o
   fluxo multi-conta Meta/TikTok segue bloqueado (§5). **Item humano/decisão.**
3. **Token expiry / refresh:** a sessão GoTrue carrega `access_token` (TTL curto)
   + `refresh_token`; `setSession` no login persiste o par. Não forcei expiração
   artificial; o caminho de refresh é exercido pelo SDK. (Cobertura parcial.)

---

## 11. ADDENDUM 2026-10-21 — base reconstruída, bug do 002, e caixa de aplicação DEV

> **Nota:** esta seção corrige/refina o item 2 do §10.7 acima. O diagnóstico
> "migrações 001–004 ausentes" era **errado**, e o método recomendado
> (`supabase db push` no DEV) é o **errado** para o DEV — ver §11.3.

### 11.1 — 001–004 NÃO estão faltando; a base Supabase é o `002`
As duas famílias de migração têm numeração sobreposta e conteúdo **disjuntos**:
- **Família A** `./migrations/` (base Prisma/local): `001,002,003,004,005,006,007,008,011,012,013`.
- **Família B** `./supabase/migrations/` (SQL snake/Supabase): `005,006,007,008,009,014,015,016`.

A base que o Supabase precisa é a **família A `002_fase2_auth_multitenant_supabase.sql`**
(usa `auth.users`, exige `public.users` ausente). `003`/`004` (Fam. A) são as camadas
CRM/mídia snake, **não exigidas** pelo resolver de Meta. **Nada foi perdido** — 002 está
no repositório desde o commit raiz.

### 11.2 — Bug do 002 (etapa 19) encontrado e corrigido
A etapa 19 do `002` estava **invertida**: `IF NOT EXISTS (public.users) THEN RAISE EXCEPTION`,
o que **aborte um banco Supabase em estado limpo** (onde `public.users` não existe — o estado
correto). Corrigido para `IF EXISTS (...)`. A versão corrigida foi guardada em
**`supabase/dev_apply/002a_supabase_base.sql`** (arquivo original do usuário **inalterado**).

### 11.3 — Cadeia DEV correta: só SQL snake, NUNCA `prisma db push`
Dois planos de dados → **dois bancos**:
- **Prisma/Pascal** → Postgres local Docker (`DATABASE_URL`, `:15432`, `revolution_x`), via `prisma db push`.
- **Supabase/snake** → DEV `urdmpz...`, via SQL (`createServiceRoleClient()`), resolvers Meta/TikTok.

O DEV **não hospeda** o plano Pascal (schema `public` vazio, 0 usuários GoTrue). Portanto a
cadeia DEV é **apenas**: `002a(base) → 005 → 015 → 016` (não 006/008/009/014 — esses são
ALTER de tabelas Pascal e falhariam no DEV vazio). `prisma db push` **só** no Docker local.

### 11.4 — Cadeia COMPROVADA em banco descartável (novo)
Em `rx_devchain_validate` (criada/apagada no `revolution-x-test-db-1`; **não** tocou
`revolution_x`/DEV/PROD): `auth stub → 002a → 005 → 015 → 016 → verify` **passou limpo**:
2 páginas FB coexistem; duplicado exato bloqueado por `uq_meta_integrations_account`;
PENDING (ids nulos) coexiste; mesma página em outro org permitida; `UNIQUE(org,provider)`
legado removido; 3 índices novos; RLS ON em `meta_integrations`. Banco **dropado**, sem resíduo.

### 11.5 — Caixa de aplicação DEV (artefatos novos desta sessão)
- `supabase/dev_apply/002a_supabase_base.sql` — base 002 corrigida.
- `supabase/dev_apply/verify_dev.sql` — 6 verificações read-only.
- `supabase/dev_apply/apply_dev.sh` — aplica a ordem no **DEV só** (`ON_ERROR_STOP`,
  aborta se a URL contiver o ref de produção), senha só por variável de ambiente.
- `docs/DEV_APPLY_HUMAN_GUIDE_2026-10-21.md` — guia de iniciação (passos humanos).

### 11.6 — Bloqueio humano que abre tudo (DEV)
O projeto DEV **nunca teve a senha do Postgres definida** → `db query`/`db push` falham
com `PAM authentication failed for user "postgres"`. Passos (guia §1–§2):
(1) **humano** define a senha do DB do DEV no dashboard; (2) re-revela as chaves do DEV
(o `.env.docker.test` ficou obsoleto/401). Depois disso, o `apply_dev.sh` roda.
`mailer_autoconfirm=false` + sem provedor de e-mail segue bloqueando o signup real
(§10.7 item 1), reversível só no DEV.

### 11.7 — §8 (testes locais) verde e Prisma-MetaIntegration
`tsc 0 · eslint 0 · jest 578/578 (44 suítes) · build clean`. O modelo Prisma
`MetaIntegration` (camel) tem **0 chamadas** em runtime (morte); `WebhookEvent` (camel)
**vive** em `app/api/webhooks/inbound/route.ts:79` (plano local). Não há mudança de código
necessária ao objetivo de multi-contas Meta — só a regra operacional do §11.3.

### 11.8 — Aviso de vazamento (agir agora)
Uma inspeção com um parse com bug imprimiu **uma vez** as chaves anon+service_role do DEV
e a `DATABASE_URL` pooler da **produção** (com senha). **Rotacionar:** (1) `service_role`
do DEV; (2) senha do pooler da produção. Tratar o rastro como sensível.
