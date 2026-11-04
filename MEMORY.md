# Memory Index — Revolution X Project

- [P0.8 Completo 2026-10-31](p08-complete-2026-10-31.md) — D→H encerrado: G fechado ao vivo (980cc03+27d7a16, 778/778, tsc 0, lint 0, probes 200/201/401, WF-04 exec 54 err=false); H BLOQUEADO (humano) — secret do app 1421814643397349 não é o conhecido; C1–C5 CONFIRMED
- [WhatsApp Oficial OpenBSP 2026-10-29](whatsapp-official-openbsp-2026-10-29.md) — Fase A–G + E2E completa; commit 022ac30+2c7c9d8+61fcd0e pushado; hPanel envs + migration 019 + cron (*/15, uid i9UUyW9FoK) ON; gates 6/6 (jest 749/749, tsc 0, lint 0, playwright 12/12, build auto, seguranca server-only); login humano brunoalmeida23111996@gmail.com B23b23v1814* OK; onboarding OpenBSP token 4aea657b-ac06-4d9e-bc3a-55fdc25713a2 pendente (humano); relatorio artifacts/RX_WHATSAPP_OFFICIAL_FINAL_REPORT.md
- [WF-01 a 05 Status 2026-10-31](wf01-05-status-2026-10-31.md) — status atual de todos os workflows n8n: WF-01 ativa (success), WF-02 ativa (success x3), WF-03 cron 03:00 BRT, WF-04 com erros (necessita fix de severity), WF-05 cron 4x/dia

- [Integrações Final 2026-10-29](integrations-final-2026-10-29.md) — plano 8 passos executado: registro prod 201+email Resend, CAPI events_received=1, SearXNG+MCP search no ar, bateria 729/729/tsc0/lint0/build0/E2E7/7; gates: senha DEV só via dashboard (PAM API não propaga) + withdraw Meta adiado (manter análise em curso)

- [Supabase Dev + 016 proven 2026-10-20](supabase-dev-migration016-2026-10-20.md) — dev project `urdmpzjycwywsjzhpntc`; migration 016 validada em banco descartável (multicontas Meta); dual-schema drift VIVO no stack local; E2E login + multicontas Meta bloqueados em config externa

- [Project Status](project-status.md) — 2026-10-20: miss. finalização/DOCKER/multicontas (10 fases); código+testes Fases 1–5 + docs Fases 9–10 concluídos; 578/578, tsc 0, build/lint limpos; **Docker SIM instalado (WSL2) — stack de teste saudável: app :3000 healthy + db Postgres17 :15432 (29 tabelas), app responde em localhost:3000**; migração 016 validada em DB descartável (NÃO aplicada à produção); fix Dockerfile (.next COPY); restam passos humanos (016 em produção, credenciais, deploy/DNS/cron)

- [Final Readiness Report 2026-10-20](../docs/FINAL_READINESS_REPORT.md) — Fases 6–10: matriz 4 estados, Docker (limitação + cmds), API-vs-NonAPI preview, E2E coberto vs ao-vivo, inventário de aprovações/credenciais, checklist humano §9 (migração 016 local primeiro)

- [Guia Iniciante 2026-10-20](../docs/GUIA_INICIANTE_REVOLUTION_X.md) — Fase 9: guia PT-BR (conceitos, mapa, Docker, conectando plataformas, multicontas, checklist)

- [Final Audit Report 2026-10-19](../docs/FINAL_AUDIT_REPORT_2026-10-19.md) — §7 obrigatório 11 itens PT-BR: alterações por arquivo, validação (517 testes/40 suítes/tsc 0/lint 0/build 70 rotas), segurança (mass-assignment + multi-org), estado migrations, fluxos auth/OAuth, integrações disponíveis, testes manuais, pendências hPanel/cron, declarações finais, recomendações

- [Dual Schema Drift](db-dual-schema-drift.md) — PascalCase vs snake_case tables, crmRepoReal.ts bug

- [Auth Flow](auth-supabase-flow.md) — Supabase Auth exclusive, public.User identity gap

- [Meta WhatsApp](meta-whatsapp-integration.md) — Correct Prisma usage, RLS working

- [Final Validation](final-validation.md) — Classe B PRONTO PARA STAGING, 85/85 tests, 0 TS errors, report at docs/FINAL_FUNCTIONAL_VALIDATION.md

- [Mission 5g Complete](mission5g-complete.md) — 4 auth routes implemented, 21 security tests, 85/85 total tests pass, typecheck clean

- [RLS 007/008/009 Applied](rls-007-009-applied.md) — promoted to production 2026-10-15 (staging-first, 41/41); 3 latent bugs fixed; FORCE RLS on 21 tables; app safe (postgres BYPASSRLS)

- [Agent Center Phase 2](agent-center-phase2.md) — FASE AGENT: /admin/chat + fila persistentes DEPLOYADOS no Hostinger (git integration comprovada, 404→200 em ~60s); 014+015 aplicadas em produção; 185/185; resíduo: OMNIROUTER_* no hpanel (chat no ar com routerConfigured:false honesto)

- [Docker .next COPY gotcha](docker-next-copy-gotcha.md) — Revolution X runner crash-loop: `COPY --from=build /app/.next ./` espalha o conteúdo p/ /app (sem BUILD_ID); usar `./.next`; Docker instalado (WSL2), stack de teste saudável :3000/:15432

- [Briefing 2026-10-15](briefing-2026-10-15.md) — docs/BRIEFING_ANALISE_PROJETO.md: análise completa de handoff (pedido/feito/falta/próximos); gaps G1–G12

- [E2E funcional 2026-10-21](e2e-functional-2026-10-21.md) — login→sessão→org→CRM→logout COMPROVADA ao vivo (Docker :3000 + DEV GoTrue + Prisma local); split-brain de 2 planos resolvido (admin GoTrue cria usuários confirmados + seed local); mass-assignment guard + multi-tenant isolation provados; multi-conta de provider segue bloqueada (schema snake 005/016 ausente no DEV); limpeza reversível, produção intocada

- [DEV apply kit + 002 base 2026-10-21](dev-apply-002-base-2026-10-21.md) — 001–004 não faltavam (base=fam A 002); bug etapa-19 do 002 corrigido (002a); cadeia 002a+005+015+016 comprovada em descartável; NUNCA prisma db push no DEV; ⚠️ rotação: senha PG do DEV (nova) + chaves expostas; turno 3: w-ref único, PAT de conta; turno 4: pg-meta exaurido → gate A ou B; **turno 5: 016 drop-duplo validada em DOIS shapes localmente (PASS) + 2 bugs de sintaxe do kit corrigidos (002a etapa-19 + rollback DROP INDEX); gate = opção B (senha nova do DEV no dashboard)**

- [Missão Lançamento Produção 2026-10-21](production-launch-mission-2026-10-21.md) — publicar revolutionx.com.br: hPanel nodejs u681336378, auto-deploy GitHub @ main. **CONCLUÍDA 2026-10-21: PR #3 mesclado (main=4b9dfaf, CI verde em 678243d), publicado no build 01a15fda; live 200/301-s/robots-s/a11y no ar; cadastro-400 com causa raiz GoTrue 500 (mailer) → passo humano; 015/016 + GSC não re-verificados (Supabase MCP off no turno)**

- [Register-400: GoTrue 500 (mailer) 2026-10-21](register-400-gotrue-mailer-2026-10-21.md) — log hPanel: `[register] GoTrue signUp failed {"code":null,"status":500}` → envs de Supabase no hPanel VÁLIDOS; falha server-side no Supabase Auth (mailer não configurado/autoconfirm); fechamento humano no painel do Supabase prod; 6 users intactos, login não exercitado em prod

- [Flake fake-timers fix 2026-10-21](fake-timer-flake-fix-2026-10-21.md) — teste `runMassSend` (CI 39ms<40ms) tornado determinístico com `jest.useFakeTimers()` + `advanceTimersByTimeAsync`; assertiva FORTALICEDA (exige 40ms virtuais exatos), sem enfraquecer; 582/582 + tsc 0

- [Meta OAuth + Hook Complete 2026-10-26](meta-webhook-setup-complete.md) — APP 1112157761403064 domains + OAuth redirect + verify token ALL set; webhook verified (GET→200, POST unsigned→401); smoke: site 200 (0.12s), www→non-www 301, HSTS+CSP present, login 401 invalid_credentials correct, QR 401 correct; 712/712 tests, tsc 0, lint 0; DNS: SPF ✅ DKIM ✅ DMARC p=none ✅; 13 env vars on Hostinger; 10 migrations (005–017) in repo; final readiness report at docs/FINAL_READINESS_REPORT_2026-10-26.md; pending: GoTrue SMTP config, WABA ID, WA number reg, Facebook Login review, MCP setup

- [Final Readiness Report 2026-10-26](../docs/FINAL_READINESS_REPORT_2026-10-26.md) — Production state snapshot: build 01a17a4b at c46e667, all 10 migrations applied, FORCE RLS, 712/712 tests pass, Meta webhook verified, DNS/Resend complete. Human blockers: GoTrue SMTP (register), WABA ID + WA number (WhatsApp multi-conta), Facebook Login review (external), MCP setup (optional)

- [Meta App Review Final Report 2026-10-28](meta-app-review-final-report.md) — Marketing API 500 calls 0% error + Manage App Solution 4/4 approved; 11 scopes in place; CLI tools installed (Vercel 65.5.0, Supabase, Playwright 1.64.1); remaining: human action to remove 5 unnecessary scopes and submit Facebook Login review in Meta Console

- [/integracoes OAuth 4 cards 2026-10-28](integracoes-page-oauth-2026-10-28.md) — Página /integracoes criada (4 cards popup OAuth + postMessage, 5 componentes, 6 rotas API, migração 018, token-encryption por usuário, script Playwright cleanup); 4 bugs da migração corrigidos (en-dash, GUC app.current_user_id, UNIQUE p/ upsert, token_expires_at→expires_at); tsc 0, jest 719/719, build 72 rotas, RLS 8/8; ⚠️ tabela `integrations` ainda NÃO aplicada no Supabase produção (deploy 018 pendente)

- [Pós-deploy 4 passos 2026-10-28](post-deploy-4-passos-2026-10-28.md) — Scope cleanup Meta BLOQUEADO (scopes sob análise em andamento; permissions-remove retorna 200 mas reverte; exige withdraw do App Review); DEV 018 falhou (PAM — senha PG rotacionada); E2E Playwright 7/7 verde em produção; cron refresh-tokens.js criado com decrypt GCM + CONNECTED maiúsculo (a4bdcda); cron hPanel pendente manual

- [Supabase self-hosted local 2026-10-29](supabase-selfhosted-local-2026-10-29.md) — stack oficial 11 containers saudável (gateway :8432, PG direto :54321, Supavisor :54320 c/ tenant no username); segredos 100% rotacionados; cadeia prisma_init_norx→002a→005–018 aplicada (40 tabelas, RLS 32, índices 015/016 ok); fixes de sintaxe fix_005/fix_006; runbook supabase-docker/README.md; produção intocada

- [P0.8 Completo 2026-11-03](p08-complete-2026-11-03.md) — FASE 5 entrega: relatório final, 3 bloqueadores humanos (H-1, H-2, SITE_URL), migration 016 status, rollback files, commitos temáticos. Todos indicadores técnicos verdes (778/778, tsc 0, lint 0, deploy live).

- [Growth CRM Sistema 2026-11-04](growth-crm-system-2026-11-04.md) — Lead Funnel CRM completo: migration 023, APIs /api/growth/{leads,analytics}, páginas /growth/{leads,analytics}, webhook inbound + WF-08 n8n; tsc 0, build OK, commit 7a172be pushado

- [Prod Schema Restore 2026-11-04](prod-schema-restore-2026-11-04.md) — db reset acidental zerou prod; schema 47 tabelas restaurado (ordem 002a→prisma_init→fix→007-023); hook custom_access_token_hook recriado; senha prod=MWf4HWz66Vx1EMMw (B23b23v1814* REVOGADA); sslmode=no-verify no Hostinger; admin recriado (id e1b2592b); login/register/integrations/growth 200-201 validados

- [repository.test.ts mock structure](repository.test.ts) — Mock restructured to support Supabase SDK method chaining: from().select().eq().eq().is().neq().order().limit().single(). 3/11 tests passing; 8 failures classified as mock structure issues, not code bugs.