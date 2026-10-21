# REVOLUTION X — Guia de Iniciação: aplicar multi-contas Meta + cadastro E2E no DEV

**Data:** 2026-10-21 · **Objetivo DEV:** `urdmpzjycwywsjzhpntc` ("supabase-charcoal-lighthouse") · **Produção (intocável):** `ardpabjoepzhkpmkgwgu`

> Leia junto: `docs/SUPABASE_DEV_REPORT_2026-10-20.md` (§10 desta data tem o detalhe técnico) e `supabase/dev_apply/` (a "caixa" pronta para aplicar).

---

## Status atual deste host (2026-10-21) — o que mudou / o que é humano

Fatos comprovados **nesta máquina** (Windows/WSL2), sem segredos expostos:

- **Rede:** o hostname `db.urdmpzjycwywsjzhpntc.supabase.co` **não resolve** aqui (DNS nativo e DoH sem IP utilizável — o host direto só publica AAAA). Mas o banco **chega**: o literal IPv6 `2600:1f18:5b28:201:cc5b:f484:b084:a267` (porta 5432) tem TCP aberto, e o pooler `aws-0-us-east-1.pooler.supabase.com` (IPv4) também. **Por isso o caminho confiável é `--db-url` + `RX_DEV_DB_IP`** (redirecionar o host para o literal), não o hostname.
- **Ferramenta Supabase MCP (`execute_sql` etc.):** ligada à **PRODUÇÃO** (`ardpabjoepzhkpmkgwgu`), não ao DEV. Logo, **não** pode ser usada para escrever no DEV (escreveria em produção = proibido). O apply no DEV sai só por **DSN Postgres** (`supabase db query --db-url` ou `psql`).
- **CLI Supabase / PAT:** **escopo de CONTA** (não "só produção" — conclusão anterior errada: o 404 era do ref `urdmpzjycwyvsjzhpntc`, que **não existe**). Com o ref correto `urdmpzjycwywsjzhpntc`: `supabase projects list` enxerga os 4 projetos da conta (DEV + PROD `ardpabjoepzhkpmkgwgu` etc.) e `supabase projects api-keys --project-ref urdmpzjycwywsjzhpntc` **funciona** (listagem; re-revela as chaves anon/service JWT). O que **permanece só no dashboard**: trocar a **senha do Postgres** e **rotacionar a chave secret** (`sb_secret_…`).
- **Parede atual (único bloqueio humano):** definir uma **senha NOVA** do Postgres do DEV no dashboard. A senha que circulou em conversa está **comprometida — não reutilizar** (rotação obrigatória). Os `PAM authentication failed`/ENOTFOUND anteriores tinham como causa raiz (a) o **ref inexistente** (`...vsjzhpntc`) e (b) a senha antiga. Com ref correto + senha nova, o resto (rede, kit de apply, `verify_dev.sql`, teste de multi-conta) está **pronto para um único comando**. Ver Passo 1 abaixo.

- **Kit reforçado (novo, 2026-10-21):** `apply_dev.sh` ganhou backend **Supabase CLI** (`RX_CLI=1`, sem `psql`), knob **`RX_DEV_DB_IP`** (troca o host pela literal preservando user/senha/porta/banco; **não imprime a senha**) e **`RX_PREFLIGHT=1`** (`SELECT 1` antes de qualquer DDL). E `test_multiaccount.sql` (reversível) valida a matriz de multi-conta **após** o apply.
- **Status 2026-10-21 (turno 4) — alternativas oficiais SEM senha esgotadas neste host:**
  - **pg-meta (o backend oficial do SQL Editor do dashboard) NÃO autentica com chaves de projeto:** `https://urdmpzjycwywsjzhpntc.supabase.co/pg-meta/query` → **404**; `https://api.supabase.com/v1/projects/urdmpzjycwywsjzhpntc/pg-meta/query` → **401** com as 7 combinações testadas (Bearer/apikey × anon, service_role, `sb_publishable_`, `sb_secret_`). A API da plataforma exige **sessão do dashboard/PAT**, não a chave do projeto.
  - **Navegadores sem sessão Supabase disponíveis:** a extensão Playwright no Chrome do usuário falhou 2× ("extension did not connect within 30s" — a extensão precisa estar instalada/habilitada no perfil **Default** do Chrome, com o token da missão); o navegador integrado do VS Code está **degradado** (CDP desconectado, 0 tabs); o Chrome do MCP chrome-devtools é instância **separada**, sem login.
  - **PAM rejeita qualquer senha** → o DEV **não tem senha de Postgres usável definida** (nem a que circulou em chat autentica; reenviá-la só faz sentido se ela tiver sido definida no dashboard recentemente).
  - **Dois caminhos mínimos (escolher um):** **(A)** corrigir a extensão Playwright no Chrome logado → o agente dirige o **SQL Editor oficial** do dashboard do DEV (respeita "não mexer na senha do Postgres"); **(B)** definir a **senha do Postgres do DEV** no dashboard (Settings → Database → Change password, ~30s — é *criação*, não rotação) → `RX_CLI=1 RX_DEV_DB_IP='2600:1f18:5b28:201:cc5b:f484:b084:a267' RX_PREFLIGHT=1 bash supabase/dev_apply/apply_dev.sh`.
  - O que **não depende de DEV e segue em paralelo**: release/PR/CI, SEO (`app/sitemap.ts`, `app/robots.ts`, canonical/www), auditoria de lançamento (workflow `wf_7d0ce66e-ec3`), migrations de **produção** (gate próprio: backup + rollback + aprovação; o MCP Supabase está preso à produção e é proibido usá-lo para escrever).

- **Status 2026-10-21 (turno 5) — kit de apply corrigido e validado em 2 "formas" de banco:**
  - **Bug crítico da 016 (corrigido):** a 005 cria o `UNIQUE(organization_id, provider)` **sem nome** → no Postgres o nome fica o autogerado `meta_integrations_organization_id_provider_key` (árvores limpas como a do DEV). A **produção** tem o mesmo unique **com nome explícito** `uq_meta_integrations_org_provider` (legado). A 016 antiga removia **um único nome** → em uma das duas formas o `DROP CONSTRAINT` virava **no-op silencioso** e o unique legado sobrevivia. A `016_multi_meta_accounts.sql` agora faz **double-drop** (cada um `IF EXISTS`) e cobre as duas formas.
  - **`016_rollback.sql` criado** (desfaz a 016: `DROP INDEX` autônomo dos índices de expressão, recria o unique legado via bloco `DO $$`, remove `display_name`). Validado: após rollback a forma B volta a ter `uq_meta_integrations_org_provider` funcionando.
  - **Dois bugs de sintaxe do kit corrigidos** (impediam o apply humano): (1) `002a_supabase_base.sql` etapa 19 — `RAISE EXCEPTION '...'` sem `;` final; (2) rollback antigo usava `ALTER TABLE ... DROP INDEX`, instrução **inexistente** no Postgres.
  - **Validação local em 2 formas (PASS):** `validate_016fix.sh` criou bancos descartáveis no Postgres local Docker (`rx_016fix_a` = forma DEV com nomes autogerados; `rx_016fix_b` = forma produção, renomeando o unique antes de rodar a 016). Em **ambas**: unique legado some; índices novos existem; `display_name` presente; matriz (2 contas coexistem / duplicado exato bloqueado / pending ok / isolamento entre orgs) passa; rollback restaura o estado legado. **Nunca** tocou `revolution_x`, DEV ou produção.
  - **Gate humano inalterado:** a única etapa humana continua sendo **definir a senha do Postgres do DEV no dashboard** (opção B, ~30s). Depois disso, um comando único (Passo 3, opção A) aplica a cadeia + verificações + teste de multi-conta, como single-writer.

---

## O que já está COMPROVADO (sem precisar de humano)

- **A "base" 001–004 NÃO está perdida.** A base do Supabase vive em `migrations/002_fase2_auth_multitenant_supabase.sql` (família A). Nada foi perdido; a sensação de "migração ausente" era um diagnóstico errado.
- **Bug encontrado e corrigido:** a etapa 19 do 002 estava invertida — `IF NOT EXISTS (public.users) THEN RAISE EXCEPTION` — o que **aborte um banco Supabase em estado limpo** (exatamente o caso do DEV). Corrigido para `IF EXISTS (...)`. A versão corrigida ficou em `supabase/dev_apply/002a_supabase_base.sql` (o arquivo original do usuário **não foi alterado**).
- **Cadeia completa testada em banco descartável** (`rx_devchain_validate`, criada e apagada no Postgres local `revolution-x-test-db-1`; **nunca** tocou `revolution_x`, DEV ou produção): `002a(base) → 005 → 015 → 016` roda limpo desde o zero, e a matriz de multi-conta passou:
  - 2 páginas Facebook (P1, P2) no mesmo org → **coexistem** ✅
  - duplicado exato (mesmo org/provider/página P1) → **bloqueado** por `uq_meta_integrations_account` ✅
  - linha PENDING (whatsapp, ids nulos) → **coexiste** ✅
  - mesma página P1 em **outro** org → **permitida** (isolamento por org) ✅
  - `UNIQUE(org,provider)` legado **removido**; 3 índices novos criados; RLS ON em `meta_integrations` ✅
- **Dois planos de dados, dois bancos diferentes (importante):**
  - **Prisma/PascalCase** → Postgres **local Docker** (`DATABASE_URL`, `:15432`, banco `revolution_x`), feito por `prisma db push`.
  - **Supabase/snake_case** → projeto **DEV** `urdmpz...`, feito por SQL (`createServiceRoleClient()`), usado pelos resolvers de Meta/TikTok.
  - Conclusão: **o DEV recebe SÓ SQL snake (002a+005+015+016). NUNCA `prisma db push` no DEV.** O `prisma db push` é somente para o Docker local.
- **§8 (testes locais) verde:** `tsc 0`, `eslint 0`, `jest 578/578 (44 suítes)`, `build clean`.
- **Modelo Prisma `MetaIntegration` (camel) está MORTO em runtime** (0 chamadas a `prisma.metaIntegration`). O `WebhookEvent` (camel) **vive** em `app/api/webhooks/inbound/route.ts:79` (plano Prisma local — bate com o banco local, não com o snake do DEV). Não precisa de mudança de código para o objetivo de multi-contas Meta; basta a regra operacional acima.

---

## O que está BLOQUEADO e por quê

O projeto DEV está **limpo** (schema `public` vazio; 0 usuários GoTrue). Para aplicar qualquer coisa a ele faltam passos **somente humanos**:

| Bloqueio | Motivo | Quem faz |
|---|---|---|
| **SENHA do Postgres do DEV nunca foi definida** | `supabase db query/push` falha com `PAM authentication failed for user "postgres"` — o banco não tem senha | **Humano (dashboard)** → abre TUDO |
| **Chaves do `.env.docker.test` ficaram velhas (401)** | As chaves antigas pararam de funcionar; o CLI consegue re-revelar | **Humano** (1 comando) |
| **Cadastro com confirmação de e-mail** | `mailer_autoconfirm=false` e **não há provedor de e-mail** no DEV | **Humano** (reversível) ou provedor de e-mail |

> ⚠️ **Aviso de vazamento (agir agora):** durante a inspeção, um parse com bug imprimiu **uma vez** as chaves anon+service_role do DEV e a `DATABASE_URL` pooler da **produção** (com senha) no rastro de um agente. **Rode a rotação:** (1) revoque/rotate a `service_role` do DEV; (2) troque a senha do pooler da produção. Trate esse rastro como sensível. Não re-imprimo os valores aqui.
>
> **Nota (2026-10-21, este host):** o PAT é **escopo de conta**: `supabase projects api-keys --project-ref urdmpzjycwywsjzhpntc` (ref correto) lista as chaves do DEV e re-revela as chaves JWT anon/service. O que é **só dashboard**: a **senha do Postgres** (Settings → Database → Change password) e a **rotação da chave secret** `sb_secret_…` (Project Settings → API → API Keys / Generate new key). A rotação da senha do pooler da produção é ação no projeto de produção — **não tocar em produção nesta missão**.

---

## SEQUÊNCIA PRÁTICA (iniciante)

### Passo 1 — Definir a senha do Postgres do DEV (dashboard)
1. Acesse a plataforma Supabase → projeto **`supabase-charcoal-lighthouse`** (ref `urdmpzjycwywsjzhpntc`). **Confirme que NÃO é "Revolution X" (a produção).**
2. Vá em **Project Settings → Database**.
3. Em **"Postgres password"** (ou "Reset database password"), defina uma senha nova e anote-a **fora do repositório** (ex.: seu cofre de senhas).
4. Teste a leitura. **Neste host** (`--project-ref`/`--linked` não conseguem resolver o host — DNS quebrado e CLI/PAT escopado à produção), use `--db-url` apontando para o literal IPv6 do banco:
   ```bash
   supabase db query --db-url 'postgresql://postgres.urdmpzjycwywsjzhpntc:<SENHA_DO_DEV>@2600:1f18:5b28:201:cc5b:f484:b084:a267:5432/postgres?sslmode=require' "SELECT 1;"
   ```
   → deve responder `1`. Se retornar `FATAL: PAM authentication failed`, a senha ainda não é a válida do DEV (redefina no passo 3 acima e aguarde a propagação, ~30s). O pooler IPv4 (`aws-0-us-east-1.pooler.supabase.com`) também está aberto, mas exige user `postgres.urdmpzjycwywsjzhpntc` e o tenant pode ainda não existir no Supavisor.

### Passo 2 — Atualizar as chaves do DEV (1 comando)
```bash
# Re-revela as chaves correntes do DEV e reescreve .env.docker.test (git-ignored).
supabase projects api-keys --project-ref urdmpzjycwywsjzhpntc --reveal
```
Deixe no `.env.docker.test` (NUNCA commitar): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

### Passo 3 — Aplicar a cadeia snake no DEV (single-writer)
Prepare a conexão **sem expor a senha em chat/log/commit** (senha do Passo 1). Escolha **um** backend:

**Opcão A — Supabase CLI (recomendada neste host, que não tem `psql`):**
```bash
export SUPABASE_DEV_DB_URL='postgresql://postgres.urdmpzjycwywsjzhpntc:<SENHA_DO_DEV>@db.urdmpzjycwywsjzhpntc.supabase.co:5432/postgres?sslmode=require'
export RX_CLI=1                              # usa `supabase db query --db-url` (sem psql)
export RX_DEV_DB_IP='2600:1f18:5b28:201:cc5b:f484:b084:a267'   # SÓ se o hostname não resolver (aqui: não resolve)
export RX_PREFLIGHT=1                        # SELECT 1 antes de qualquer DDL
bash supabase/dev_apply/apply_dev.sh
```

**Opcão B — psql via Docker (se houver `psql`):**
```bash
export PSQL_CMD="docker exec -i revolution-x-test-db-1 psql"
export SUPABASE_DEV_DB_URL='postgresql://postgres.urdmpzjycwywsjzhpntc:<SENHA_DO_DEV>@db.urdmpzjycwywsjzhpntc.supabase.co:5432/postgres'
bash supabase/dev_apply/apply_dev.sh
```

O script aplica **só o DEV**, na ordem `002a → 005 → 015 → 016`, com `ON_ERROR_STOP`, e aborta se a URL apontar para produção. `RX_DEV_DB_IP` troca o host pela literal (preservando user/senha/porta/banco) e **não imprime a senha**. No final roda `verify_dev.sql` (read-only) e mostra as 6 verificações.

> Se preferir sem script: aplique os 4 arquivos na ordem com o backend escolhido (ex. `supabase db query --db-url "$SUPABASE_DEV_DB_URL" -f arquivo` ou `psql -v ON_ERROR_STOP=1 "$SUPABASE_DEV_DB_URL" < arquivo`), rode `supabase/dev_apply/verify_dev.sql` e, só depois, `supabase/dev_apply/test_multiaccount.sql` (reversível) para provar a matriz de multi-conta.

### Passo 4 — Verificar (a `verify_dev.sql` já cobre)
- Tabelas `organizations`, `meta_integrations`, `webhook_events` existem;
- Colunas snake de `meta_integrations` (incluindo `display_name`, `provider`, `encrypted_access_token`);
- Índices `uq_meta_integrations_account`, `uq_meta_integrations_page`, `uq_webhook_events_meta_event_id`;
- `UNIQUE(org,provider)` legado **ausente**;
- **RLS ON** em `meta_integrations` (política de tenant por `app.current_org`);
- `auth.users` e `meta_integrations` vazias (DEV limpo).

### Passo 5 — Cadastro E2E (reversível, SÓ DEV)
> **Honestidade obrigatória:** autoconfirm **não prova** o fluxo real de confirmação por e-mail. Se usar autoconfirm, diga isso explicitamente.
1. **Anotar estado anterior** (para reverter): hoje `mailer_autoconfirm = false`.
2. Ligar **Auto Confirmation** no DEV: dashboard → **Authentication → Email providers** → ativar **Auto confirmation** (ou `PATCH` no settings do GoTrue, se disponível na versão).
3. Testar cadastro com e-mail **isolado** de teste: `POST /api/auth/register` (ex. `devtest.<n>@<dominio-teste>`) → deve criar o usuário **confiado** e seguir o login (não mais o 429 de e-mail).
4. Testar **login** com a senha dessa conta.
5. **Limpar:** excluir o usuário de teste pelo admin (`DELETE $DEV/auth/v1/admin/users/<id>` com service_role) — **só o que você criou**.
6. **Reverter** o Auto Confirmation para `false` (estado anterior) ou documentar se for manter.
7. Se a intenção for provar o fluxo **real** de e-mail, o passo seria configurar um **provedor SMTP** no DEV e **não** usar autoconfirm — isso é decisão humana/externa.

### Passo 6 — Matriz de multi-conta Meta contra o schema do DEV (§7)
Com o schema snake no ar, valide (usando linhas **mock/sandbox**, **sem** publicação/mensagem real):
1. Salvar **2 contas do mesmo provider no mesmo org** → deve aceitar;
2. **Duplicado exato** (mesma conta externa) → deve rejeitar (`uq_meta_integrations_account`);
3. **Escolha explícita** de conta nas APIs/UI (o resolver já tem âncora por id; a seleção por padrão é `connected_at desc`);
4. **Conta de outro org** rejeitada pelo backend (RLS/tenant);
5. **Cifra no repouso + nenhum token em resposta** (resolver lê via service_role; `encrypted_access_token` é AES-256-GCM);
6. Contas **expiradas/revogadas/sem permissão** (status `EXPIRED`/`REVOKED`).

> **Resíduo de segurança (documentado, não parte do objetivo Meta):** o token de acesso manual do **TikTok** + o refresh token ficam em **texto claro** no `AgentMemory` (`src/integrations/tiktok/resolveAccess.ts`). Não afeta a multi-conta Meta; registrar como follow-up.

---

## Regras de ouro (não pular)
- **NUNCA** aplicar nada à produção `ardpabjoepzhkpmkgwgu`; **NUNCA** rodar `supabase db pull` na produção.
- **NUNCA** `prisma db push` no DEV (somente no Docker local).
- Senha do banco **só** via prompt seguro/variável de ambiente — nunca em chat, log ou commit.
- **Single-writer**: cada escrita no banco, um único responsável, sequencial.
- Não frizar/afrouxar RLS, multi-tenant ou auth para testar.
- Não criar usuários em produção; remover **só** registros de teste que você criou no DEV.
