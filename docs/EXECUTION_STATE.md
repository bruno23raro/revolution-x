# EXECUTION STATE — REVOLUTION X (missão final, 2026-10-15)

> Estado canônico do trabalho contínuo. Atualizar ao final de cada etapa
> significativa e antes de qualquer interrupção (regra §6 da missão).

## Etapa atual

FASE A concluída e verificada (140/140 → depois 185/185); FASE B
(revalidação RLS via suítes reais) concluída; **FASE D concluída —
migration 014 APLICADA EM PRODUÇÃO e comprovada por query**;
**FASE C CONCLUÍDA — G1 (34 testes admin) + G3 (claim atômico de
idempotência) + migration 015 APLICADA E COMPROVADA EM PRODUÇÃO**
(`uq_webhook_events_meta_event_id` presente em `pg_index`, 0 linhas,
destino verificado = projeto linked `ardpabjoepzhkpmkgwgu` "Revolution X").
Detalhes: `docs/STAGING_ROLLOUT_PLAN.md` §015 + `docs/EXECUTION_LOG.md`.
Em seguida: FASE F (preview), G (matriz), H (release: commits + deploy +
smoke pós-deploy).

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
- [ ] **G — Matriz de requisitos**: `PROJECT_REQUIREMENTS_MATRIX.md`
  criado (esboço 2026-10-15) — preencher estados após C/F/H.
- [ ] **H — Release**: validações (done em A), scan de segredos, commits
  (com `Co-Authored-By: Claude Code`), push, **deploy do build com FASE
  AGENT** (hoje produção não tem as rotas admin), post-deploy smoke
  (`GET /api/admin/tasks` admin → 200 `[]`; sem sessão → 401;
  `GET /api/admin/chat` → `routerConfigured` honesto).

## Bloqueios ativos

| Bloqueio | Dependência | O que já foi preparado |
| --- | --- | --- |
| Rotação da senha do banco Supabase (exposta 14/10) | Dashboard Supabase (usuário) | Passos exatos em `PROJECT_HANDOFF.md` |
| Credenciais Meta/Resend/OmniRouter | Usuário fornece | Nomes de variáveis canônicos documentados |
| claude-mem observer deslogado (~7 dias) | `/login` no Claude Code (usuário) | Diagnóstico registrado no log |
| Smoke admin em produção (FASE H) | Deploy + login admin (usuário) | Rotas criadas e testadas localmente; build 39 pág. |

## Próximo comando lógico

FASE F: dev server + navegador integrado (VS Code) — `/`, `/login`,
`/dashboard`, CRM, `/admin/chat`, `/onboarding/*` com captura de
evidência real (console/HTTP); em páginas de auth, indicar ao usuário
exatamente onde autenticar e aguardar login. Depois FASE G (matriz) e
FASE H (validação + scan de segredos + commits com
`Co-Authored-By: Claude Code` + push + deploy + smoke pós-deploy).
