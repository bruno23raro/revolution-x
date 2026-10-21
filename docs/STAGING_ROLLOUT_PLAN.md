# Plano de Rollout para Staging — Missão 5g

## Sequência de Aplicação

### Pré-requisitos (todos atendidos)

- [x] `withUserContext` em `auth.ts` (getAuthenticatedUser + getAllOrganizationMemberships)
- [x] `withUserContext` em `callback/meta/route.ts`
- [x] `withTenantContext` em `crmRepoReal.ts` + `productRepoReal.ts` + `webhooks/meta/route.ts`
- [x] `middleware.ts` usa `createServiceRoleClient()`
- [x] Rotas forgot-password / reset-password / verify-email / resend-verification implementadas
- [x] Interface de email pluggável (`src/lib/email.ts`)
- [x] 15 novos testes de segurança (`src/tests/auth-security.test.ts`)

### Passos

1. **Backup do schema atual**

   ```bash
   supabase db dump -f backup-pre-007.sql
   ```

2. **Aplicar migration 007 em staging** (tenant RLS hardening)

   ```bash
   supabase migration up --db-url <staging-db-url>
   ```

3. **Testar CRM em staging**
   - Criar organização de teste + membro
   - CRUD completo de contacts/leads/deals/pipelines/products
   - Verificar isolamento multi-tenant (org A não vê org B)

4. **Aplicar migration 008 em staging** (user-scoped tokens)

   ```bash
   supabase migration up --staging-db-url
   ```

5. **Testar fluxos de autenticação em staging**
   - Register → User_self_write permite INSERT
   - Login → User_self permite SELECT
   - Forgot password → PasswordResetToken user-scoped
   - Reset password → token validation + password update
   - Verify email → EmailVerificationToken user-scoped
   - Resend verification → regeração de token

6. **Aplicar migration 009 em staging** (B4 RLS correction: Session + BillingEvent)

   ```bash
   supabase migration up --staging-db-url
   ```

   **Correção crítica de segurança (B4):**
   - `Session` re-escopada para usuário (app.current_user_id) -- elimina leak
     cross-tenant onde sessões com organizationId=NULL eram visíveis a todos.
   - `BillingEvent` escopo estrito por tenant (app.current_org) -- eventos órfãos
     (organizationId=NULL após DELETE da org) fecham fail-closed em vez de abrir.
   - `Role` inalterado (NULL-permissivo, intencional para roles globais).
   - Validar com `src/tests/b4-rls.test.ts` antes de prosseguir.

7. **Testar webhook Meta**
   - Configurar integração Meta em staging
   - Simular webhook e verificar processamento

8. **Validar middleware**
   - Usuário autenticado recebe cookie x-organization-id
   - Usuário sem membership não recebe cookie

## Critérios de Interrupção (Rollback)

- Qualquer rota CRM retornando 403/500 após 007
- Login/register falhando após 008
- Webhook Meta parando de funcionar
- Erros de cast UUID quando GUC app.current_org está vazio

## Rollback

```bash
supabase db restore -f backup-pre-007.sql --db-url <staging-db-url>
```

## Estado das Migrations em Produção

- MIGRATION 007 APLICADA EM PRODUÇÃO: **SIM** (2026-10-15, via `supabase db query --linked -f`)
- MIGRATION 008 APLICADA EM PRODUÇÃO: **SIM** (2026-10-15)
- MIGRATION 009 APLICADA EM PRODUÇÃO: **SIM** (2026-10-15)
- MIGRATION 014 APLICADA EM PRODUÇÃO: **SIM** (2026-10-15, §FASE AGENT acima)
- MIGRATION 015 APLICADA EM PRODUÇÃO: **SIM** (2026-10-15, §015 abaixo)

### Validação (staging-first)

- Validação em banco isolado (`revolution_x_rls_test` / role `revx_test`):
  suíte `b4-rls` + `token-rls` + `rls` + `prisma-tenant` → **41/41 PASS**
  antes da promoção a produção, e re-executada após as correções (41/41).
- Smoke no ar (sem efeitos colaterais): `GET /login` 200,
  `POST /api/auth/login` → 401 `invalid_credentials`,
  `POST /api/auth/forgot-password` → 200 genérico. App inalterado
  (conexão Prisma como `postgres`, que tem `BYPASSRLS`, não sujeito a RLS).

### Correções nos arquivos de migration (aplicadas e verificadas)

- **007** — 2 bugs latentes que impedi­am a aplicação em produção:
  1. Escaping PL/pgSQL: `''` (string vazia) sub-escapada nos blocos `EXECUTE`
     → `NULLIF(current_setting('app.current_org', TRUE), '')::uuid` ficava
     `')::uuid` (erro 42601). Corrigido para `''''` (quatro aspas).
  2. Guard `to_regclass(t)` dobrava o nome para minúsculo e retornava NULL
     para as tabelas PascalCase de produção → 007 ficava no-op silencioso.
     Corrigido para `to_regclass(quote_ident(t))`.
  3. Citação do nome de policy: `format('%I_tenant', t)` gerava
     `"OrganizationMember"_tenant` (erro 42601). Corrigido para
     `format('%I', t || '_tenant')` → `"OrganizationMember_tenant"`.
- **008 / 009** — GRANTs para o role local `revx_test` (inexistente em
  produção) lançavam erro 42704 fora do handler de exceção. Corrigido com
  guard `AND to_regrole('revx_test') IS NOT NULL` (mantém o grant no ambiente
  de teste, onde o role existe).

### Snapshot de rollback

- `supabase db dump` requer Docker (hoje instalado; na época dessa decisão não
  estava) → usado snapshot de
  nível de policy via Management API (idêntico ao rollback deste change):
  - `backups/rls-before-007-009_policies.json` / `..._flags.json` (estado anterior)
  - `backups/rls-after-007-009_policies.json` / `..._flags.json` (estado atual)
  - Último recurso: backup/PITR do dashboard do Supabase.

---

## FASE AGENT (Phase 2) — Migration 014: fila de tarefas + memória do agente

> Decisão do usuário (2026-10-15): **staging primeiro**, promoção à
> produção somente com autorização explícita.

### O que a migration 014 cria (DDL aditivo, reversível)

- 4 tabelas PascalCase: `"Task"`, `"TaskStep"`, `"TaskEvent"`, `"AgentMemory"`.
- RLS **ENABLE + FORCE** (fail-closed via `NULLIF(current_setting(..., TRUE), '')`):
  - `Task_tenant` / `TaskStep_tenant` / `TaskEvent_tenant` → escopo de **tenant** (`app.current_org`)
  - `AgentMemory_user` → escopo de **usuário** (`app.current_user_id`, padrão do 008)
- Grants restritos: `authenticated` / `service_role` / `revx_test` (guard `to_regrole`).
- Nenhum `BYPASSRLS` é concedido. O app (role `postgres`) já tem BYPASSRLS,
  então a fila funciona pelo caminho Prisma; o RLS restringe a API Supabase.
- Rollback: `DROP TABLE "AgentMemory", "TaskEvent", "TaskStep", "Task"`
  (cascata para policies/indexes). Sem impacto em dados existentes.

### Validação staging-first (REAL, concluída 2026-10-15)

Banco isolado local (`revolution_x_rls_test`, role `revx_test`), suíte
`src/tests/task-queue-rls.test.ts` (sem mocks de banco) → **10/10 PASS**:

- **Schema**: 4 tabelas com `relrowsecurity=true` e `relforcerowsecurity=true`;
  policies `Task_tenant`, `TaskStep_tenant`, `TaskEvent_tenant`, `AgentMemory_user`.
- **RLS (papel restrito + GUCs)**:
  - org A vê só a própria Task; org B não vê a de A;
  - GUC vazio **ou** ausente → 0 linhas (fail-closed, sem erro);
  - `AgentMemory` escopada por usuário (user A vê, user B não);
  - escrita cross-tenant: INSERT de outra org rejeitado (42501, nada gravado);
    UPDATE cross-tenant afeta 0 linhas.
- **App path (mesmo wiring da produção: Prisma + BYPASSRLS)**:
  - ciclo de vida completo com progresso REAL 33 → 66 → 100 + evento `created`;
  - isolamento de tenant na listagem; cancelamento preserva histórico;
  - `AgentMemory` upsert/list com escopo tenant+usuário.

### Passo de promoção (APLICADA EM PRODUÇÃO — 2026-10-15)

Autorização: missão final de 2026-10-15 ("executar a migration 014 após
verificar os pré-requisitos, o destino, a compatibilidade e o plano de
rollback"). Registro da execução:

1. **Destino verificado**: `supabase projects list` → linked = projeto
   **"Revolution X"** (`ardpabjoepzhkpmkgwgu`, sa-east-1, ACTIVE_HEALTHY,
   PG 17.6) — o mesmo mecanismo (`--linked`) usado nas promoções 007/008/009.
2. **Pré-requisitos no destino** (SELECT de introspecção):
   `server_version=17.6`, **22 policies `_tenant`** (007–009 presentes),
   **23 tabelas com RLS FORCE** (baseline), **0 tabelas da 014**
   (estado limpo; DDL é aditivo/idempotente → sem conflito).
3. **Executada**: `supabase db query --linked -f supabase/migrations/014_agent_task_queue.sql`
   (sem erros).
4. **Comprovação no banco de destino** (query pós-aplicação):
   - 4/4 tabelas (`Task`, `TaskStep`, `TaskEvent`, `AgentMemory`);
   - 4/4 com `relrowsecurity AND relforcerowsecurity` (fail-closed);
   - 4/4 policies (`Task_tenant`, `TaskStep_tenant`, `TaskEvent_tenant`,
     `AgentMemory_user`);
   - 12 indexes; `Task` vazia (0 linhas).
5. **Smoke de produção (leitura, sem efeitos colaterais)**:
   - `/`, `/login`, `/dashboard` → **200** (app inalterado);
   - `/api/auth/session`, `/api/crm/contacts`, `/api/products` sem sessão →
     **401** (gates intactos);
   - `/admin/chat`, `/api/admin/*` → **404 ESPERADO**: a build em produção
     ainda é anterior à FASE AGENT (rotas não existem lá). O smoke
     admin-200/[] com sessão fica para **após o deploy da FASE H**
     (requer também login de admin — intervenção do usuário).

**Rollback** (não usado; documentado): `DROP TABLE "AgentMemory","TaskEvent","TaskStep","Task"`
— nada de dados existia nas tabelas novas (0 linhas) → zero perda.

### Roteador de IA em produção (decisão: endpoint + chave no env do servidor)

`http://localhost:20128` (OmniRouter local) é inacessível do servidor
Hostinger. O caminho acordado:

- Defina no ambiente do servidor (NUNCA no frontend):
  - `OMNIROUTER_BASE_URL` — endpoint alcançável do servidor em produção;
  - `OMNIROUTER_API_KEY` (ou, alternativamente, `ANTHROPIC_BASE_URL` +
    `ANTHROPIC_AUTH_TOKEN` — a mesma cadeia de fallback do
    `resolveOmniRouterConfig()` em `src/ai/omniRouter.ts`).
- Nenhum segredo sai do backend: `GET /api/admin/chat` expõe apenas
  `routerConfigured`, `model` e a **origin** da URL (sem userinfo/credenciais).
- Verificação pós-deploy (sem custo de LLM):
  - `GET /api/admin/chat` → `{"routerConfigured":true,...}`;
  - `POST /api/admin/chat` com sessão admin → evento `message` real.
- Enquanto a variável não existir em produção, a UI mostra o estado honesto
  "roteador não configurado neste ambiente" e o chat fica desabilitado —
  nada é simulado.

---

## Migration 015 — Idempotência do webhook Meta (corretiva, 2026-10-15)

### Problema

O claim de idempotência da rota `app/api/webhooks/meta/route.ts` usa
`INSERT ... ON CONFLICT (meta_event_id)`. Em produção o `webhook_events`
(005) só tinha:

- PK `event_id UUID`;
- `meta_event_id TEXT NOT NULL`;
- **único composto** `uq_webhook_events_meta_integration (meta_event_id,
  integration_id)`;
- índice **não-único** `idx_webhook_events_meta`.

`ON CONFLICT (meta_event_id)` exige um índice **único simples** naquela
coluna → Postgres lança **42703** → rollback da transação inteira →
**todos os webhooks eram descartados silenciosamente** (0 linhas
persistidas em `webhook_events`).

### O que a migration cria

- `uq_webhook_events_meta_event_id UNIQUE (webhook_events(meta_event_id))`
  (`CREATE UNIQUE INDEX IF NOT EXISTS`, guard `to_regclass` para ambientes
  sem a tabela).

- **Staging** (`revolution_x_rls_test`): DDL executou sem erro; a tabela
  não existe nesse schema → **no-op via guard** (comportamento
  documentado, honesto).
- **Produção (destino verificado)**: `supabase status` → linked =
  `ardpabjoepzhkpmkgwgu` "Revolution X" (o projeto
  `https://ardpabjoepzhkpmkgwgu.supabase.co`, confirmado pelo usuário).
- **Pré**: `webhook_events` existe (PG 17.6), **0 linhas**, únicos só
  `webhook_events_pkey` + `uq_webhook_events_meta_integration`.
- **Execução**: `supabase db query --linked -f
  supabase/migrations/015_webhook_idempotency.sql` → `DO`, sem erros.
- **Pós (comprovação)**: `pg_index` lista `uq_webhook_events_meta_event_id`
  com `indisunique=true`; `to_regclass` não-NULL; `row_count` = 0.

### Rollback

`DROP INDEX IF EXISTS uq_webhook_events_meta_event_id;` — índice apenas,
0 linhas na tabela → **zero perda de dados**. Se removido, a rota
degrada para o fast-path `service_role` + processamento sem claim
(testes de G3 cobrem essa degradação honesta).

### Nota de drift (2026-10-21)

A 015 foi aplicada em produção **ad-hoc** (`supabase db query`), então o
índice `uq_webhook_events_meta_event_id` **existe** mas **não está
registrado** na ledger `supabase_migrations` (o Supabase não o "sabe").
Consequências:

- **Reaplicar o arquivo 015 é no-op seguro**: `CREATE UNIQUE INDEX
  IF NOT EXISTS` + guard `to_regclass` — ele roda limpo em DEV
  (onde a tabela nasce da 002a/005), em produção (índice já existe) e
  em staging (tabela ausente). Nunca duplique o índice manualmente.
- **Não rodar `supabase db pull`** na produção (regra de ouro) — o pull
  poderia reescrever a ledger de forma inconsistente com o estado real.
- Opcional (gate humano): registrar retroativamente 007–015 em
  `supabase_migrations` para fechar o drift.

## Migration 016 — Multi-contas Meta (nova, 2026-10-21)

- **Status em produção: NÃO APLICADA** (gate humano: snapshot + revisão do
  SQL + verificação read-only + plano de rollback em mãos).
- **Status no DEV: NÃO APLICADA** (bloqueado pela senha do Postgres do
  DEV — `docs/DEV_APPLY_HUMAN_GUIDE_2026-10-21.md`, turno 5).
- **O que muda:** remove o `UNIQUE(organization_id, provider)` legado
  (cobre **os dois nomes possíveis**: `uq_meta_integrations_org_provider`
  — legado nomeado da produção — e
  `meta_integrations_organization_id_provider_key` — nome autogerado que
  a 005 cria em árvores limpas como a do DEV; cada `DROP CONSTRAINT
  IF EXISTS` é no-op na forma em que o nome não existe), e adiciona:
  coluna `display_name`; índices de expressão únicos
  `uq_meta_integrations_page` / `uq_meta_integrations_account`.
- **Validação local:** cadeia `002a → 005 → 015 → 016` + rollback
  comprovada em bancos descartáveis locais (duas formas de banco, ver
  guia do DEV, turno 5). Produção permanece intocada.
- **Rollback:** `supabase/migrations/016_rollback.sql` (reversão da
  camada nova em 3 passos: remove índices de expressão, recria o unique
  legado, remove `display_name`).
