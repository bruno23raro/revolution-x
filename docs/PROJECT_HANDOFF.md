# PROJECT HANDOFF — REVOLUTION X

> Instruções para retomar o trabalho em uma nova sessão (ou por outra IA).

## Primeiro, sempre

1. Ler `CLAUDE.md` (regras de autonomia + limites de segurança — OBRIGATÓRIOS).
2. Ler `docs/EXECUTION_STATE.md` (fase atual + bloqueios + próximo comando lógico).
3. Ler `docs/EXECUTION_LOG.md` (histórico cronológico de ações/resultados).
4. Rodar `git status` + `git log --oneline -5` e conferir com o checkpoint acima.
5. Rodar `npm test` e `npm run typecheck` para re-validar a base.

## Estado de referência (2026-10-16, pós-FASE I)

- Git `main @ 2d9136d` — 9 commits da missão (`5918263` … `902d25b`
  mais `2d9136d` CI provisionamento); `origin/main` sincronizado.
- **Repositório `bruno23raro/revolution-x` agora PÚBLICO**
  (`private:false` confirmado via API em 2026-10-16). Runs do CI são
  verificáveis anonimamente.
- **CI VERDE**: Actions run `38973999041` (head `2d9136d`) = success em
  todos os passos (provision do Postgres de teste, Typecheck, Lint,
  Test, Build). O workflow usa service `postgres:17` descartável +
  `scripts/provision-ci-test-db.mjs` (014) — nenhuma suíte de
  integração roda contra produção.
- jest 18 suítes / 185 testes PASS; tsc 0; build 39 páginas; next lint 0.
- 007/008/009/014/015 **em produção** (41/41 + 10/10 validados
  staging-first; 015 = índice único `uq_webhook_events_meta_event_id`).
- **FASE AGENT no ar no Hostinger** (git integration do hpanel):
  `GET /api/admin/chat` → 200 `{"routerConfigured":false}` (honesto,
  sem `OMNIROUTER_*`); `GET /api/admin/tasks` → 401 sem sessão.
- **ATENÇÃO — refs locais com segredos**: `refs/stash` e
  `refs/agents/.../checkpoints/turn/*` (commit `fe69880`) contêm
  **senhas reais do banco Supabase** que **NUNCA** foram publicadas.
  Nunca empurrar esses refs ao GitHub (`git push origin main` continua
  seguro — só `main` deve ser publicada).
- Briefing completo: `docs/BRIEFING_ANALISE_PROJETO.md`.

## Passos para intervenções humanas (quando o fluxo parar)

### 1. Rotação da senha do banco de produção (Supabase)

**STATUS 2026-10-17 — CONCLUÍDA até o limite autônomo:**

- **(a) hpanel ✅**: `DATABASE_URL` + `DIRECT_URL` na nova senha
  (40 chars hex, valor não versionado — §6), **persistência verificada**.
  Senha antiga revogada no Supabase.
- **(b) `.env.local` ✅**: `DATABASE_URL`/`DIRECT_URL` já na nova senha
  (topologia pooler); `TEST_*` intocados.
- **Re-deploy disparado ✅**: `git push origin main` → git integration do
  hpanel (~1-2 min) re-injeta o `.env` do hpanel no processo em produção.
- **RESTA [HUMANO/UI]**: **(c) secrets do GitHub** `DATABASE_URL`
  (e `DIRECT_URL`, se houver) na UI — mesma nova senha; e o **probe final**
  `GET /api/admin/tasks` com sessão admin → 200 `{count:0}` em produção.

A senha do banco (role de conexão `postgres`) foi exposta acidentalmente em
2026-10-14 (saída de comando no terminal) e, com o repositório tornado
público em 2026-10-16, os identificadores do projeto (ref Supabase
`ardpabjoepzhkpmkgwgu`, host do pooler) também ficaram públicos — isso
aumenta a prioridade da rotação. Procedimento original:

1. Dashboard Supabase → projeto `ardpabjoepzhkpmkgwgu`
   ("Revolution X", sa-east-1) → **Settings → Database →
   Change Database Password**.
2. Gerar senha forte; atualizar `DATABASE_URL` e `DIRECT_URL` em
   **3 alvos**: (a) env do servidor Hostinger (hpanel), (b) `.env.local`
   local, (c) **GitHub → repo `revolution-x` → Settings → Secrets and
   variables → Actions** (o segredo `DATABASE_URL` usado pelo CI, se
   existir). Não versionar os novos valores.
3. Testar: app continua funcionando (`GET /` 200; login funciona) — o
   app usa `postgres`/`BYPASSRLS`, então a rotação não afeta o RLS.
4. Registrar no log a hora da rotação (a senha antiga não pode ser
   revalidada depois).

### 2. Credenciais Meta / Resend / OmniRouter (env do servidor Hostinger)

- Meta: `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`
  (+ webhook URL `https://revolutionx.com.br/api/webhooks/meta` configurada no app Meta).
- Resend: `EMAIL_PROVIDER=resend`, `EMAIL_API_KEY` (chave `re_...`),
  `EMAIL_FROM="Revolution X <endereco@dominio>"` (domínio verificado no Resend).
- Roteador de IA: `OMNIROUTER_BASE_URL` + `OMNIROUTER_API_KEY`
  (ou `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN`).
Após definir: `GET /api/admin/chat` → `{"routerConfigured":true,...}`.

### 3. claude-mem (memória entre sessões)

Observer deslogado desde 2026-10-08. Correção: rodar `/login` no Claude Code
(não reiniciar o worker). A memória de fallback (esta pasta `docs/` +
`REVOLUTION_X_MEMORY.md` + memory dir) continua funcionando independentemente.

### 4. Deploy (mecanismo confirmado 2026-10-15 — nada a fazer)

O hpanel do Hostinger tem **Git integration** conectada a
`bruno23raro/revolution-x` (branch `main`): `git push origin main` →
clona, roda build, sobe em ~1-2 min. Comprovado nesta missão: o push
`8d84786` colocou a build da FASE AGENT no ar (baseline `/api/admin/chat`
404 → 200 `routerConfigured:false`); `ccd88c3` (favicon) re-deployou em
~90 s (`/icon.svg` 404 → 200). O CI do GitHub roda **build+test+integração** e **não** faz deploy.
Desde `2d9136d` (2026-10-16) ele provisiona um Postgres `17`
descartável (service do GitHub Actions) + role `revx_test` +
migrations 008/014 — as 5 suítes de integração rodam nesse banco,
nunca contra produção; run de referência verde: `38973999041`. Com o
repo **público**, os runs são verificáveis anonimamente em
`github.com/bruno23raro/revolution-x/actions`. Migrations de schema
seguem por `supabase db query --linked` (banco separado do app).

## Regras que NUNCA são passadas

- Sem DDL/DELETE/reset em produção sem verificação de identidade do destino.
- Sem usar credenciais de produção como fallback de teste.
- Sem expor segredos em logs/diffs/comits.
- Commits terminam com `Co-Authored-By: Claude Code <noreply@anthropic.com>`.
