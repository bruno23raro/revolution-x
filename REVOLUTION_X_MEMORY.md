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

## ESTADO ATUAL (2026-10-19) — FASE 2, FASE 3 (slices 1–4), FASE 4 (slices 1–3) e continuação pós-FASE 4 concluídas

- **Continuação pós-FASE 4 (2026-10-19 — reforço de correção/segurança + docs):**
  - **`publicScraper` (SSRF endurecida, 5 camadas):** allowlist só `http`/`https`;
    normalização de IP-literal em notações não-estritas (decimal, octal, hex,
    IPv4-mapped IPv6 `::ffff:a.b.c.d` + `::ffff:7f00:1` e v6 embutido) antes de
    checar range; **pré-resolução DNS** por `resolveHost` injetável (mitigação
    de rebinding — endereço resolvido é o que vai à guarda); redirects **manuais**
    (`redirect:'manual', max 3`) revalidando cada `Location`; timeout
    (`AbortController` + detecção `AbortError`) + teto `maxBytes`. Suíte de
    **29 testes** (`publicScraper.test.ts`, zero DNS real).
  - **Hardening adversarial (revisão em profundidade):** `isBlockedIp` ganhou o
    marcador de v4-mapped/compatible em **expansão total** (`0:0:0:0:0:ffff:xx:yy`)
    no ramo v6 — fecha a forma não-canônica que um resolver INJETADO pode devolver
    (o resolver default + `new URL` já normalizam p/ `::ffff:a.b.c.d`). Defesa em
    profundidade; zero falso-positivo sobre v6 global real. Revisão concluiu:
    **sem bypass determinístico no caminho Node**; único resíduo é o rebinding de
    TTL curto, **documentado** no header (`resolveHost`/`fetchImpl` são os hooks).
  - **Correção de consistência `supersededAt`:** `findTikTokPendingScopes`
    (descoberta do cron) agora filtra `supersededAt: null` — alinhado à
    semântica de leitura do executor (`listMemory`); antes uma linha
    `PENDING_KEY` superada contava como pendência que o próprio tick veria
    vazio. **Bug real, sem credencial.**
  - **P4-2 registro-zumbi (`/api/auth/register`):** quando o onboarding
    (`public."User"`+`Organization`+`OrganizationMember`) falha, a rota agora
    **compensa** com `admin.auth.admin.deleteUser` (melhor esforço, via
    service-role existente — nenhuma credencial nova) e devolve **500 honesto**
    (`detail: onboarding_rolled_back` / `onboarding_residual`) em vez de 201
    falso. Antes o usuário logava em GoTrue mas ficava **bloqueado do app**
    (`getAuthenticatedUser` → `null`, sem retry). Não enfraquece auth:
    **endurece a consistência**. A compensação é em **dois planos**: mata o GoTrue
    (`deleteUser`) E apaga o **resíduo público parcial** (`OrganizationMember` →
    `Organization` (via `orgId` threadado) → `public."User"`, child→parent) — o
    GoTrue **não tem cascade** p/ `public."User"` (PK nua, sem FK/trigger), e a
    linha órfã (e-mail UNIQUE) travaria o re-cadastro do mesmo e-mail.
    **6 testes** (`register/route.test.ts`, incl. cenário de onboarding parcial
    User-ok/Org-falha que era intestado antes).
  - **Dependência órfã removida:** `resend` (v6.33) saía de `package.json`/
    lock — o `ResendEmailProvider` é **fetch-based** contra a REST
    (`api.resend.com`, `EMAIL_API_BASE_URL`), sem import do SDK. Limpeza
    sem credencial, build inalterado.
  - **Docs [HUMANO] à prova de erro:** `docs/HANEL_SETUP_CRON.md` ganhou a
    matriz de diagnóstico (§5) — lê o **corpo** (`error`), não só o HTTP;
    cobre `401/503 cron_not_configured/405/queue_unavailable (503)/list_failed
    (500)/tick_failed (500)/ok:true retried>0/tenant_failed (200 ok:false)/
    failed>0` + atalho do gatilho manual `/tiktok` p/ validar o executor.
  - **`app/page.tsx`** stats atualizados p/ **488/488 PASS** + **28/28 págs**
    (era 185/185 + 39/39 — defasados).
  - **Total vigente: 37 suítes / 488 testes PASS; `tsc` 0 erros; `next lint` 0
    avisos; build limpo (71 rotas = 40 API + 31 não-API; 28 páginas reais
    excl. `/_not-found`, `/icon.svg`, `/auth/callback`).**

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
- **FASE 3, slice 2 (chatbot visual completo + auto-reply, §3.8/§3.2h):**
  - **Motor** (`whatsappChatbot.ts`, aditivo — regras F1 intocadas):
    `ChatbotStep` (condição opcional; ausente = nó incondicional),
    `ChatbotConfig.steps/vars`, `DecisionSource` ganhou `'step'`,
    `ChatbotDecision` ganhou `matchedStepId/quickReplies`. `evaluateSteps`
    (entrada = 1º nó incondicional/com condição matcheando; avança por
    `nextStepId` re-checando a condição do destino contra a **mesma**
    mensagem; `end` encerra; ponteiro quebrado para com honestidade;
    anti-loop por visitados + `maxHops`; respostas unidas `"\n\n"`).
    `interpolateVars` ({{nome}}; chave desconhecida permanece).
    Ordem final: desligado → fora de horário → saudação → **steps** →
    regras → IA → fallback → nada.
  - **Quick replies oficiais** (`whatsappSender.ts`): `sendWhatsAppButton`
    no formato `interactive/button` (Cloud API) — máx. **3 botões**,
    rótulos ≤ **20 chars**, ids `rx-1..3`; erros
    `meta_not_configured|invalid_message|http_error|network_error`.
  - **Auto-reply** (fecha o ciclo da FASE 1, que só guardava as mensagens):
    `src/integrations/meta/chatbotAutoReply.ts` → `maybeAutoReply` lê a
    config do tenant (AgentMemory c/ RLS), roda o motor e envia pela Cloud
    API oficial (botões quando há quickReplies, senão texto). **Nunca
    lança**: `skipReason = config_unavailable|not_enabled|no_response|
    send_failed|error`; sem credencial → `meta_not_configured` c/
    `meta access: <razão>` (sem segredo).
  - **Processador** (`whatsappProcessor.ts`, aditivo): resultado ganha
    `waId`, `text`, `firstContact` (1º contato detectado na criação do
    Contact) — alimenta a saudação do auto-reply.
  - **Webhook Meta** (`app/api/webhooks/meta/route.ts`): após processar o
    evento, tenta `maybeAutoReply` por mensagem recebida (try/catch por
    item — **nunca quebra a entrega 200** da Meta).
  - **CRUD** (`/api/whatsapp/chatbot`): `normalizeConfig` normaliza
    `steps` (ids únicos, matchType válido, quickReplies ≤10, nextStepId
    nulo quando ausente, end bool) e `vars` (≤100, chave ≤64, valor ≤500);
    POST responde `steps`.
  - **UI** (`/whatsapp`): editor visual de etapas (condição → padrão/flags
    → resposta `{{variavel}}` → quick replies → próxima etapa; mover ↑↓,
    remover, "termina aqui") + seção "Variáveis" no card "Chatbot
    configurável" (lilás).
- **FASE 3, slice 3 (executores de saída — commit `0ccc12a`):**
  `src/integrations/outboundExecutors.ts` dispara n8n / Zapier / Make /
  webhook genérico (injetável `fetchImpl`, NUNCA lança, devolve
  `ok`/`error`/`errorDetail`, sem segredo no corpo) + rota
  `POST /api/integrations/execute` (prover no registry c/ credencial
  guardada) + card "Execução de saída" em `/integrations` (212 testes
  novos). Provedores `n8n`/`zapier`/`make`/`webhook` no registry
  (`providers.ts`).
- **FASE 3, slice 4 (Seção Sem API/Avançado — commits `b4657de` + `5e649af`):**
  `checkRiskAcknowledgment` extraído p/ `src/integrations/riskAcknowledgment.ts`
  (never-throw, importado por `qrCodeGenerator.ts` — QR Code WhatsApp
  SVG/dataURL sem deps, com consentimento de risco);
  `src/integrations/publicScraper.ts` (`scrapePublicUrl` +
  `isSafePublicUrl` c/ guarda SSRF: bloqueia localhost, IPs privados,
  link-local e metadata 169.254.169.254; `fetchImpl`/`timeoutMs`/`maxBytes`
  injetáveis, NUNCA lança, máx. 500KB). Executores de scraping permanecem
  DECLARADOS c/ `RiskBanner` — sem execução não-oficial silenciosa.
- **Teste live OmniRouter resiliente (commit `8fcd3a4`):** `omni-router.test.ts`
  detecta status HTTP no erro (`OmniRouter HTTP 5xx/429/408` →
  indisponibilidade transitória): retry c/ backoff 1,5s×tentativa, máx. 3;
  persistindo, ADIA com aviso honesto (sem deixar o CI vermelho por fora do
  escopo); outro erro continua propagando.
- **FASE 4, slice 1 (executor do agendamento — commit `0e3de63`):**
  `src/jobs/tiktokScheduler.ts`: núcleo puro `selectDuePosts` +
  `runDueTikTokPosts` c/ `TickDeps` injetáveis (backend-agnóstico);
  persistência na AgentMemory EXISTENTE (`pending:tiktok_posts`,
  `saveMemory` — zero dep novas; contrato `TickDeps` é o ponto de
  extensão p/ adaptadores BullMQ (`REDIS_URL`) / Inngest
  (`INNGEST_*`), ambos [HUMANO]). Semântica: acesso TikTok
  indisponível → itens seguem pendentes (intenção preservada);
  publicação ok → `published`+`publishId`; falha → `failed`+motivo;
  UMA gravação por tick; fila ausente → `queue_unavailable` 503.
  Rota `app/api/tiktok/tick/route.ts` (POST tick / GET fila projetada,
  últimos 50, sem segredos; 401/503/200). UI: card "Agendados
  (executor da fila)" em `/tiktok` (lista + "Processar agendados" +
  "Recarregar"). Jest: `@/jobs` mapeado no `moduleNameMapper`.
- **FASE 4, slice 2 (retry c/ backoff — commit `cb48089`):**
  falha de publicação NÃO encerra na hora: `PendingTikTokPost` ganhou
  `attempts?`; o tick incrementa e, até `maxAttempts` (padrão 3),
  REAGENDA (`pending` c/ `scheduledAt = now + retryBaseDelayMs *
  2^(attempts-1)`, base padrão 5 min) — só então `failed` terminal
  (contador preservado). `TickResult` relata `retried` separado de
  `failed` (terminais); `ok` considera só encerrados. `markPendingTikTokPost`
  aceita patch c/ `attempts`/`scheduledAt` (módulo segue puro). UI:
  contador "tentativa N" por item + "reagendado(s)" no resultado do tick.
  10 testes novos: 5 de retry/backoff + 5 de FLUXO PRINCIPAL
  (`tiktokScheduler.flow.test.ts` exercita `bindTikTokSchedulerDeps`
  real, AgentMemory → núcleo, com `TaskQueueUnavailableError` REAL p/
  `instanceof`: wiring exato do tenant/kind/key, falha → fila gravada c/
  item reagendado, save 503, projeção p/ UI).
- **FASE 4, slice 3 (cron multi-tenant + gatilho secreto — commit `042ec94`):**
  disparo periódico do tick, a parte que ainda faltava do FASE 4.
  `findTikTokPendingScopes(client)`: descobre em AgentMemory TODOS os
  (org,user) com item PENDING em `pending:tiktok_posts` (o backend é
  **user-scoped** — migration 014; a varredura é nível-sistema de
  propósito, por isso só existe atrás do segredo).
  `runTikTokCronForAll(client, opts?)`: 1 tick por escopo — cada tick roda
  de volta no contexto RLS de SEU usuário (`bindTikTokSchedulerDeps`);
  isolamento por tenant (1 falha não bloqueia os demais); agregado
  `{ ok, tenants, published, failed, retried, reasons }` com
  `queue_unavailable`/`list_failed`/`tenant_failed`; **nunca lança**.
  Rota `POST /api/cron/tiktok`: env `CRON_SECRET` ausente → 503
  `cron_not_configured` (degradação honesta); header `x-cron-secret` com
  comparação **em tempo constante** (guarda de tamanho +
  `crypto.timingSafeEqual`, padrão dos webhooks Meta) → 401; 200 com a
  agregação; `queue_unavailable` → 503; `GET` → 405. **Resíduo [HUMANO]**:
  definir `CRON_SECRET` no hpanel + registrar o job de cron do Hostinger
  (ex.: a cada 5 min) chamando a rota — a rota e o runner já estão prontos.
  20 testes novos (10 cron flow + 10 rota).
- **Testes**: 16 novos (IG) + 12 novos (FB) + 15 novos (TikTok) + 8 novos
  (Meta Ads) + 12 novos (TikTok Ads) + 18 novos (fluxo/vars/quickReplies)
  + 8 novos (auto-reply) + 6 novos (botões) + **16 novos (executores de saída)**
  + **3 novos (scraper público)** + **23 novos (FASE 4: executor + rota + projeção)**
  + **10 novos (FASE 4 · slice 2: retry/backoff + fluxo principal)**
  + **20 novos (FASE 4 · slice 3: cron multi-tenant + gatilho secreto)**
  → suíte total **36 suítes / 455 testes PASS**; `tsc` 0 erros.
- **P0 [HUMANO]**: `META_*` no hpanel + conta IG **e** Página FB vinculadas via
  OAuth; sem isso as rotas degradam honestamente (409/503). O TikTok usa as
  chaves do AgentMemory (provider `tiktok`) — sem dependência de credencial
  externa de terceiros.
- **FASE 4 COMPLETA (slices 1–3)**: executor + retry/backoff + cron
  multi-tenant (`runTikTokCronForAll`) + gatilho secreto
  (`POST /api/cron/tiktok`). O PROMPT MESTRE inteiro (hub de integrações,
  WhatsApp completo, IG/FB/TikTok oficial, tracking de anúncios, Sem API
  c/ avisos de risco, chatbot visual, n8n/Zapier/Make/webhooks, fila do
  agendamento c/ retry + disparo periódico) está CONCLUÍDO em código.
  **Restam só passos [HUMANO]**: (a) `CRON_SECRET` no hpanel + job de cron
  do Hostinger apontando p/ `POST /api/cron/tiktok` (ex.: a cada 5 min);
  (b) adaptadores BullMQ (`REDIS_URL`) / Inngest (`INNGEST_*`) — o contrato
  `TickDeps` já é o ponto de extensão (o executor não muda); (c) credenciais
  `META_*`/`EMAIL_*`/`OMNIROUTER_*` no hpanel + **escopo Meta `ads_read`
  (ou `read_insights`)** no app da Meta p/ os insights de anúncios
  (`GET /{act-id}/insights`) + **token BAP do TikTok** p/ a Business API
  (`report/object/get` — é um token de Business, distinto do token de
  usuário do Content Posting).

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
