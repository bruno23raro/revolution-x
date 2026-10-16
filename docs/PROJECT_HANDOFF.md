# PROJECT HANDOFF — REVOLUTION X

> Instruções para retomar o trabalho em uma nova sessão (ou por outra IA).

## Primeiro, sempre

1. Ler `CLAUDE.md` (regras de autonomia + limites de segurança — OBRIGATÓRIOS).
2. Ler `docs/EXECUTION_STATE.md` (fase atual + bloqueios + próximo comando lógico).
3. Ler `docs/EXECUTION_LOG.md` (histórico cronológico de ações/resultados).
4. Rodar `git status` + `git log --oneline -5` e conferir com o checkpoint acima.
5. Rodar `npm test` e `npm run typecheck` para re-validar a base.

## Estado de referência (2026-10-15)

- Git `main @ 58491e6` (sincronizado com origin/main) + trabalho local não commitado
  (FASE AGENT inteira + correções de 007/008/009 + FASE A desta missão).
- jest 15 suítes / 135 testes PASS (antes da expansão de `roots`); tsc 0 erros; build 37 páginas.
- 007/008/009 (RLS) **em produção** desde 2026-10-15 (41/41 validado; snapshot em `backups/`).
- 014 (FASE AGENT) validada staging-first (10/10); **promoção a produção autorizada**
  (missão de 2026-10-15) — ver FASE D em `EXECUTION_STATE.md`.
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

## Regras que NUNCA são passadas

- Sem DDL/DELETE/reset em produção sem verificação de identidade do destino.
- Sem usar credenciais de produção como fallback de teste.
- Sem expor segredos em logs/diffs/comits.
- Commits terminam com `Co-Authored-By: Claude Code <noreply@anthropic.com>`.
