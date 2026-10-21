# REVOLUTION X — Relatório Final de Prontidão

> **Missão:** Finalização, Docker, testes e multicontas.
> **Data:** 2026-10-20 · **Branch:** `feat/premium-landing-integration`
> **Estado do repositório:** alterações de multicontas + Docker **prontas, validadas e não
> commitadas/pushadas** (nada foi publicado sem autorização).
>
> **Docker: INSTALADO e validado ao vivo neste computador** (Docker 29.9.1,
> Compose v5.6.0, backend WSL2). O stack de teste isolado subiu, o banco de teste
> (Postgres 17) recebeu o schema via `prisma db push` e a aplicação respondeu em
> `http://localhost:3000` (`db` e `app` `healthy`). Os únicos itens ainda não
> cobertos no local dependem de **Supabase Auth** e **credenciais de plataforma**
> — esses são **PASSOS HUMANOS** (seção 9).
>
> Este relatório consolida as 10 fases. Onde o local termina, há um **PASSO HUMANO**.

---

## 1. Verificação automatizada (estado atual — 2026-10-20)

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit` | **0 erros** |
| `npm test` (Jest, `--runInBand`) | **578/578** suítes 44/44 (~47 s) |
| `npm run lint` (`next lint`) | **0** avisos/erros |
| `npm run build` | **limpo** (70 rotas) |

> Os testes da "família de banco/RLS" **não exigem Postgres ao vivo** neste
> ambiente: os módulos de banco são **mockados** nas fronteiras.
>
> **Ressalva de schema (importante):** o schema do app no Postgres local é
> criado por `prisma db push` (**PascalCase**); as migrations oficiais em
> `supabase/migrations/` usam **snake_case** e definem `meta_integrations`
> **diferente** (colunas `provider`, `encrypted_access_token`, RLS). São a
> mesma tabela com colunas distintas → **NÃO são equivalentes**. O app lê
> `meta_integrations` via **cliente Supabase (service_role)**; logo, num projeto
> Supabase novo é preciso **aplicar as migrations SQL** (não só `db push`).

---

## 2. Fase 1 — Matriz de funcionalidades (4 estados)

Cada integração/feature é classificada em um dos quatro estados:
- **(a) Funcional e validado** — código + testes passing, pronto.
- **(b) Implementado, não validado** — código existe e passa testes unitários,
  mas não foi exercitado contra a API **real** da plataforma (falta credencial/aprovação).
- **(c) Parcial / bloqueado** — falta peça (ex.: executor não oficial, credencial de servidor).
- **(d) Não implementado** — apenas documento/declaração.

| Área | Canais / recursos | Estado | Evidência |
|---|---|---|---|
| **Autenticação** | Supabase Auth (única via), multi-org | **(a)** | rotas de auth; guard fail-closed travado em teste |
| **Integração Meta (OAuth)** | Conectar FB+IG+WhatsApp num OAuth; token criptografado (AES-256-GCM) | **(b)** | fluxo OAuth + callback persiste múltiplas Páginas; testes de resolver/IDOR passing |
| **Publicar Facebook** | Publicar/agendar post de Página (10 min–75 dias) | **(b)** | `/api/facebook/publish`; seletor de conta; testes unitários |
| **Publicar Instagram** | Publicar/agendar post/reel via Graph API | **(b)** | `/api/instagram/publish`; seletor de conta |
| **WhatsApp (Cloud API)** | Disparo em massa + templates + chatbot auto-reply | **(b)** | `/api/whatsapp/send|templates`; `chatbotAutoReply`; seletor de número |
| **Meta Ads** | Insights em tempo real (spend, impressões, cliques) | **(b)** | `/api/meta/ads-insights`; exige `adAccountId` + permissão `ads_read` |
| **TikTok (OAuth PKCE)** | Conectar + agendar vídeos (Content Posting API) | **(b)** | `/api/auth/tiktok`, `/api/integrations/tiktok`, `/api/tiktok/publish`; seletor; fila persistida |
| **TikTok Ads (Business)** | Relatórios via BAP (Advertiser ID + token) | **(c)** | provedor declarado; exigem credenciais Business não fornecidas |
| **n8n / Zapier / Make / webhook** | Disparo de eventos de saída + webhook de entrada | **(b)** | `providers.ts` + probes honestos + executores outbound |
| **Provedores "Sem API / Avançado"** | Scraping IG/TikTok, WhatsApp QR, browser automation | **(d)** | **apenas declarados + aviso de risco; executor NÃO implementado, NÃO executado em silêncio** |
| **Multicontas (Fase 4/5)** | Escolher a conta em cada operação | **(a)** | resolvers Meta (4) + TikTok; listagem; seletor nas 4 telas; testes passing |
| **Agendamento** | TikTok scheduler (gatilho HTTP + fila persistida) | **(b)** | `src/jobs/tiktokScheduler.*` (tests passing) |

> **Legenda de "validado":** "unitariamente" = testes de lógica passando com
> fronteiras mockadas. **Não** significa que a chamada à API da plataforma foi
> feita — isso é a Fase 8 (humano).

---

## 3. Fase 2 — Ambiente Docker local (isolado)

**Arquivos criados:** `Dockerfile`, `Dockerfile.dev`, `compose.yaml`,
`compose.dev.yaml`, `compose.test.yaml`, `.env.docker.test`, `.dockerignore`,
`README-DOCKER.md`.

- Banco: **Postgres local próprio** do compose. O stack de **teste**
  (`compose.test.yaml`, projeto `revolution-x-test`) usa volume dedicado
  `revx_test_pgdata`; a porta 5432 do container é publicada no host em **15432**
  (as 5432 do Windows já estão ocupadas por dois Postgres locais PG14/PG18). O
  app alcança o banco **na rede interna** `db:5432` (afetado).
- **Não há** conexão com o banco de produção: `DATABASE_URL`/`TEST_DATABASE_URL`
  no compose apontam para `db:5432` (container local), **jamais** para o
  Supabase de produção. Confirmado no container rodando.
- `.dockerignore` **exclui** todos os segredos/`.env` da imagem.
- **Fix aplicado no `Dockerfile`:** `COPY --from=build /app/.next ./` (destino
  `./` = WORKDIR) espalhava o *conteúdo* do `.next` direto em `/app` em vez de
  criar `/app/.next` → a imagem saía sem `BUILD_ID` e `next start` crash-loopava.
  Corrigido para `COPY --from=build /app/.next ./.next` (destino explícito).

**Comandos exatos — executados com êxito aqui** (Docker instalado; CLI via
caminho completo no Windows):

```bash
# Stack de teste isolado (db Postgres 17 + app), banco novo, Supabase vazio
docker compose -p revolution-x-test -f compose.test.yaml --env-file .env.docker.test up -d

# Status: db "healthy" (0.0.0.0:15432->5432) · app "healthy" (0.0.0.0:3000->3000)
docker compose -p revolution-x-test -f compose.test.yaml --env-file .env.docker.test ps

# Banco local: aplicar o schema do app SÓ no banco de teste (porta 15432 do host)
npx prisma db push   # aponta p/ 127.0.0.1:15432/revolution_x (usuário/senha do .env.docker.test)

# URL local real: http://localhost:3000  (landing 200)
docker compose -p revolution-x-test -f compose.test.yaml --env-file .env.docker.test logs -f app
docker compose -p revolution-x-test -f compose.test.yaml --env-file .env.docker.test down   # mantém o volume
```

### ✅ Validado ao vivo neste computador (registro honesto)

- **Containers ativos e saudáveis:** `db` (Postgres 17) `healthy` e `app`
  `healthy` (`Up` estável, sem crash-loop).
- **URL local comprovada:** `http://localhost:3000` → landing **200** com HTML
  real (`<title>Revolution X — Sua operação em movimento</title>`); `/login`,
  `/register` → 200; rotas protegidas (`/integrations`, `/testcenter`,
  `/dashboard`) → **307 → /login** (guard de auth); rotas que exigem Supabase →
  **503** "Authentication service is not configured" (guard **fecha**, não
  inventa login — comportamento esperado sem Supabase).
- **Banco de teste (destino e estado):** `db:5432/revolution_x` (29 tabelas
  públicas: 27 Prisma PascalCase + `meta_integrations`/`webhook_events`
  snake_case); **TCP `db:5432` alcançável pelo container do app**.
- **Schema do app:** aplicado **somente** ao banco de teste via `prisma db push`
  (a árvore hand-SQL `migrations/001–013` não serve a Postgres puro — depende
  de `auth.users` do Supabase — e fica no perfil `sqltree`).
- **Migração 016:** **validada em banco descartável** (este computador,
  `2026-10-20`, bancos `meta016_v2`/`meta016_v3` do Postgres de teste; registro
  completo de comandos + resultados em **§9.1**): 2ª conta do mesmo
  provedor/org aceita; duplicata exata barrada por
  `uq_meta_integrations_account`; coexistência + isolamento cross-org via RLS;
  aditivo (zero perda). **NÃO** aplicada ao banco de teste principal nem à
  produção.
- **Resíduo local (exige Supabase/credencial, não é falha de ferramenta):**
  a verificação de **RLS em runtime** e o **E2E de publicação real** precisam
  de Supabase Auth + credencial de plataforma → checklist humano (seção 9).

---

## 4. Fase 3 — Dados de teste limpos e seguros

- Os testes **não** usam dados reais de clientes. Os dados de teste são
  sintéticos (`org1`, `5511`, `wamid.1`, tokens fake).
- Os tests da família DB **mockam** o banco → não precisam de dados reais.
- Regra mantida: "Não use nem copie dados reais de clientes para popular o
  ambiente de teste."

---

## 5. Fase 4/5 — Multicontas + seleção de conta (concluído, validado)

**Meta (1 OAuth habilita 3 canais):**
- 4 resolvers em `src/integrations/meta/resolveAccess.ts` aceitam `accountId`:
  `resolveTenantFacebookPageAccess`, `resolveTenantInstagramAccountAccess`,
  `resolveTenantWhatsAppAccess` (número/WABA), `resolveMetaAdAccountAccess`.
- Determinístico: `.order('connected_at', { ascending: false })`; sem `accountId`
  usa a mais recente; se `accountId` não existe → `account_not_found` (409).
- **Callback OAuth** (`app/api/auth/callback/meta/route.ts`) persiste **todas**
  as Páginas/contas que o Graph expuser (loop check-then-act, não upsert de
  coluna inválida).
- Rotas `/api/facebook|instagram|whatsapp|meta|…` fazem `body.account` →
  resolver e mapeiam `account_not_found` → `409`.

**TikTok:**
- `resolveTenantTikTokAccess` (multicontas) + `listTikTokAccounts` +
  `saveTikTokOAuthTokens` (merge de contas).
- Nova rota `GET /api/integrations/tiktok` lista as contas (honesta: `count:0`
  se fila indisponível, sem vazar segredo).
- `/api/tiktok/publish` + scheduler aceitam `account`.

**Telas (seletor de conta, só com 2+):**
- `app/tiktok|facebook|instagram|whatsapp/page.tsx` e `app/integrations/page.tsx`.

**Migração (Fase 4, humano):** `supabase/migrations/016_multi_meta_accounts.sql`
- Adiciona `display_name`, **solta a UNIQUE(organization_id, provider)** e
  cria índices por `coalesce(meta_page_id, phone_number_id, instagram_account_id)`.
- **NÃO foi aplicada à produção.** É um PASSO HUMANO (ver seção 9).

---

## 6. Fase 6 — Separação "API oficial" vs "Sem API / Avançado"

- `src/integrations/providers.ts` classifica cada provedor em `layer:
  'official' | 'sem_api'` e declara um **probe honesto** (`ok`/`not_configured`/
  `error`/`skipped`).
- **Regra de modo preview:** os modos "Sem API / Avançado" **não executam nada
  por trás das cortinas** — apenas **declarar o método + guardar o parâmetro +
  exibir aviso de risco** (ToS/LGPD/GDPR). **Nenhum envio real** acontece
  nesses modos nos testes (nem em produção).
- Consequência para QA: testes de "Sem API" só validam o **guardar/declaração**,
  nunca a automação (que não existe).

---

## 7. Fase 7 — E2E de multicontas: o que está coberto vs. o que exige banco ao vivo

**Coberto por testes (roda em ~10 s, sem banco real):**
- `meta-resolver-multi.test.ts` — 4 resolvers: conta padrão, pin por `accountId`,
  `account_not_found` (409), isolamento multi-org.
- `tiktok-accounts-route.test.ts` — `GET /api/integrations/tiktok` (401, 2 contas,
  `count`, sem vazar segredo).
- `tiktok-oauth-routes.test.ts` / `tiktok-oauth.test.ts` — PKCE + gravação multicontas.
- `chatbotAutoReply.test.ts` — auto-reply do chatbot com resolver multi.
- `meta-idor.test.ts` — trava de IDOR cross-tenant.

**Exige Supabase Auth + credencial de plataforma (exige humano — NÃO falha de
ferramenta; o Docker/banco local já estão validados):**
- RLS em runtime (isolamento multi-tenant de fato no banco, com supabase).
- 2+ contas reais **no Supabase** na mesma organização (só possível **depois**
  da migração 016 aplicada lá). A verificação da regra de banco (2ª conta
  liberada / duplicata barrada / isolamento por org) **já foi exercitada no
  banco local descartável** — foi o teste de 016 na seção 3.
- E2E de publicação real (precisa de credencial/aprovação da plataforma).
- **Recomendação:** mover a suíte RLS de `TEST_DATABASE_URL` para o Postgres
  local do Docker (não para o Supabase de produção) e rodar com `docker
  compose` em CI; o restante (RLS de runtime via Supabase) exige a Fase 8.

---

## 8. Fase 8 — Inventário de aprovações / credenciais (PASSO HUMANO)

> **Parar** em: login da conta real, 2FA, CAPTCHA, aprovação de permissão.
> O agente **não** contorna nada disso.

| Item | Tipo | Onde | Ação humana |
|---|---|---|---|
| Meta App (Business) | Credencial + permissões (`pages_*`, `instagram_*`, `whatsapp_business_messaging`, `ads_read`) | Meta for Developers | Criar app, adicionar permissões, **aprovevação da Meta** (algumas exigir 2FA/app review) |
| Meta Token Encryption Key | `META_TOKEN_ENCRYPTION_KEY` (32 bytes base64) | Servidor | Definir no ambiente; **não imprimir** |
| TikTok App | `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` | TikTok for Developers | Criar app; OAuth PKCE; **login + 2FA** na sua conta |
| TikTok Ads (BAP) | `advertiserId` + Access Token de Business | TikTok Business Manager | Aprovação Business (estado **(c)**) |
| Supabase | `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Definir no ambiente; **nunca** em `.env` commitado |
| OmniRouter / Anthropic | `OMNIROUTER_*` / `ANTHROPIC_*` | hPanel | Definir no hPanel (resíduo conhecido: chat no ar com `routerConfigured:false`) |
| **Migração 016** | DDL em `meta_integrations` (Supabase) | Supabase | Aplicar **manualmente**, após revisão, **nunca** contra produção sem autorização |
| Domínio/DNS/produção/cron | Operações externas | hPanel/hosting | Somente com autorização separada |

**Inventário de "o que já está pronto para validar com credencial real":**
o código está em estado **(b)** — basta credencial + aprovação para exercitar
contra a API real. Nenhum segredo foi impresso neste relatório.

---

## 9. Checklist HUmANO passo a passo (o que resta para produção)

> Ordens de execução sugeridas; cada item **exige** a condição apontada.

**Pré-condições do ambiente local**
- [x] Docker instalado (Docker 29.9.1 / Compose v5.6.0) — **feito/verificado**.
- [ ] (para homologação com auth) `.env` local com `POSTGRES_PASSWORD` (local)
      + vars Supabase **para auth**; o stack de **teste** usa `.env.docker.test`
      (Supabase vazio — auth em 503, banco local funciona).
- [ ] **Nunca** apontar `DATABASE_URL`/`DIRECT_URL` para o Supabase de produção.

**Subir o local (comando que funcionou aqui)**
- [x] `docker compose -p revolution-x-test -f compose.test.yaml
      --env-file .env.docker.test up -d` → `ps` (db `healthy` :15432,
      app `healthy` :3000).
- [x] `npx prisma db push` p/ `127.0.0.1:15432/revolution_x` (29 tabelas).
- [x] Abriu `http://localhost:3000` (landing 200). Opcional: `compose.dev.yaml`.

**Multicontas no banco (a mais arriscada — revisão explícita)**
- [x] Revisar `supabase/migrations/016_multi_meta_accounts.sql` (aditivo:
      coluna `display_name`, drop do único antigo, 2 índices únicos de
      expressão; **não** toca RLS/FK/dados).
- [x] **Validada em banco descartável** (registro real, §9.1 abaixo): duplicata
      exata barrada **antes** de 016 e aceita **depois**; `uq_*` criados;
      contagem preservada (aditivo, zero perda); RLS multi-tenant em role
      restrito (org A ≠ org B).
- [ ] Aplicar a 016 **no projeto Supabase de desenvolvimento/staging** (não
      produção).
- [ ] Confirmar ao vivo: 2ª Página do mesmo provedor aceita (testar 2 contas).
- [ ] Somente depois (autorizado): aplicar em produção.

**PRÓXIMO PASSO HUMANO — Projeto Supabase de desenvolvimento (libera o teste
funcional ao vivo)**

> Sem isso, register/login/org/CRM ao vivo **não** rodam (Supabase Auth é o
> caminho único de auth; sem projeto as rotas fecham em `503`, guard
> fail-closed). Instrução passo a passo para iniciante: ver
> `docs/GUIA_INICIANTE_REVOLUTION_X.md` §8 (H1–H5).

- [ ] **H1.** Criar um **projeto Supabase novo de desenvolvimento** (NÃO
      reutilizar o de produção) → anotar a URL (`NEXT_PUBLIC_SUPABASE_URL`).
- [ ] **H2.** Aplicar as migrations SQL oficiais **neste projeto**
      (`001`→`016`; mín. `005`,`006`,`007`,`016`) — o app lê
      `meta_integrations` via service_role (snake_case + RLS); `prisma db push`
      **não** é equivalente (PascalCase).
- [ ] **H3.** Copiar as 3 chaves (`..._URL`, `ANON_KEY`, `SERVICE_ROLE_KEY`)
      para `.env.docker.test` (teste) — **sem versionar** (`git status` limpo).
- [ ] **H4.** Subir o stack de teste; `GET /api/health` → 200; register/login/
      org/CRM funcionam.
- [ ] **H5.** (opcional) app de desenv. Meta + TikTok para OAuth real.

**Não-automático (requer login/2FA/painel real):**
- [ ] Aprovações de plataforma (Meta/TikTok) — login da conta + 2FA.
- [ ] E-mail real: `EMAIL_PROVIDER=resend` + `EMAIL_API_KEY` + `EMAIL_FROM`.
- [ ] **Deploy / DNS / produção / cron** — autorização separada, **fora** do
      agente.

**Credenciais de plataforma**
- [ ] Meta: criar app + permissões + (se exigir) 2FA/app review.
- [ ] TikTok: criar app + `TIKTOK_CLIENT_*` no servidor.
- [ ] Supabase service role + OmniRouter no hPanel (valide apenas presença, **sem imprimir**).

**Verificação ao vivo (E2E de banco/RLS)**
- [ ] Rodar suíte RLS com `TEST_DATABASE_URL` → **Postgres local do Docker** (não Supabase prod).
- [ ] Exercitar publicação real em 1 conta por canal (Meta + TikTok).

**Publicação / deploy (apenas com autorização separada)**
- [ ] Commit + push da branch (agente **não** faz sem autorização).
- [ ] PR/merge.
- [ ] Deploy na Hostinger + ativar cron (`POST /api/cron/tiktok` + `CRON_SECRET`).
- [ ] Alterações de DNS/domínio/faturamento.

### 9.1 Registro REAL da validação da 016 em banco descartável (2026-10-20)

> Banco novo e isolado dentro do Postgres de teste do Docker
> (`revolution-x-test-db-1`), **sem** tocar `revolution_x`. Criado do `005`
> (estado anterior) +, onde aplicável, o `016` oficial. Comandos psql
> não-interativos; resultados reais.

- **Coexistência (depois de 016):** 2 contas `whatsapp` (wa-OLD/wa-NEW) +
  1 `facebook` (fbpage) na **mesma** org A → 3 linhas na mesma
  `(org, provider)`. ✅
- **Duplicata exata barrada:** inserir `(org, provider, conta)` já existente →
  `23505` em `uq_meta_integrations_account`. ✅
- **Seleção determinística:** sem `accountId`, o resolver retorna a
  **mais recente** (`connected_at desc`): `wa-NEW` (não `wa-OLD`). ✅
- **Sem exposição de token:** a tabela guarda **só**
  `encrypted_access_token` (AES-256-GCM) — **não** existe coluna
  `access_token` em claro. ✅
- **Isolamento cross-org via RLS (role restrito `revx_rls` NOBYPASSRLS +
  GUC `app.current_org`):** com GUC=org A → visíveis **só** as 3 linhas de A;
  com GUC=org B → visíveis **só** a linha de B (`wa-OLD`). ✅
- **Antes/después + segurança de dados (DB do `005` só):** 2ª conta do mesmo
  `(org,provider)` → **rejeitada** (viola o único antigo) → **antes**; após
  aplicar 016 → **aceita** → **depois**; contagem preservada; FK
  `organizations` intacto (0 órfãos); `016` é **aditivo** (só a coluna
  `display_name`, 2 novos índices e o drop do único antigo) — **zero perda de
  dados**. ✅
- **RLS vazio-GUC:** a policy do `005` (sem guarda) daria erro no cast
  `''::uuid`; **007** recria a policy com
  `NULLIF(current_setting('app.current_org',TRUE),'')::uuid` → GUC vazio/ausente
  = 0 linhas (fail-closed). `016` **não** mexe na policy → a versão
  endurecida do 007 persiste. ✅
- **Suíte do host (mesmo dia, pós-mudanças):** `tsc --noEmit` 0 ·
  `next lint` limpo · `next build` 70 rotas · `jest` **578/578** (44 suítes,
  ~47 s). ✅

**Limite honesto:** a validação acima é ao nível de **schema/DDL + RLS +
resolver** em banco local. O E2E **funcional ao vivo** (register/login/org/
CRM + 2 contas reais na plataforma) **requer** o projeto Supabase de
desenvolvimento + credenciais reais → checklist §9 (H1–H5). **Não** foi
exercitado contra plataforma real; **nada** foi aplicado a produção.

---

## 10. Declaração de prontidão

- **Pronto (código + testes):** multicontas e seleção de conta em todos
  os 5 canais; callback OAuth multi-Página; endpoint de listagem de contas
  TikTok; separação oficial/sem-API com probes honestos; arquivos Docker
  isolados. Validação local: `tsc` 0 · `npm test` 578/578 (44 suítes) ·
  `build` limpo · `lint` limpo.
- **Validado ao vivo (Docker instalado):** stack de teste com `db`
  (Postgres 17) e `app` `healthy`; URL real `http://localhost:3000` respondendo;
  banco de teste (29 tabelas) alcançado via `prisma db push`; migração 016
  **validada em banco descartável** (registro completo em §9.1; **NÃO** aplicada
  ao banco de teste principal nem à produção).
- **Exige Supabase/credencial (não é falta de ferramenta):** o teste
  **funcional ao vivo** (register/login/org/CRM + 2 contas reais) depende de um
  **projeto Supabase de desenvolvimento** + credencial/aprovação de plataforma
  → **humano** (checklist §9, H1–H5; guia para iniciante no
  `docs/GUIA_INICIANTE_REVOLUTION_X.md` §8).
- **Exige humano:** criar o projeto Supabase dev + aplicar migrations SQL
  (001→016), copiar as 3 chaves p/ `.env.docker.test` (sem versionar), aprovações
  de plataforma (login/2FA/CAPTCHA), **migração 016 em produção** (só com
  autorização), credenciais de servidor, deploy/DNS/cron.
- **Integridade preservada:** nenhum segredo impresso, nenhum commit/push/PR
  feito, RLS/multi-tenant intactos, volumes e trabalho do usuário preservados;
  **produção NÃO foi tocada** (migração 016 em produção e deploy nunca
  executados).

> Próximo passo recomendado (checklist §9, H1–H5): **criar um projeto Supabase
> de desenvolvimento**, aplicar as migrations SQL oficiais nele, copiar as 3
> chaves para o `.env.docker.test` **sem versionar** e então rodar o teste
> funcional ao vivo. A parte local/Docker/016-descartável **já está feita**.

---

## 11. Addendum 2026-10-21 — base reconstruída, bug do 002 e caixa de aplicação DEV

Atualiza o "próximo passo" acima com o que foi resolvido nesta sessão:

- **001–004 não faltavam.** A base Supabase é o `002` (família A, `./migrations/`).
- **Bug do 002 (etapa 19) encontrado/corrigido:** `IF NOT EXISTS (public.users) → RAISE`
  aborte um banco limpo; virou `IF EXISTS (...)`. Versão corrigida:
  `supabase/dev_apply/002a_supabase_base.sql`.
- **Dois planos / dois bancos:** Prisma(Pascal)→Docker local; Supabase(snake)→DEV.
  Cadeia DEV = **`002a + 005 + 015 + 016`** (não 006/008/009/014). **Nunca `prisma db push` no DEV.**
- **Cadeia comprovada em banco descartável** `rx_devchain_validate` (criada/apagada; produção
  e `revolution_x` intocadas): multi-conta coexiste, duplicado exato bloqueado, PENDING
  coexiste, RLS ON.
- **§8 verde:** `tsc 0 · eslint 0 · jest 578/578 · build clean`.
- **Caixa pronta:** `supabase/dev_apply/{002a_supabase_base.sql, verify_dev.sql, apply_dev.sh}`
  + guia `docs/DEV_APPLY_HUMAN_GUIDE_2026-10-21.md`.
- **Único bloqueio que abre tudo (humano):** a **senha do Postgres do DEV nunca foi
  definida** → `db query/push` falham com `PAM authentication`. Definir no dashboard
  (DEV só) + re-revelar chaves (o `.env.docker.test` ficou obsoleto) → `apply_dev.sh` roda.
- **Segurança:** um rastro de inspeção imprimiu **uma vez** chaves do DEV + a pooler da
  produção (com senha) → **rotacionar `service_role` do DEV e a senha do pooler da produção.**
  `mailer_autoconfirm=false` segue bloqueando o signup real (reversível só no DEV).
