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

## ESTADO ATUAL (2026-10-18) — FASE 2 · slices 1–3 (Instagram + Facebook + TikTok) e FASE 3 · slice 1 (tracking de anúncios) concluídas

- **FASE 2, slice 1 (Instagram, API oficial):** serviço
  `src/integrations/meta/instagramPublisher.ts` (2 passos: `POST /{ig}/media` →
  `containerId`, `POST /{ig}/media_publish?creation_ids=` → `mediaId`;
  `scheduled_start_time` em UNIX s, 10 min–75 d; **não lança**, devolve
  `ok`/`error`). Resolver adicionativo
  `resolveTenantPublisherAccess(organizationId)` em `resolveAccess.ts` (não
  tocou a de WhatsApp). Rota `POST /api/instagram/publish` (401/400/409/503/502).
  UI `app/instagram/page.tsx` (lilás/preto/branco: conexão real,
  publicar/agendar, "Sem API/Avançado" declarado c/ `RiskBanner`) + link
  **Instagram** no AppNav admin.
- **FASE 2, slice 2 (Facebook, API oficial):** serviço
  `src/integrations/meta/facebookPublisher.ts` (1 chamada `POST /{page-id}/feed`,
  `message`|`link`; agendamento via `published=false` + `scheduled_publish_time`
  (UNIX s, 10 min–75 d) + `unpublished_content_type=SCHEDULED`; permissão
  `pages_manage_posts`; **não lança**). Resolver adicionativo
  `resolveTenantFacebookPageAccess(organizationId)` em `resolveAccess.ts` (lê
  `meta_page_id`). Rota `POST /api/facebook/publish` (401/400/409 `no_fb_page`/503/502).
  UI `app/facebook/page.tsx` (publicar/agendar + card "Sem API/Avançado" de
  Marketplace/grupos — Meta **não expõe** isso pela API oficial; provider
  `browser_automation` c/ `RiskBanner`) + link **Facebook** no AppNav admin.
- **FASE 2, slice 3 (TikTok, API oficial):** serviço
  `src/integrations/tiktok/tiktokPublisher.ts` (publicação **imediata** em 1
  chamada `POST /v2/post/publish/video/init/`, `source=PULL_FROM_URL` +
  `video_url` → `publish_id`; a API **não tem** `scheduled_start_time` —
  agendamento persiste a **intenção** em `pending:tiktok_posts` no
  AgentMemory; **não lança**). Tracking: `getTikTokPostStatus`
  (`/status/fetch/`) e `getTikTokVideoAnalytics`
  (`GET /video/data/?publish_ids=[…]`, máx. 5, array JSON de strings).
  Resolver `resolveTenantTikTokAccess` lê `integration:tiktok` do
  AgentMemory/Prisma (provider `tiktok`: `clientKey`/`clientSecret`/
  `accessToken`, s/ OAuth; degrada `not_connected`/`no_token`/
  `queue_unavailable`). Rotas `POST /api/tiktok/publish` (agora →
  `publishId`; `scheduledAt` → intenção) + `GET /api/tiktok/status` +
  `GET /api/tiktok/analytics`. UI `app/tiktok/page.tsx` (publicar/agendar,
  tracking de vídeos, card scraping "Sem API/Avançado" com provider
  `scraper_tiktok` + `RiskBanner`, executor ausente) + link **TikTok** no
  AppNav admin.
- **FASE 3, slice 1 (tracking de anúncios em tempo real):** serviços
  puros `src/integrations/meta/adsInsights.ts` (`getMetaAdInsights` —
  Marketing API `/{act}/insights`, `time_range`, métricas spend/impressões/
  cliques/alcance/ctr/cpc + ações, Header Bearer do OAuth Meta; não lança)
  e `src/integrations/tiktok/adsAnalytics.ts` (`getTikTokAdsInsights` —
  TikTok Business API `report/object/get`, token **BAP** distinto do
  Content Posting, 1 dia por consulta, níveis por entidade;
  `isValidTikTokAdsDate` rejeita dias inexistentes). Resolvers novos:
  `resolveTenantMetaAdsAccess` (token `meta_integrations` + ID da conta em
  AgentMemory `meta_ads`) e `resolveTenantTikTokAdsAccess` (provider
  `tiktok_ads`: `advertiserId` + `accessToken`). Provedores `meta_ads` e
  `tiktok_ads` (camada oficial) no registry. Rotas
  `GET /api/meta/ads-insights?timeRange=` e `GET /api/tiktok/ads-insights?date=&entity=`
  (401/400/409/503/502 honestos, sem segredos no corpo). UI: card
  "Anúncios em tempo real (Ad Manager)" em `/facebook` + card TikTok Ads em
  `/tiktok` (lilás, `ApiBadge official`).
- **Testes**: 16 novos (IG) + 12 novos (FB) + 15 novos (TikTok) + 8 novos
  (Meta Ads) + 12 novos (TikTok Ads) → suíte total **27 suítes / 351
  testes PASS**; `tsc` 0 erros.
- **P0 [HUMANO]**: `META_*` no hpanel + conta IG **e** Página FB vinculadas via
  OAuth; sem isso as rotas degradam honestamente (409/503). O TikTok usa as
  chaves do AgentMemory (provider `tiktok`) — sem dependência de credencial
  externa de terceiros.
- **Próximo passo autônomo: FASE 3 restante** (executores "Sem API/Avançado"
  com aviso de risco — QR/scrapers/browser automation; chatbot visual
  completo; executores de n8n/Zapier/Make/webhooks de saída), depois FASE 4
  (fila de
  jobs BullMQ/Inngest, incluindo o executor do agendamento de TikTok, e
  testes de fluxo principal).

### FASE 1 (backend + UI) — concluída (referência)

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
- **Dependência [HUMANO] (P0)**: `META_APP_ID/SECRET`, `EMAIL_*` (Resend) e
  `OMNIROUTER_*` ainda no hpanel do Hostinger — a UI degrada de forma honesta
  (503) até serem preenchidas; nenhum segredo em localStorage.
- **Próximo passo autônomo: FASE 3** (tracking em tempo real — Meta Ad
  Manager + TikTok Ads; executores "Sem API/Avançado" com aviso de risco;
  chatbot visual completo; n8n/Zapier/Make/webhooks), depois FASE 4 (fila
  de jobs BullMQ/Inngest, incluindo o executor do agendamento de TikTok, e
  testes de fluxo principal).

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
