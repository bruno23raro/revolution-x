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

## ESTADO ATUAL (2026-10-18) — FASE 1 (backend + UI) concluída

- **PROMPT MESTRE real** (§1–§8, multi-canal IG/FB/WhatsApp/TikTok) recebido; a
  auditoria §3–§16 anterior era reconstrução inventada (corrigida). Correção de
  escopo: P2-1/P2-3 (ferramentas de dev) FORA; P2-2 "Sem API" (browser automation)
  EM ESCOPO como MÉTODO declarado c/ avisos de risco.
- **FASE 1 backend**: 7 rotas (`/api/integrations/{config,health,meta/refresh-token}`,
  `/api/whatsapp/{send,templates,chatbot}`, `/api/webhooks/inbound`) + serviços
  `src/integrations/*` (registry `providers.ts`, chatbot `evaluateChatbot`, mass-send,
  templates, config em AgentMemory c/ RLS).
- **FASE 1 UI** (commit `ea70496`): `/integrations` (2 seções visuais
  **API Oficial** roxo / **Sem API·Avançado** âmbar + `RiskBanner`, form "Integrar"
  genérico, health check, refresh de token, status real da Meta) + `/whatsapp`
  (disparo em massa, templates oficiais, chatbot configurável, card "Sem API" de
  extração de contatos declarado) + `GET /api/auth/meta` (início do OAuth da Meta,
  complementa o callback; degrada 503 honesto quando `META_*` ausentes).
  Primitivas compartilhadas: `ApiBadge` / `RiskBanner` / `HealthPill`.
- **Testes**: jest **22 suítes / 288 testes PASS**; `tsc` 0 erros; build verde.
- **Dependência [HUMANO] (P0)**: `META_APP_ID/SECRET`, `EMAIL_*` (Resend) e
  `OMNIROUTER_*` ainda no hpanel do Hostinger — a UI degrada de forma honesta
  (503) até serem preenchidas; nenhum segredo em localStorage.
- Docs `PROJECT_REQUIREMENTS_MATRIX.md` §E + `MASTER_PROJECT_AUDIT.md` atualizados.
- **Próximo passo autônomo: FASE 2** (canais IG/FB/TikTok: login + agendamento via
  API oficial, automações IG, agendamento FB + Marketplace, TikTok post).

## ESTADO ANTIGO (2026-10-15)

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
