# ARQUITETURA ATUAL — Revolution X

> Auditoria 2026-11-06. Descreve o sistema COMO ESTÁ, não como os documentos dizem que está.

## 1. Stack e processos

| Camada | Implementação |
|---|---|
| Framework | Next.js 14 App Router, TypeScript 5.4, Tailwind 3.4 |
| Auth | Supabase Auth (GoTrue) self-hosted/hPanel + tabela `public."User"` espelhada; sessões próprias (`Session`, tokenHash) em rotas custom |
| Banco | PostgreSQL 17 (Supabase Neon pooler em produção) |
| Acesso a dados | **três caminhos coexistindo**: Prisma 7 (`@prisma/adapter-pg`), Supabase JS (anon + service_role), `pg` SQL puro. Ver §4 — este é um dos principais riscos estruturais |
| Fila de jobs | `src/lib/taskQueue.ts` (fila persistida em Postgres via AgentMemory/Task) + `tick` disparado por cron HTTP. BullMQ/Inngest previstos mas nunca ligados (sem Redis) |
| Integrações | `src/integrations/**` com registry + adapters (Meta Graph v26, OpenBSP, TikTok, n8n/Zapier/Make outbound, scraper público com guarda SSRF) |
| Automação externa | n8n em Docker local (`n8n/workflows/WF-01..08`), API REST local 401 → executado via MCP cloud |
| IA | `src/ai/omniRouter.ts` (OpenAI-compatível, fallback chain). Dev: FreeLLMAPI :3001. Prod: OMNIROUTER_* no hPanel |
| Deploy | Hostinger Node.js, git integration (push → build → publish). CI GitHub Actions (build-and-test) em repo PÚBLICO |

## 2. Layout do código

```
app/                  páginas + API routes (71 rotas: 40 API + 31 páginas)
  api/auth/*          login, register, session, OAuth Meta (início), etc.
  api/oauth/callback/*  callbacks Meta (facebook/instagram/whatsapp/whatsapp-qr) — CAMINHO NOVO
  api/auth/callback/*   tiktok; meta foi DELETADA (sobrou só route.test.ts órfão)
  api/integrations/*    hub, config, health, openbsp (connect/callback/incoming), whatsapp-official
  api/webhooks/*        meta, openbsp, inbound (Zapier/Make), whatsapp/inbound
  api/whatsapp/*        send, templates, chatbot, qr, accounts
  integracoes/          hub canônico (/integrations e /hub-integracoes → 308)
src/
  integrations/         registry + adapters (meta/, openbsp/, tiktok/, whatsapp/, publicScraper)
  lib/                  auth, supabase/, taskQueue, encryption (AES-256-GCM), prisma
  ai/                   omniRouter
  jobs/                 tiktokScheduler (executor + cron multi-tenant)
  components/           UI (cards de integração, AppShell...)
prisma/schema.prisma    36 models
supabase/migrations/    cadeia SQL 005..027 + 20261104153012 (aplicação manual, fora do Prisma Migrate)
migrations/             (raiz) cadeia antiga 001..012 — legado morto conviviando com supabase/migrations
n8n/workflows/          8 workflows JSON
docs/                   ~60 documentos de execução/auditoria
```

Árvores duplicadas/órfãs que confundem o App Router: `src/app/scrapers/**` (5 páginas)
vs `app/scrapers/**` (1 página); `srcmodules/`, `graft/`, `routes/` (vazio), `db/`, `data/`
vazios; ~50 diretórios `.claude|.codex|.cursor-style...` de ferramentas de agentes commitados.

## 3. Fluxo de uma requisição

Browser → Next (Hostinger :3000 atrás de proxy) → `middleware.ts` (gate de sessão) →
page/API route → `getAuthenticatedUser()` → Supabase GoTrue valida JWT → resolve
membership (organizationId, role) → camada de dados.

Camada de dados (inconsistente):
- Rotas novas (v2): `createServiceRoleClient()` (SUPABASE_SERVICE_ROLE_KEY) ou
  `withUserContext()` Prisma com `set_config('app.current_org', ...)` + RLS.
- Repos antigos (crmRepoReal): filtro `where` explícito com BYPASSRLS.
- Efeito: **onde não há policy RLS, o isolamento depende 100% do código da rota**.

## 4. Riscos estruturais (detalhados em PROBLEMAS_E_BLOQUEIOS.md)

1. **Três caminhos de acesso a dados** sem fronteira clara (Prisma / Supabase anon+RLS /
   service_role). Service_role silencia RLS; com policies faltando, um esquecimento de
   `where organizationId` vaza dados entre tenants.
2. **Cadeia de migrations fora do Prisma Migrate** (`_prisma_migrations` com 2 linhas vs
   24 arquivos SQL aplicados à mão em produção). Reconciliação manual é o estado permanente.
3. **Duas gerações de fluxo OAuth Meta coexistindo** (auth/callback/meta deletada;
   oauth/callback/* nova sem ligação com o init; flag ENABLE_META_OAUTH off).
4. **Credenciais no repo público** (ver PROBLEMAS_E_BLOQUEIOS.md C-1) — incl. senha do
   banco de produção e chave de criptografia de tokens OAuth.
5. Estado de verificação documentado ("833/833", "RLS em todas as tabelas") **não bate**
   com o estado real medido hoje (822 testes, 1 falha, tsc 2 erros; RLS forçado em 5/41).

## 5. Escalabilidade / multi-tenancy (avaliação)

- **Multiempresa**: modelo correto (Organization + OrganizationMember + role). Isolamento
  técnico em produção é frágil (policies ausentes — ver C-2).
- **Assinaturas/planos**: schema existe, lógica não existe. Sem gating por plano, qualquer
  tenant usa tudo. Precisa decisão de produto antes de implementar.
- **Processamento assíncrono**: fila em Postgres + cron HTTP funciona para dezenas de
  tenants; para centenas, o tick multi-tenant serializado vira gargalo e não há worker
  dedicado. Redis/BullMQ continua a saída natural (TickDeps já é o ponto de extensão).
- **Webhooks**: Meta (assinatura HMAC + claim idempotente), OpenBSP incoming (verify_token),
  inbound genérico (secret). Caminho ok; sem DLQ/retry observável além do n8n WF-02.
- **Logs/monitoramento**: console + `admin_alerts` + n8n WF-04 (5xx → WhatsApp admin).
  Sem APM, sem persistência de logs de aplicação no Hostinger (arquivos locais de log na
  raiz do repo são evidência disso).
- **Segurança de tokens**: AES-256-GCM em repouso (bom). Rotação de tokens Meta via
  refresh existe por conta. Mas a CHAVE de criptografia está num arquivo versionado em
  repo público → o desenho criptográfico está comprometido enquanto não rotacionada.
- **Custo de infra**: Supabase (pooler) + Hostinger + Docker local (n8n/SearXNG/FreeLLMAPI)
  — baixo custo atual; o risco é operacional, não financeiro.
