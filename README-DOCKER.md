# REVOLUTION X — Docker (não invasivo)

Suporte Docker para o SaaS Omnichannel, **sem alterar lógica de negócio**:
nenhum arquivo de código existente foi tocado. A aplicação continua sendo
iniciada pelos mesmos comandos atuais (`next dev` / `next start`), apenas
dentro de containers.

## 1. Stack real (auditada, não assumida)

| Item | Valor (fonte) |
|---|---|
| Framework | Next.js **14.2.0** (App Router, `app/`) + React 18.3 (`package.json`) |
| Linguagem | TypeScript 5.4.5, Node ≥ 18 (`engines`), `@types/node` ^20 |
| Banco | **PostgreSQL** via Prisma 7.10 (`@prisma/adapter-pg` + `pg`), RLS via `set_config` (`src/lib/prisma.ts`) |
| Auth | Supabase Auth (`@supabase/ssr`) — `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` |
| Filas/workers | **Nenhum em código** — `REDIS_URL`/BullMQ é "conector futuro" (só documento). A fila do TikTok é **persistida em AgentMemory/Postgres** e executada por **gatilho HTTP externo** (`POST /api/cron/tiktok` + `CRON_SECRET`) |
| WebSockets | Nenhum |
| Storage | S3-compatível é variável futura (`S3_*`), sem uso em código ainda |
| E-mail | Resend (`EMAIL_PROVIDER=resend`) — sem valor = fallback local no-op (desejado) |
| IA | OmniRouter / Anthropic (`OMNIROUTER_*`, `ANTHROPIC_*`) |
| Portas | `3000` (Next, padrão; `PORT` respeitado em runtime) |
| Migrações | SQL manuais em `migrations/001–013.sql` + schema Prisma (`prisma/schema.prisma`) |
| Testes | Jest + ts-jest (`npm test`); suítes RLS precisam de Postgres de teste (`TEST_*_DATABASE_URL`) |
| CI atual | `.github/workflows/ci.yml` (ubuntu + `postgres:17` service) |

## 2. O que foi criado

| Arquivo | Papel |
|---|---|
| `Dockerfile` | Produção: multi-stage (`deps` → `build` → `runner`), `node:20-slim`, usuário `node` (não-root), healthcheck, segredos **só em runtime** |
| `Dockerfile.dev` | Desenvolvimento: hot reload via `next dev`, código montado por volume |
| `compose.yaml` | Produção/homologação: `db` (postgres:17, volume, healthcheck) + `migrate` (one-shot psql) + `app` (não publica porta) |
| `compose.dev.yaml` | Dev: `db` + `app` (hot reload, porta 3000 exposta) |
| `.dockerignore` | Contexto mínimo; **ningum segredo/.env entra na imagem** |
| `.env.example` | Ampliado com as variáveis que o código lê (audit 2026-10) |

Arquivos de código existentes: **0 modificados**.

## 3. Arquitetura resultante (diagrama textual)

```
                 ┌────────────────────────────────────────────────────┐
                 │  Rede interna `revx` (bridge, nomeada)            │
                 │                                                    │
  reverse proxy  │   ┌───────────────┐        ┌──────────────────┐   │
   (nginx/traefik) │   │   app (Next) │  SQL   │   db (postgres  │   │
  ────────────────▶│   │  :3000, node │───────▶│    17, volume   │   │
      host :3000*  │   │  não-root    │  gatilho│  _pgdata)       │   │
                 │   │               │◀───────┤  pg_isready ✔    │   │
                 │   │  /api/cron/…  │  HTTP  │  port 5432 só na │   │
                 │   └───────────────┘ segredo│  rede interna*   │   │
                 │        ▲            CRON_ │                  │   │
                 │        │                  └──────────────────┘   │
                 │   ┌────┴─────┐                                   │
                 │   │  migrate │ psql ON_ERROR_STOP:               │
                 │   │ (one-shot│ 001→013 (job, sai do stack prod)  │
                 │   └──────────┘                                   │
                 └────────────────────────────────────────────────────┘
   * porta 5432 no host é opcional (tooling local); app NÃO publica
     porta — fica atrás de proxy que termina TLS e aponta p/ app:3000
```

Segredos fluem **uma vez só**: `.env` (fora do git) → `docker compose`
interpol `${VAR}` → ambiente do container. A imagem de produção contém
`.next` + `node_modules` e **nenhum** valor de segredo; as variáveis
`NEXT_PUBLIC_*` (chaves públicas, não segredo) são inline-adas no bundle
client no **build** — mudar esses valores exige rebuild (limitação do
Next.js, não da imagem).

## 4. Comandos exatos

### 4.1 Subir (produção/homologação local)

```bash
cp .env.example .env          # preencha os campos que o SEU ambiente tem
docker compose up -d --build
docker compose ps            # db=healthy, migrate=Exit 0, app=starting→healthy
docker compose logs -f app
```

### 4.2 Subir (dev, hot reload)

```bash
docker compose -f compose.dev.yaml up
# http://localhost:3000 — edite no host, o browser recarrega
```

### 4.3 Migrations

```bash
# O serviço `migrate` do compose aplica 001→013 em banco NOVO automaticamente.
# Reaplicar manualmente (ex.: nova migração 014):
docker compose exec db psql -U revx -d revolution_x
docker compose run --rm migrate        # one-shot; psql ON_ERROR_STOP
```

> **Não é idempotente**: SQL sem guardas `IF NOT EXISTS` — em banco já
> migrado o psql falha na primeira tabela existente. Rode em banco novo ou
> aplique apenas a migração nova: `docker compose exec -T db psql -U revx -d revolution_x -f /dev/stdin < migrations/014_nova.sql`.

### 4.4 Seed

Não existe seed hoje (`db:seed` no `package.json` é placeholder
"Blocked by infrastructure") — nada inventado. Os testes carregam fixtures
próprios; a UI de admin cria dados via fluxos normais.

### 4.5 Testes (dentro do container)

```bash
# Suite completa (as suítes RLS precisam de banco de teste com roles):
docker compose exec db createdb -U revx revx_test_admin
docker compose exec db psql -U revx -d revolution_x -c \
  "CREATE ROLE revx_admin SUPERUSER; CREATE ROLE revx_test NOSUPERUSER NOINHERIT NOBYPASSRLS LOGIN PASSWORD 'revx_test';
   GRANT ALL ON DATABASE revx_test_admin TO revx_admin; GRANT ALL ON ALL TABLES IN SCHEMA public TO revx_test;
   GRANT ALL ON SCHEMA public TO revx_test;"
# (ajuste nomes conforme sua convenção; a CI usa postgres/revx_test — ver ci.yml)

docker compose -f compose.dev.yaml run --rm \
  -e TEST_ADMIN_DATABASE_URL=postgres://revx_admin:<senha> @db:5432/revx_test_admin \
  -e TEST_RLS_DATABASE_URL=postgres://revx_test:revx_test@db:5432/revx_test_admin \
  -e TEST_DATABASE_URL=postgres://revx:revx_dev@db:5432/revx_test_admin \
  app npm test
```

Sem banco de teste, rode só a parte que não precisa de RLS:
`docker compose -f compose.dev.yaml run --rm app npx jest src/tests --runInBand`.

### 4.6 Cron (worker de publicação do TikTok)

Não há worker em processo. Um agendador **externo** (crontab, Hostinger
hpanel, GitHub Actions schedule) dispara:

```bash
curl -X POST https://seu.dominio/api/cron/tiktok -H "x-cron-secret: $CRON_SECRET"
```

Em homologação atrás do proxy: `curl -X POST http://127.0.0.1:3000/api/cron/tiktok -H "x-cron-secret: $(grep '^CRON_SECRET=' .env | cut -d= -f2)"`.

### 4.7 Build, publicar e deploy

```bash
# Imagem nomeada (valores NEXT_PUBLIC_* viram parte do bundle)
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
  --build-arg NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
  -t ghcr.io/<org>/revolution-x:$(git rev-parse --short HEAD) .

docker login ghcr.io
docker push ghcr.io/<org>/revolution-x:$(git rev-parse --short HEAD)
# Deploy remoto: compose no host apontando `image: ghcr.io/...` (ou trocar a build por image:)
```

### 4.8 Rollback

Imagens por commit (tag = SHA) tornam o rollback um apontamento:

```bash
git log --oneline -3                       # acha a tag anterior
docker compose down && docker compose -f compose.prod.yml up -d
# no compose prod, `image: ghcr.io/<org>/revolution-x:<sha-anterior>`
# O banco NÃO é revertido — migrations são forward-only (sem undo).
# Se o deploy quebrou com migration nova: o schema segue o modelo novo
# (as tabelas são compatíveis para trás na aplicação anterior apenas se a
# migração foi aditiva; confira o SQL da migração antes).
```

### 4.9 Diárias de operação

```bash
docker compose ps                        # estado + health
docker compose logs -f app               # logs
docker compose exec app sh               # shell dentro (usuário node)
docker compose restart app
docker compose build --no-cache app      # rebuild forçado
```

## 5. CI/CD (proposta — não implementada)

Existe `.github/workflows/ci.yml` (lint+test+postgres:17). Proposta de
extensão em `.github/workflows/ci.yml` → novo arquivo `release.yml`:

```
push main → 1) reuse jobs do ci (lint/test/build)
          → 2) docker buildx (amd64; arm64 opcional p/ Apple Silicon host)
          → 3) trivy image --exit-code 1 (HIGH/CRITICAL em camadas novas)
          → 4) push GHCR (tag: SHA + latest)
          → 5) DEPLOY — PLATAFORMA A DEFINIR (ver pergunta abaixo)
```

**Não implementei deploy automático** — como pedido, falta a plataforma:
Hostinger (hpanel), VPS própria (compose no servidor), Vercel, ou Kubernetes?

## 6. Riscos, limitações e melhorias futuras

- **NEXT_PUBLIC_ inline**: trocar as chaves públicas do Supabase exige
  rebuild (limitação do Next.js, fora do controle do Docker).
- **Migrations não idempotentes**: o `migrate` só é seguro em banco novo;
  a CI já usa banco efêmero — o padrão local segue o mesmo caminho.
- **Postgres local ≠ RLS de produção**: o `db` do compose roda com superuser
  (`revx`). O Postgres de produção (Supabase) usa role **sem BYPASSRLS** e
  políticas RLS (migrações 007/008/009). Para testar RLS de verdade, use o
  fluxo do §4.5 com `TEST_RLS_DATABASE_URL`.
- **Sem Redis por design**: `REDIS_URL` está reservado, mas nada em código o
  usa hoje — não incluí o serviço (regra "não inventar"). Quando um adapter
  BullMQ for plugado no `TickDeps` do TikTok, basta adicionar `redis:7` ao
  compose (rede `revx`, volume opcional, healthcheck `redis-cli ping`).
- **`next start` sem standalone**: a imagem final carrega `node_modules`
  (~300–400 MB). Alternativa futura: `output: 'standalone'` no
  `next.config.mjs` (alteração de 1 linha, precisa de approval) reduz p/
  ~100–150 MB.
- **Escalabilidade**: app stateless (sessão via Supabase; fila em Postgres)
  → escalar horizontal com `docker compose up -d --scale app=N` atrás de
  proxy. O cron deve disparar **1 vez** (não por réplica) — ou adotar
  lock (ex.: `pg_advisory_lock`) como evolução.
- **Observabilidade**: `next start` já emite logs estruturados no stdout
  (`docker compose logs`); evoluir p/ OpenTelemetry/loki quando houver
  múltiplos hosts. Backups: `pg_dump` no volume `revx_pgdata`
  (`docker compose exec db pg_dump -U revx revolution_x > backup.sql`).
- **HTTPS/Proxy**: o container escuta HTTP puro na 3000; TLS termina em
  nginx/traefik/Caddy à frente (não exponho 443 do app — padrão 3000).

## 7. Checklist — nada de negócio foi alterado

- [x] 0 arquivos de código existente modificados (só `.env.example` ampliado)
- [x] Mesmos comandos atuais: `npm run dev` / `npm run start` / `npm test` / `npm run build`
- [x] Nomes de variáveis preservados (`DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, …)
- [x] Sem dependência nova em `package.json` (npm ci com lockfile intacto)
- [x] Sem segredo em `Dockerfile`, `compose.*`, `.dockerignore` (só placeholders `${VAR}`)
- [x] RLS/multi-tenant intactos: o app continua fazendo `set_config` na transação (`src/lib/prisma.ts` inalterado)
- [x] Sem migration/DDL executado contra qualquer banco neste trabalho
- [x] Comportamento degradado-honesto preservado (503 quando falta env)
- [x] Portas mínimas: app sem porta publicada por padrão; 5432 opcional (dev)
