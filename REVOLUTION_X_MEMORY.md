# REVOLUTION X — MEMÓRIA PERSISTENTE

## PALAVRA-CHAVE DE RECUPERAÇÃO

REVOLVER

## REGRA PRINCIPAL

Checkpoint persistente. Não inventar. Não expor secrets.

## COMO RETOMAR

1. Ler `CLAUDE.md` (regras de autonomia + limites de segurança).
2. Ler `docs/EXECUTION_STATE.md` (fase atual, bloqueios, próximo passo).
3. Ler `docs/EXECUTION_LOG.md` (histórico cronológico).
4. `git status` + `git log --oneline -5` e conferir o checkpoint abaixo.
5. `npm test` + `npm run typecheck` para re-validar a base.

## ESTADO ATUAL (2026-10-15)

- **Auth Supabase: FUNCIONAL** (registro/login/reset). O estado antigo de
  "GoTrue 500" está SUPERADO — a falha histórica de `auth.users` foi
  superada pela criação de `public."User"` + `Organization` +
  `OrganizationMember` no registro (commit `adc4c2b`) e pelo fluxo
  completo de Mission 5g/6.
- **Testes**: jest **15 suítes / 135 testes PASS** (base anterior à
  expansão de `roots` para `app/`); `tsc` 0 erros; build **37 páginas**.
- **RLS**: 007/008/009 **em produção** desde 2026-10-15 (staging-first,
  41/41; snapshot de rollback em `backups/rls-*-007-009_*.json`).
- **Migration 014** (FASE AGENT: Task/TaskStep/TaskEvent/AgentMemory):
  validada staging-first **10/10**; promoção a produção **AUTORIZADA**
  pela missão de 2026-10-15 (gated: verificar identidade do destino,
  pré-requisitos 005–009 e rollback antes de executar).
- **Segurança (Mission 5g)**: 21 testes de segurança + 4 rotas de auth
  implementadas; `generateState` agora CSPRNG; `dotenv` declarado.
- **Credencial de banco**: a senha do banco Supabase (role `postgres`)
  exposta em 2026-10-14 — **ROTAÇÃO CONCLUÍDA 2026-10-17** (hpanel ✅ +
  `.env.local` ✅ + re-deploy CONFIRMADO [Concluído, commit `77a9696`,
  smoke público 200] + alvo (c) GitHub = N/A [repo sem secrets, decisão:
  não criar segredo]). Resta só o probe admin `GET /api/admin/tasks` em
  produção — `docs/PROJECT_HANDOFF.md` item 1 / `docs/EXECUTION_LOG.md`.

## PENDÊNCIAS (2026-10-15)

1. **Rotação da senha do banco de produção** — **CONCLUÍDA 2026-10-17**
   (hpanel + `.env.local` + re-deploy CONFIRMADO [`77a9696`]; alvo (c)
   GitHub = N/A, repo sem secrets). **Resta só**: probe admin
   `GET /api/admin/tasks` → 200 `{count:0}` em produção (sessão admin).
2. **Migration 014 em produção** — executar após verificação do destino
   (procedimento em `docs/STAGING_ROLLOUT_PLAN.md` §FASE AGENT +
   `docs/EXECUTION_STATE.md`).
3. **Credenciais ausentes em produção** (usuário fornece, sem passar
   pelo chat): `META_APP_ID`/`META_APP_SECRET`/`META_WEBHOOK_VERIFY_TOKEN`,
   `EMAIL_PROVIDER=resend` + `EMAIL_API_KEY` + `EMAIL_FROM` (domínio
   verificado), `OMNIROUTER_BASE_URL` + `OMNIROUTER_API_KEY`
   (alternativa `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN`).
4. **Testes das rotas `/api/admin/*`** (G1) e **guard de idempotência
   do webhook Meta** (`Message.externalId`, G3) — fases C da missão.
5. **claude-mem**: observer deslogado desde 2026-10-08 — rodar
   `/login` no Claude Code para restaurar a memória entre sessões.
