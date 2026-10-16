# PROJECT HANDOFF — REVOLUTION X

> Instruções para retomar o trabalho em uma nova sessão (ou por outra IA).

## Primeiro, sempre

1. Ler `CLAUDE.md` (regras de autonomia + limites de segurança — OBRIGATÓRIOS).
2. Ler `docs/EXECUTION_STATE.md` (fase atual + bloqueios + próximo comando lógico).
3. Ler `docs/EXECUTION_LOG.md` (histórico cronológico de ações/resultados).
4. Rodar `git status` + `git log --oneline -5` e conferir com o checkpoint acima.
5. Rodar `npm test` e `npm run typecheck` para re-validar a base.

## Estado de referência (2026-10-15, pós-release)

- Git `main @ ccd88c3` — 7 commits (5 da missão + `8d84786` docs da
  FASE H + `ccd88c3` fix/ui com favicon `app/icon.svg`); `origin/main`
  sincronizado (push final `8d84786..ccd88c3`).
- jest 18 suítes / 185 testes PASS; tsc 0; build 39 páginas; next lint 0.
- 007/008/009/014/015 **em produção** (41/41 + 10/10 validados staging-first;
  015 = índice único `uq_webhook_events_meta_event_id`, comprovado em `pg_index`).
- **FASE AGENT no ar no Hostinger** (git integration do hpanel detectou o
  push): `GET /api/admin/chat` → 200 `{"routerConfigured":false}` (honesto,
  sem `OMNIROUTER_*` no servidor); `GET /api/admin/tasks` → 401 sem sessão.
- Briefing completo: `docs/BRIEFING_ANALISE_PROJETO.md`.

## Passos para intervenções humanas (quando o fluxo parar)

### 1. Rotação da senha do banco de produção (Supabase)

A senha do banco (role de conexão `postgres`) foi exposta acidentalmente em 2026-10-14
(saída de comando no terminal). Procedimento:

1. Dashboard Supabase (projeto de produção) → **Settings → Database → Change Database Password**.
2. Gerar senha forte; atualizar `DATABASE_URL` e `DIRECT_URL` no env do servidor Hostinger
   e nos `.env` locais (não versionar os novos valores).
3. Testar: app continua funcionando (`GET /` 200; login funciona) — o app usa
   `postgres`/`BYPASSRLS`, então a rotação não afeta o RLS.
4. (Opcional) Validar que a senha antiga falhou antes da rotação não é mais possível
   post-rotação — registrar no log a hora da rotação.

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
~90 s (`/icon.svg` 404 → 200). O CI do GitHub é apenas gate de
build+test, **não** faz deploy. Migrations de schema seguem por
`supabase db query --linked` (banco separado do app).

## Regras que NUNCA são passadas

- Sem DDL/DELETE/reset em produção sem verificação de identidade do destino.
- Sem usar credenciais de produção como fallback de teste.
- Sem expor segredos em logs/diffs/comits.
- Commits terminam com `Co-Authored-By: Claude Code <noreply@anthropic.com>`.
