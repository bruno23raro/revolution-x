# REVOLUTION X — Guia do Iniciante

> **Para quem:** alguém que nunca tocou no projeto e quer entendê-lo e rodá-lo
> em ambiente local isolado, conectando as plataformas e escolhendo a conta em
> cada operação.
>
> **Princípio do guia:** nada aqui conecta a produção por acidente. O ambiente
> local usa um Postgres próprio (Docker) e um banco de teste isolado. Os passos
> que mexem em banco de produção, credenciais de plataforma ou DNS ficam
> claramente marcados como **PASSO HUMANO** e **não** devem ser executados sem
> autorização.
>
> Idioma: Português do Brasil. Se você travar, veja a seção 9 ("Pareceu complicado").

---

## 0. O que é o REVOLUTION X em uma frase

Um SaaS omnichannel que conecta as redes sociais / WhatsApp de uma organização
(a "tenant") e permite **publicar, agendar, disparar e acompanhar** conteúdo em
Facebook, Instagram, TikTok e WhatsApp — escolhendo **qual conta** em cada
operação quando existem várias.

---

## 1. Conceitos (depois de 1 minuto lendo)

| Termo | Significado simples |
|---|---|
| **Organização / tenant** | Um "inquilino" do SaaS. Cada empresa tem seus próprios dados, isolados dos outros (isolamento multi-tenant). |
| **Usuário** | Pessoa logada (via Supabase Auth). Pertence a 1 ou mais organizações. |
| **Conta de plataforma** | Ex.: a *Página do Facebook* da empresa, o *Instagram*, o *número do WhatsApp*, o *perfil TikTok*. Uma organização pode ter **várias** contas do mesmo tipo → "multicontas". |
| **Integração / conexão** | O "fio" que liga a organização a uma conta de plataforma (guarda o token criptografado no banco). |
| **Selector de conta** | O menu de escolha que aparece em cada operação quando há mais de uma conta conectada. |
| **Modo API oficial vs "Sem API / Avançado"** | Oficial = usa a API da plataforma (recomendado, seguro). Sem API = scraping/automação, com **aviso de risco** e **não executado em silêncio** pelo produto. |

---

## 2. Onde tudo vive (mapa do projeto)

```
app/                     → Telas (React/Next.js App Router)
  integrations/          → "Central de integrações": conecta Meta/TikTok/…
  facebook/ instagram/ tiktok/ whatsapp/   → Páginas de cada canal
  api/                   → Backend (rotas) que as telas chamam
src/integrations/        → Lógica das integrações
  meta/                  → Facebook + Instagram + WhatsApp (1 OAuth da Meta)
  tiktok/                → TikTok (OAuth PKCE + agendamento)
  providers.ts           → Catálogo de provedores (API oficial vs Sem API)
supabase/migrations/     → Migrações do lado Supabase (snake_case, ex.: 016)
migrations/              → Migrações do lado Postgres/Prisma (PascalCase, 001–013)
Dockerfile, compose.yaml → Ambiente local isolado (seção 4)
docs/                    → Este guia + relatório de prontidão
```

> **Duas camadas de banco:** o app usa Prisma/Postgres e Supabase. Mantêm o
> mesmo dado em dois formatos (PascalCase vs snake_case). Já documentado; não
> tente "harmonizar" as tabelas — trate-os como paires.

---

## 3. O que já está pronto e validado (resumo honesto)

- **Código + testes das telas e operações de multicontas:** pronto e verde
  (`tsc` 0 erros, `npm test` 578/578, `build` limpo, `lint` limpo).
- **Arquitetura de multicontas:**
  - *Meta (Facebook/Instagram/WhatsApp):* 4 "resolvers" que escolhem a conta
    pelo parâmetro `account`; sem `account`, usam a mais recente (determinístico).
  - *TikTok:* resolver multicontas + lista de contas + publicação escolhendo a conta.
  - *Telas:* um **menu de escolha de conta** aparece em cada formulário de
    publicação/disparo **somente quando há mais de uma conta**.
- **Ambiente local com Docker: VERIFICADO E RODANDO.** Neste computador o
  Docker **está instalado** (Docker 29.9.1, Compose v5.6.0, backend WSL2). O
  stack de teste isolado (seção 4) já foi subido e fica `healthy`:
  `db` (Postgres 17) + `app` respondendo em `http://localhost:3000`.
- **O que AINDA exige um passo humano (não dá para automatizar aqui):**
  - Aplicar a migração **016** **na produção Supabase** (aqui foi validada em
    um banco descartável; **não** aplicada à produção nem ao banco de teste
    principal).
  - Aprovações das plataformas (login, 2FA, CAPTCHA, permissões) e credenciais
    de servidor (Meta/TikTok/Resend/Supabase) — ficam fora do ambiente local.

---

## 4. Rodando o ambiente local (isolado) com Docker

> ✅ **Docker instalado neste computador.** Há duas variantes:
>
> - `compose.test.yaml` → **stack de TESTE isolado** (banco novo, sem Supabase).
>   É o que **está rodando agora** e foi validado.
> - `compose.yaml` / `compose.dev.yaml` → homologue/desenvolvimento, exige
>   credenciais de Supabase para autenticação funcionar.
>
> Neste Windows o CLI do Docker **não está no PATH do Git Bash**. Use o
> caminho completo antes de cada comando (uma vez por shell):
>
> ```bash
> export PATH="$PATH:/c/Users/Bruno/AppData/Local/Programs/DockerDesktop/resources/bin:/c/Users/Bruno/.docker/cli-plugins"
> # "docker" agora funciona; no PowerShell: $env:Path += ";C:\Users\Bruno\AppData\Local\Programs\DockerDesktop\resources\bin;C:\Users\Bruno\.docker\cli-plugins"
> ```

O ambiente usa um **Postgres local próprio**, com volume dedicado e rede
interna. **Nunca** aponte `DATABASE_URL` para a produção Supabase aqui.

### 4.1 Pré-requisito: um arquivo de ambiente local

- **Teste isolado (recomendado p/ começar):** `compose.test.yaml` lê
  `.env.docker.test` — banco 100% local, variáveis de Supabase **vazias**.
  Consequência honesta: páginas públicas e o banco funcionam; rotas que
  precisam de autenticação retornam **503** "Authentication service is not
  configured" (o guard fecha, não inventa login).
- **Homologação:** `.env` local (`POSTGRES_PASSWORD` só local). As variáveis de
  Supabase podem apontar para o Supabase de produção **para AUTENTICAÇÃO**; o
  banco (`DATABASE_URL`) continua sendo o Postgres local.

> Regra de ouro: autenticação pode usar o Supabase; **banco de dados nunca**.

### 4.2 Subir o stack de TESTE (o que está rodando agora)

```bash
# Subir (db Postgres 17 + app) — projeto isolado, volume revx_test_pgdata
docker compose -p revolution-x-test -f compose.test.yaml --env-file .env.docker.test up -d

# Ver status (db deve ser "healthy"; app "healthy" após ~1 min)
docker compose -p revolution-x-test -f compose.test.yaml --env-file .env.docker.test ps

# Abra no navegador: http://localhost:3000   (landing pública, sem login)

# Logs do app (NENHUM segredo é impresso; as variáveis ficam fora da imagem)
docker compose -p revolution-x-test -f compose.test.yaml --env-file .env.docker.test logs -f app

# Parar SEM perder dados (o volume revx_test_pgdata é mantido)
docker compose -p revolution-x-test -f compose.test.yaml --env-file .env.docker.test down

# Subir de novo (reaproveita o mesmo volume → dados preservados)
docker compose -p revolution-x-test -f compose.test.yaml --env-file .env.docker.test up -d
```

> 🚫 **NUNCA** rode `docker compose down -v`, `docker volume prune` ou
> `docker system prune` — apaga o banco local.

### 4.3 Banco local: esquema, destino e como ter um banco VAGO

O schema do app (Prisma) é aplicado com `prisma db push`, **só** no banco de
teste (publicado no host na porta **15432**, porque as portas 5432 do
computador já estão ocupadas por dois Postgres locais):

```bash
# Confirma para onde aponta (deve ser 127.0.0.1:15432, NÃO produção):
npx prisma db push --url "postgresql://127.0.0.1:15432/revolution_x"   # usuário/senha do .env.docker.test
```

**Banco 100% vazio, sem destruir o atual:** crie **outro projeto + outro
volume** (o nome do volume é derivado do projeto, então `-p` diferente já
isola):

```bash
# Novo banco em branco ao lado do existente (não toca no revx_test_pgdata)
docker compose -p revolution-x-test2 -f compose.test.yaml \
  -e revx_test_pgdata=revx_pgdata2 --env-file .env.docker.test up -d
```

> 📌 **Migração 016 (multicontas Meta):** aqui **não** foi aplicada ao banco
> de teste principal nem à produção; foi validada em um banco descartável
> (`meta016_test`) e documentada no `docs/FINAL_READINESS_REPORT.md`. Aplicar
> em produção é **PASSO HUMANO** (seção 8).

### 4.4 Homologação / desenvolvimento (exige credenciais de Supabase)

O **banco local** (Postgres do Docker) já funciona sozinho. Mas a **autenticação**
(register/login/escolha de org/CRM ao vivo) usa **apenas Supabase Auth** — sem um
projeto do Supabase, essas rotas fecham em `503 "Authentication service is not
configured"` (guard **fail-closed**, esperado). Para testar de verdade, crie um
**projeto do Supabase de DESENVOLVIMENTO** (NÃO reutilize o de produção) e aponte
o stack de teste para ele.

**Subir (o que está rodando agora):**

```bash
docker compose up -d            # db + job de migrate + app
docker compose -f compose.dev.yaml up -d   # dev com hot reload, porta 3000
docker compose ps && docker compose logs -f app
docker compose down            # mantém volume
```

**Variáveis que o CÍDIO lê (nome → finalidade; NUNCA cole os valores no chat):**

| Grupo | Variáveis | Finalidade | Quem fornece |
| --- | --- | --- | --- |
| **Supabase (projeto novo)** | `NEXT_PUBLIC_SUPABASE_URL` | URL pública do projeto (`https://<ref>.supabase.co`); exposta no navegador | **Você** cria o projeto |
| Supabase | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave **anon pública** (segura; RLS ainda se aplica) | **Você** copia no painel |
| Supabase | `SUPABASE_SERVICE_ROLE_KEY` | chave **service_role** (SECRETA; só no servidor; contorna RLS) | **Você** copia no painel |
| **Local (vocês definem)** | `POSTGRES_DB`/`POSTGRES_USER`/`POSTGRES_PASSWORD` | credenciais do Postgres do Docker | já estão em `.env.docker.test` |
| Local | `JWT_SECRET` | legado do caminho de auth via banco (não usado pelas rotas Supabase ao vivo) | opcional |
| Local | `META_TOKEN_ENCRYPTION_KEY` (≥32) | cifra os tokens OAuth em repouso (AES-256-GCM) | **Você** gera |
| Local | `CRON_SECRET` | protege `/api/cron/*` | **Você** define |
| **Plataformas (opcional)** | `META_APP_ID`/`META_APP_SECRET`/`META_WEBHOOK_VERIFY_TOKEN` | app de desenv. Meta p/ OAuth | Meta for Developers |
| Plataformas | `TIKTOK_CLIENT_KEY`/`TIKTOK_CLIENT_SECRET` | app de desenv. TikTok p/ OAuth PKCE | TikTok for Developers |
| E-mail | `EMAIL_PROVIDER`/`EMAIL_API_KEY`/`EMAIL_FROM` | envia e-mail real (Resend). Sem isso, o fluxo completa mas não envia (dev usa console) | Resend |
| IA (chat) | `OMNIROUTER_*` > `ANTHROPIC_*` > `OPENAI_*` | roteador do agente. Sem isso, chat mostra `routerConfigured:false` (honesto) | hPanel/servidor |

> **Restantes (vestigais — o código NÃO lê; podem ficar vazias):**
> `SESSION_SECRET`, `S3_*`, `REDIS_URL`, `WHATSAPP_ACCESS_TOKEN`,
> `WHATSAPP_PHONE_NUMBER_ID`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
> `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_KEY` (sem o prefixo `NEXT_PUBLIC`), `OPENAI_*`.

**Onde coloco cada valor (mantendo fora do versionamento):**

- No stack de **teste**: `.env.docker.test` (o `compose.test.yaml` lê `--env-file .env.docker.test`).
- O `.gitignore` já cobre `.env`, `.env.*` e `.env.local` → esses arquivos **não** entram no git.
  Confirme com `git status --porcelain .env.docker.test` (deve ficar **vazio**).
- **Nunca** imprima, cole no chat ou commit os valores.

**Aviso importante (esquemas):** `prisma db push` cria o schema do app em
**PascalCase** no Postgres local; as migrations oficiais (`supabase/migrations/`)
usam **snake_case** (`meta_integrations` + `provider` + `encrypted_access_token` + RLS).
São a **mesma tabela com colunas diferentes → NÃO são equivalentes.** O app lê
`meta_integrations` **via cliente Supabase com service_role** (snake), então num
projeto Supabase novo você **precisa aplicar as migrations SQL 005→016** (não
só `db push`). Ver seções 8 e o `docs/FINAL_READINESS_REPORT.md` §9.

---

## 5. Conectando as plataformas

### 5.1 Meta (Facebook + Instagram + WhatsApp) — 1 OAuth só
1. Vá em **/integrations** → "Conectar via OAuth" (Meta).
2. Autorize no Meta para Business. O app guarda **todas** as Páginas / contas
   que aparecerem (a partir da migração 016), não só a primeira.
3. Pronto: publicação no Facebook, no Instagram e disparo no WhatsApp usam a
   mesma conexão.

### 5.2 TikTok
- **Recomendado:** botão "Conectar via OAuth" em /integrations.
- O app usa **PKCE** (mais seguro) e guarda o token criptografado.
- Sem `TIKTOK_CLIENT_KEY/SECRET` no servidor, degrada honestamente com `503`.
- O access token expira em ~24 h: renove via a rota de refresh quando `tokenExpired` for `true`.

### 5.3 Outros provedores (n8n, Zapier, Make, webhook…)
- Cada um tem um formulário no hub de integrações com os campos que precisa.
- "API oficial" (chaves/webhook) é suportado; "Sem API" **apenas declara** o
  método + guarda o parâmetro + mostra um **aviso de risco** — a execução não
  oficial é **responsabilidade do usuário** e **não está implementada**.

---

## 6. Escolhendo a conta (multicontas)

- Com **1 conta** por canal: o seletor **não aparece** (fica mais simples).
- Com **2+ contas** do mesmo canal: aparece o menu **"Conta (publica nesta
  conta)"** no formulário de publicação/disparo.
- Sem escolher nada, o sistema usa a **mais recente** conectada
  ("Padrão (mais recente)").
- Cada operação aceita um parâmetro `account` no backend (`/api/*/publish`,
  `/api/whatsapp/send`…). Se a conta não existir → `409 account_not_found`.

> **Para haver várias contas Meta (ex.: 2 Páginas), a migração 016 precisa
> estar aplicada.** Antes dela, a 2ª conta do mesmo provedor é rejeitada pelo
> banco (único por organização/provedor).

---

## 7. Checklist para "estou pronto para começar"

- [ ] Rodei `npm test` e veio **578/578**.
- [ ] Rodei `npx tsc --noEmit` e veio **0 errors**.
- [ ] Rodei `npm run build` e veio **limpo**.
- [ ] Subi o stack de teste (seção 4.2) e o app respondeu em `http://localhost:3000`
      (`db` e `app` `healthy`).
- [ ] Criei/entrei numa organização e conectei uma plataforma (Meta via OAuth).
- [ ] Publiquei algo usando a conta (ou vi o seletor com 2+ contas).

---

## 8. Passos HUMANOS (exigem autorização; NÃO automáticos)

> O agente **para** exatamente nestes pontos: criar recursos externos, logar em
> conta real, 2FA, aprovar permissão ou tocar em produção. Ele **não** contorna
> nenhum desses. A seguir, o checklist de **iniciante** para liberar o teste
> **funcional ao vivo** (register/login/org/CRM + multicontas):

### H1. Criar um projeto do Supabase **de desenvolvimento** (não o de produção)
1. Abra `https://supabase.com/dashboard` → **New project** (canto superior direito).
2. Nome (ex.: `revolution-x-dev`), região próxima a você, e uma **senha de banco
   forte** (usada só para aplicar migrations; **não** commit).
3. Aguarde ~2 min. Anote a **URL** do projeto: `https://<ref>.supabase.co`
   → isto é o valor de `NEXT_PUBLIC_SUPABASE_URL`.

### H2. Aplicar as migrations SQL oficiais **neste novo projeto**
> **Atalho (2026-10-21):** a "caixa" pronta está em `supabase/dev_apply/`
> (`002a_supabase_base.sql` + `verify_dev.sql` + `apply_dev.sh`) e o passo a passo
> humano está em `docs/DEV_APPLY_HUMAN_GUIDE_2026-10-21.md`. Leia antes.
- **Dois planos, dois bancos:** Prisma(PascalCase)→Postgres **local Docker**
  (`prisma db push`, banco `revolution_x`); Supabase(snake_case)→projeto **DEV**,
  via SQL. **Nunca rode `prisma db push` no DEV** — ele só cria o formato Pascal.
- Para **multicontas Meta** o mínimo correto é a ordem
  **`002a(base) → 005 → 015 → 016`** (002a = o `002` da família A corrigido;
  005/015/016 em `supabase/migrations/`). Não use `006/007/008/009/014` no DEV
  (são ALTER de tabelas Pascal e falham num DEV vazio).
- **Por quê:** o app lê `meta_integrations` **via cliente Supabase com
  service_role** (snake_case + RLS). Cadeia já comprovada em banco descartável
  (2026-10-21): multi-conta coexiste, duplicado exato bloqueado, RLS ON.
- Pré-requisito humano: **definir a senha do Postgres do DEV** no dashboard
  (sem ela, `db query/push` falham com `PAM authentication`); depois exportar
  `SUPABASE_DEV_DB_URL` (senha por variável, nunca em chat/commit) e rodar
  `bash supabase/dev_apply/apply_dev.sh`.

### H3. Copiar as 3 chaves do Supabase → `.env.docker.test` (ficar sem versionar)
- Painel → **Project Settings** (⚙️) → **API**:
  - `URL` → `NEXT_PUBLIC_SUPABASE_URL`
  - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `service_role` (texto "USE WITH CAUTION", SECRETA) → `SUPABASE_SERVICE_ROLE_KEY`
- Coloque os 3 valores em `.env.docker.test` (teste) ou `.env.local` (dev).
- Confirme que ficou fora do git: `git status --porcelain .env.docker.test`
  → **deve imprimir nada**.
- **Nunca** imprima/cole os valores aqui ou no chat.

### H4. Confirmar o "fio" (leitura; sem efeito colateral)
1. `docker compose -p revolution-x-test -f compose.test.yaml --env-file .env.docker.test up -d`
2. `GET /api/health` → **200**.
3. Em `http://localhost:3000`: **Register** um usuário → o fluxo Supabase Auth
   funciona (as rotas de auth **não** mais dão 503).
4. **Login** → cria/lê a `Organization` + membership. Escolha/crie uma org.
5. CRM com banco "vazio" (só org criada) → CRUD de contatos/leads funciona.

### H5. (Opcional) Apps de desenvolvimento para OAuth real
- **Meta:** `developers.facebook.com` → My Apps → **Create App** (tipo
  *Business*) → `App ID` + `App Secret` → `META_APP_ID`/`META_APP_SECRET`.
  Adicione o produto *Facebook Login for Business*; configure a URI de
  redirecionamento OAuth = `http://localhost:3000/api/auth/callback/meta`.
- **TikTok:** `developers.tiktok.com` → crie um app → `Client Key`/`Secret`
  → `TIKTOK_CLIENT_KEY`/`TIKTOK_CLIENT_SECRET` (usa PKCE).

### O que NÃO é automático (requere login/2FA/painel real)
- Aprovações de plataforma (Meta/TikTok): envolve **login da sua conta + 2FA**.
- E-mail real: `EMAIL_PROVIDER=resend` + `EMAIL_API_KEY` + `EMAIL_FROM`.
- **Deploy / DNS / produção / cron** → autorização separada, **fora** deste guia.

---

## 9. "Pareceu complicado?" — retomada rápida

- **Só quero usar o app:** faça o OAuth em /integrations e publique. O
  seletor só aparece se você tiver várias contas.
- **Só quero rodar local:** seção 4.2 — `docker compose -p revolution-x-test
  -f compose.test.yaml --env-file .env.docker.test up -d` e abra `http://localhost:3000`.
- **Só quero entender multicontas:** leia as seções 1 e 6.
- **Só quero saber o que falta para produção:** leia o
  `docs/FINAL_READINESS_REPORT.md`.

---

## 10. Segurança — nunca faça isso

- Não usar `DATABASE_URL`/`DIRECT_URL` de produção como fallback de teste.
- Não imprimir/copiar segredos de `.env`, `.env.local`, tokens, chaves.
- Não enfraquecer RLS / multi-tenant para "fazer o teste passar".
- Não rodar `git reset --hard` / `git clean -fd` nem apagar volumes.
- Não executar migrations/DDL/reset **destrutivos** contra produção.
