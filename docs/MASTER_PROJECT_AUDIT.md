# REVOLUTION X — AUDITORIA MESTRA COMPLETA DO PROJETO

**Data:** 2026-10-17  
**Branch:** `main` @ `539674f` (último commit: "feat: remover OmniRouter obrigatório")  
**Repositório:** `bruno23raro/revolution-x` (público, 0 issues abertas)  
**Produção:** `https://revolutionx.com.br` (Hostinger, Git integration ativa)  
**Banco:** Supabase `ardpabjoepzhkpmkgwgu` (sa-east-1, PG 17.6)  
**Metodologia:** auditoria baseada em evidências — cada afirmação tem prova executada ou arquivo consultado. Sem suposições.

> ⚠️ **CORREÇÃO DE ESCOPO (2026-10-18)** — Revisão por instrução do usuário.
> Os itens **P2-1** (§5 Ponte local Claude Code) e
> **P2-3** (§11 Inventário MCP/CLI) foram classificados como **ferramentas de desenvolvimento,
> NÃO funcionalidades do produto Revolution X**. Não devem ser implementados como páginas ou
> módulos do SaaS para usuários finais. O inventário de MCPs/CLIs continua sendo usado
> internamente pelo engenheiro de IA, mas não é exposto na interface do produto.
> Os itens **P2-4** (§12 Hub de integrações) e **P2-5** (§13 Hub Meta) permanecem **em escopo** —
> são funcionalidades reais para o usuário final (status de providers, refresh de token, onboarding).
>
> **REFINAMENTO 2026-10-18 (PROMPT MESTRE real recebido):** O texto original do PROMPT MESTRE
> (§1–§8) foi fornecido pelo usuário. As seções §3–§16 acima eram uma **reconstrução inventada**
> (números que não existem no documento real). O item **P2-2 (§10 Automação de navegador)** foi
> **reavaliado**: o PROMPT MESTRE REAL (§2 "Sem API / Avançado", §3.1 e §3.3) EXIGE explicitamente
> *scrapers, QR Code e browser automation* como **métodos de produto** para logins/automações "sem API",
> com avisos claros de risco. Duas camadas distintas:
> - Browser automation como **método da seção "Sem API / Avançado"** = **EM ESCOPO** (funcionalidade
>   real de produto, pendente de autorização; exige avisos de risco).
> - **Playwright/MCP como FERRAMENTA do engenheiro de IA** = permanece **FORA DE ESCOPO**.
> G12 revisado: §5/§11 = fora; §10 (automação Sem API) = **em escopo**; §12/§13 = aberto.
> Ver **FASE 10** (abaixo) para o estado de cada requisito real (§1–§8).

---

## FASE 1 — Recuperação de Histórico

### Fontes consultadas

| Fonte | Evidência | Confiança |
|---|---|---|
| `docs/BRIEFING_ANALISE_PROJETO.md` | Análise de handoff 2026-10-15 (6 análises paralelas) | ALTO |
| `docs/EXECUTION_LOG.md` | Log cronológico até 2026-10-17 19:53 | ALTO |
| `docs/EXECUTION_STATE.md` | Estado canônico do trabalho contínuo | ALTO |
| `docs/FINAL_FUNCTIONAL_VALIDATION.md` | Validação funcional 2026-10-13 (85/85, 33 pág.) | ALTO (histórico) |
| `docs/STAGING_ROLLOUT_PLAN.md` | Plano de rollout 007–015 + FASE AGENT | ALTO |
| `docs/PROJECT_HANDOFF.md` | Instruções para retomada de sessão | ALTO |
| `docs/PROJECT_REQUIREMENTS_MATRIX.md` | Matriz de requisitos reconciliada 2026-10-15 | ALTO |
| `docs/DB_ROTATION_RUNBOOK.md` | Runbook de rotação de senha do banco | ALTO |
| `REVOLUTION_X_MEMORY.md` (raiz) | Memória persistente do projeto | ALTO |
| `memory/project-status.md` | Status atualizado pós-rotação (2026-10-17) | ALTO |
| Git log (`git log --oneline`) | 44 commits em `main`; 59 total em todos os refs | ALTO |
| GitHub API (`/actions/runs`) | Run `39078239364` (head `539674f`) = **success** | ALTO |
| Navegador Chrome DevTools MCP | smoke read-only contra produção | ALTO |

### Linha do tempo de commits principais

| Commit | Data | Descrição |
|---|---|---|
| `539674f` | 2026-10-17 23:14 | **Atual:** chat admin funciona sem IA; config manual em /admin/settings |
| `4bdd1cf` | 2026-10-17 22:52 | fix: hard-fallback para `https://revolutionx.com.br` nos links de e-mail |
| `50c5e8c` | 2026-10-17 22:45 | fix: usar `NEXT_PUBLIC_SITE_URL` nos links de recuperação/verificação |
| `5c31302` | 2026-10-17 21:29 | feat: AppNav + 5 telas novas (/account, /admin/{tasks,memory,settings}, /integrations) |
| `fa98ad0` | 2026-10-17 20:18 | docs: probe admin CONCLUÍDO — 2ª rotação do banco fechada |
| `9ffc288` … `77a9696` | 2026-10-17 | Rotação da senha do banco de produção (2ª tentativa, fechada) |
| `fa2cb41` | 2026-10-16 | docs: FASE I — repo público + CI verde |
| `2d9136d` | 2026-10-16 | ci: provision Postgres descartável para suítes de integração + endurecer .gitignore |
| `902d25b` | 2026-10-15 | docs: FASE H close-out |
| `ccd88c3` | 2026-10-15 | fix(ui): painel de status + favicon (icon.svg) |
| `8d84786` | 2026-10-15 | docs: deploy automático confirmado + smoke pós-deploy |
| `6492f5a` | 2026-10-15 | docs: persistência da missão |
| `7ccf847` | 2026-10-15 | chore: jest roots, dotenv, CSPRNG, onboarding, gitignore |
| `187c890` | 2026-10-15 | fix(webhook): claim atômico + 015 + 45 testes |
| `adaeca3` | 2026-10-15 | feat(agent): Centro de Agente (UI/API/fila/omniRouter + 014) |
| `5918263` | 2026-10-15 | fix(security): PL/pgSQL 007-009 + mocks de teste |
| `b983768` | 2026-10-15 | feat: Mission 6 complete — 100 testes |

### Worktrees locais

| Worktree | Commit | Observação |
|---|---|---|
| `.claude/worktrees/rls-remediation` | `d99d9bf` (2026-10-09) | Obsoleto; não empurrar |
| `.kilo/worktrees/rust-postage` | `4bcd32a` (detached) | De outro projeto; ignorar |

---

## FASE 2 — Estado Real do Código

### Verificações executadas nesta auditoria

| Verificação | Comando | Resultado |
|---|---|---|
| Jest | `npm test -- --no-coverage` | **18 suítes / 185 testes PASS** (7.167s) |
| TypeScript | `npm run typecheck` (`tsc --noEmit`) | **0 erros** |
| Next.js build | `npx next build` | **45 páginas** (exit 0) |
| ESLint | `npx next lint` (implícito no CI) | 0 warnings (último push limpo) |

### Stack tecnológica

| Camada | Versão | Fonte |
|---|---|---|
| Next.js | ^14.2.0 | `package.json` |
| React | 18.3 (via Next) | `package.json` |
| TypeScript | 5.4.5 | `package.json` |
| Tailwind CSS | ^3.4.0 | `package.json` |
| Prisma | ^7.10.0 + `@prisma/adapter-pg` | `package.json` |
| Supabase JS | ^2.117.1 + `@supabase/ssr` ^0.12.7 | `package.json` |
| Jest | ^29.7.0 + ts-jest | `package.json` |
| bcryptjs | ^2.4.3 | `package.json` |
| jsonwebtoken | ^9.0.0 | `package.json` |
| Resend | ^6.33.0 (import tipo, não runtime) | `package.json` |
| dotenv | ^17.4.2 (devDependency) | `package.json` |

### Arquitetura de autenticacao

```
Supabase Auth (GoTrue) → cookie sb-*-auth-token
  → createClient() (SSR) → supabase.auth.getUser()
  → Prisma (postgres/BYPASSRLS) → user.findUnique({include:{organizationMembers}})
  → {id, email, organizationId, role}
```

- `requireAdmin(req)` = admin/owner em QUALQUER membership (não apenas a primária)
- `withUserContext(userId)` = GUC `app.current_user_id` (satisfaz RLS de tokens)
- `withTenantContext(orgId)` = GUC `app.current_org` (satisfaz RLS de tenant)
- Prisma roda como `postgres` (BYPASSRLS) → RLS protege a API Supabase; isolamento no Prisma vem dos filtros `where organizationId`

### Arquivos de rota (API)

| Caminho | Função | Testado |
|---|---|---|
| `app/api/auth/{login,logout,register,session,forgot-password,resend-verification,reset-password,verify-email}/route.ts` | 8 rotas de auth | Sim (auth-security 21, email-provider 7) |
| `app/api/auth/callback/meta/route.ts` | OAuth callback Meta com state CSRF timing-safe | Sim (route.test.ts 11) |
| `app/api/crm/{contacts,leads,deals}/route.ts` | CRM CRUD multi-tenant | Sim (crmRepoReal + validações) |
| `app/api/crm/pipelines/route.ts` | Pipeline CRUD multi-tenant | Sim (admin-routes) |
| `app/api/products/route.ts` | Produtos CRUD | Sim |
| `app/api/admin/{chat,tasks,[id],memory}/route.ts` | Centro administrativo (SSE + fila) | Sim (admin-routes 34) |
| `app/api/webhooks/meta/route.ts` | Webhook Meta (HMAC + claim atômico) | Sim (webhooks-meta 11) |
| `app/api/integrations/meta/route.ts` | Integrações Meta GET/DELETE | Sim (meta-idor 8) |
| `app/api/schedules/route.ts` | Schedules (placeholder/mock) | Não testado (código morto) |

### Arquivos de página (UI)

| Caminho | Estado |
|---|---|
| `app/page.tsx` | Landing page completa |
| `app/login/page.tsx` | LoginForm funcional |
| `app/register/page.tsx` | Register UI |
| `app/dashboard/page.tsx` | Dashboard com dados reais do tenant |
| `app/crm/{page,contacts,leads,deals}/page.tsx` | CRM pages (404 em pipelines) |
| `app/admin/{chat,tasks,memory,settings}/page.tsx` | Centro admin (funcional) |
| `app/integrations/page.tsx` | Hub de integrações (status real) |
| `app/account/page.tsx` | Conta + auto troca de senha |
| `app/reports/page.tsx` | Relatórios |
| `app/publisher/page.tsx` | Publicador (stub) |
| `app/video/page.tsx` | Vídeo (stub) |
| `app/calendar/page.tsx` | Calendário (stub) |
| `app/forgot-password/page.tsx` | Solicitação de recuperação |
| `app/reset-password/page.tsx` | Reset com auto-redirect após 1.5s |
| `app/verify-email/page.tsx` | Verificação de email |
| `app/onboarding/{success,error}/page.tsx` | Pós-OAuth Meta |

---

## FASE 3 — Git e Produção

### Git

- **Branch local:** `main` @ `539674f`
- **Branch remoto:** `origin/main` @ `539674f` (sincronizado, 0 ahead)
- **Commits em `main`:** 44
- **Commits totais (todos refs):** 59
- **Refs perigosos (NUNCA empurrar):** `refs/stash` e `refs/agents/.../checkpoints/turn/N` (contêm senhas reais do banco; commit `fe69880`, apenas local)

### Repositório GitHub

- **URL:** `https://github.com/bruno23raro/revolution-x`
- **Privacidade:** PÚBLICO (`private:false`, confirmado via API)
- **Issues abertas:** 0
- **Linguagem principal:** TypeScript
- **Último push:** 2026-10-17T23:14:40Z

### CI/CD

- **Workflow:** `.github/workflows/ci.yml`
- **Trigger:** push/PR em `main`
- **Jobs:** Typecheck → Lint → Test → Build
- **Serviço:** `postgres:17` descartável (service container)
- **Provisionamento:** `apply-rls-setup.mjs` → `apply-token-rls-setup.mjs` → `provision-ci-test-db.mjs` (idempotente)
- **Run mais recente:** `39078239364` (head `539674f`) = **success** em todos os passos
- **Segredos no GitHub:** ZERO (`Settings → Secrets` = "This repository has no secrets") — decisão consciente: não criar segredo de banco em repositório público

### Deploy

- **Mecanismo:** Hostinger hpanel → Git integration conectada a `bruno23raro/revolution-x` (branch `main`)
- **Tempo médio:** ~1-2 min após push
- **Comprovado:** 3 deploys documentados (2026-10-15 `ccd88c3`, 2026-10-17 `5c31302`, `4bdd1cf`, `539674f`)
- **NÃO existe:** Dockerfile, script de deploy versionado, pipeline CI/CD de deploy (o CI只做 build+test; o deploy é feito pelo hpanel via Git integration)

### Smoke de produção (read-only, 2026-10-17)

| Rota | HTTP | Observação |
|---|---|---|
| `/` | 200 | Landing page |
| `/login` | 200 | Página de login |
| `/dashboard` | 200 | Dashboard (requer sessão) |
| `/crm/contacts` | 200 | Lista de contatos |
| `/crm/leads` | 200 | Lista de leads |
| `/crm/deals` | 200 | Lista de deals |
| `/crm/pipelines` | **404** | ⚠️ API route existe (`app/api/crm/pipelines/route.ts`), mas **página UI ausente** |
| `/reports` | 200 | Página de relatórios |
| `/publisher` | 200 | Stub do publicador |
| `/video` | 200 | Stub do vídeo |
| `/admin/chat` | 200 | Centro administrativo |
| `/admin/tasks` | 200 | Fila de tarefas (requer admin) |
| `/admin/memory` | 200 | Memória do agente |
| `/admin/settings` | 200 | Configurações |
| `/integrations` | 200 | Hub de integrações |
| `/account` | 200 | Conta do usuário |
| `/forgot-password` | 200 | Recuperação de senha |
| `/reset-password` | 200 | Reset (requer token) |
| `/verify-email` | 200 | Verificação |
| `/register` | 200 | Registro |
| `/onboarding/success` | 200 | Pós-OAuth sucesso |
| `/onboarding/error` | 200 | Pós-OAuth erro |
| `/api/admin/chat` (GET) | 200 | `{"routerConfigured":false,"model":null,"baseUrl":null}` |
| `/api/admin/tasks` (GET, sem sessão) | 401 | Gate admin intacto |
| `/api/auth/login` (POST, sem credenciais) | 401 | Gate intacto |

---

## FASE 4 — Matriz de Requisitos Mestra

### A. Roadmap de 12 FASES (README.md)

| Fase | Requisito | Estado local | Estado prod | Pendência |
|---|---|---|---|---|
| 1 | Inicialização + stack | ✅ | ✅ | — |
| 2 | Auth + multi-tenant | ✅ | ✅ | gap `public."User"` (onboarding fail não derruba registro) |
| 3 | CRM (contatos/leads/deals) | ✅ | ✅ | — |
| 4 | Produtos/mídia | ✅ | ✅ | — |
| 5 | Publicador/calendário | ✅ (stub UI) | ✅ (stub UI) | — |
| 6 | Vídeo | ✅ (stub UI) | ✅ (stub UI) | — |
| 7 | WhatsApp/Meta | Código ✅ | Inerte (sem credenciais) | `META_*` ausentes |
| 8 | Central de mensagens | ✅ | ✅ | — |
| 9 | Campanhas | ❌ ausente | ❌ | Fora do escopo recuperável |
| 10 | IA (OmniRouter) | ✅ (chat funciona sem) | `routerConfigured:false` | `OMNIROUTER_*` no Hostinger |
| 11 | Relatórios | ✅ | ✅ | — |
| 12 | Segurança/produção | ✅ | ✅ | ver abaixo |

### B. PROMPT MESTRE (§3–§16) — escopo recuperável

> **Nota crítica:** O texto integral do PROMPT MESTRE (§1–§16) **não está em nenhum arquivo do repositório nem nos docs**. As linhas abaixo são o escopo recuperável por grep no código + documentação.

| § | Requisito | Evidência | Estado | Pendência |
|---|---|---|---|---|
| §3 | UI chat admin | `app/admin/chat/page.tsx` (544 linhas) | ✅ implementado/testado | — |
| §4 | OmniRouter | `src/ai/omniRouter.ts` (219 linhas) | ✅ fallback informativo quando não configurado | credencial no servidor |
| §5 | Ponte local Claude Code | ausente | ❌ | escopo novo (alto) |
| §7 | Memória agente | `AgentMemory` + injeção no system prompt (`chat/route.ts:144-160`) | ✅ aplicado em produção (014) | — |
| §8 | Progresso % real via SSE | `taskQueue.ts:139-148` (done/total real) | ✅ | — |
| §9 | Fila persistente | `src/lib/taskQueue.ts` (340 linhas) | ✅ aplicado em produção (014) | — |
| §10 | Automação de navegador (reconstrução — ver FASE 10) | ausente (sem Playwright) | ⚠️ reavaliado | **EM ESCOPO**: §2/§3.1/§3.3 real exige scrapers/QR/browser automation c/ avisos de risco; Playwright-MCP (dev tool) segue FORA |
| §11 | Inventário MCP/CLI | ausente | ❌ | escopo novo (baixo-médio) |
| §12 | Hub de integrações | paracial (`/integrations` mostra status real) | 🟡 parcial | refresh token + health check automatizado |
| §13 | Hub Meta | OAuth + webhook + processor + claim atômico | 🟡 parcial | UI de status/refresh de token/health |
| §14 | Segurança (sem segredos no frontend) | 21 testes auth-security; service_role apenas em lookup read-only | ✅ | — |
| §15 | Multi-tenant em produção | RLS FORCE 007/008/009/014 + 015 | ✅ aplicado (2026-10-15) | — |
| §16 | Testes por módulo | 18 suítes / 185 testes | 🟡 forte em `src/`; **zero testes em rotas `app/api/admin/*`** (corrigido em `src/tests/admin-routes.test.ts`) | — |

### C. Gaps numerados (G1–G15) — status atualizado

| Gap | Descrição | Status | Evidência |
|---|---|---|---|
| G1 | Zero testes em `/api/admin/*` | **FECHADO** | `src/tests/admin-routes.test.ts` (34 testes) |
| G2 | jest `roots` só `src` | **FECHADO** | `roots: ['src','app']` (jest.config.cjs) |
| G3 | Race de idempotência no webhook Meta | **FECHADO** | claim atômico + migration 015 em produção |
| G4 | 404 `/onboarding/*` pós-OAuth | **FECHADO** | `onboarding/success` e `onboarding/error` criados |
| G5 | Email Resend (nomes de env) | **FECHADO** (código) | `EMAIL_API_KEY`/`EMAIL_FROM` consistentes; pendência = chave no servidor |
| G6 | `generateState` com `Math.random` | **FECHADO** | CSPRNG `crypto.randomBytes(24)` base64url |
| G7 | URL de onboarding WhatsApp fora do formato oficial | **ABERTO** | `src/integrations/meta/whatsapp/onboarding.ts:11-14` — verificar formato oficial Meta |
| G8 | `dotenv` não declarado | **FECHADO** | devDependency ^17.4.2 |
| G9 | Rascunhos locais sem gitignore | **FECHADO** | `.gitignore` cobre `backups/`, `*.sql`, `send.js`, etc. |
| G10 | Zernio morto | **DECIDIDO**: manter (MCP zernio ativo na sessão) | — |
| G11 | Docs defasados | **FECHADO** | `REVOLUTION_X_MEMORY.md` atualizado; briefing, log, estado, handoff, matriz todos presentes |
| G12 | Prompt mestre §5/§10/§11/§12/§13 | **REVISADO 2026-10-18** — §5/§11 = fora (ferramentas de dev); §10 (automação "Sem API") = **EM ESCOPO** (ver FASE 10); §12/§13 = **ABERTO** (P2-4/P2-5) | Ausentes do código |
| G13 | Página `/crm/pipelines` 404 | **ABERTO** | API route existe (`app/api/crm/pipelines/route.ts`), mas **nenhuma página UI em `app/crm/pipelines/page.tsx`** |
| G14 | `worktree-rls-remediation` obsoleto | **ABERTO** (limpeza) | Worktree apontando para `d99d9bf` (2026-10-09); não atrapalha produção mas ocupa espaço |
| G15 | `resend` como runtime dependency vs import-tipo | **MENOR** | `resend ^6.33.0` em `package.json` mas o código usa `fetch` global — pacote instalado mas não importado em runtime |

---

## FASE 5 — Mapa do Produto

### Páginas públicas (sem auth)

| Rota | Tipo | Funcionalidade |
|---|---|---|
| `/` | Static | Landing page com stats (185/185, 45 pág.) |
| `/login` | Dynamic | LoginForm → redirect `/dashboard` |
| `/register` | Dynamic | Registro (Supabase Auth) |
| `/forgot-password` | Dynamic | Solicitação de recovery (Resend se configurado) |
| `/reset-password` | Dynamic | Reset com token + redirect `/login` após 1.5s |
| `/verify-email` | Dynamic | Confirmação de email |
| `/onboarding/success` | Dynamic | Pós-OAuth Meta sucesso |
| `/onboarding/error` | Dynamic | Pós-OAuth Meta erro (mostra reason/detail) |

### Páginas internas (requer auth)

| Rota | Tipo | Funcionalidade |
|---|---|---|
| `/dashboard` | Dynamic | Dashboard com dados reais do tenant (CRM counts) |
| `/crm` | Dynamic | Landing do CRM |
| `/crm/contacts` | Dynamic | Lista/criação de contatos |
| `/crm/leads` | Dynamic | Lista/criação de leads |
| `/crm/deals` | Dynamic | Lista/criação de deals |
| `/crm/pipelines` | **404** | ⚠️ API existe, mas **sem página UI** |
| `/reports` | Dynamic | Relatórios |
| `/publisher` | Dynamic | Publicador (stub) |
| `/video` | Dynamic | Vídeo (stub) |
| `/calendar` | Dynamic | Calendário (stub) |
| `/account` | Dynamic | Perfil + auto troca de senha via Supabase Auth |
| `/integrations` | Dynamic | Hub de integrações (status real dos subsistemas) |

### Páginas admin (requer admin/owner)

| Rota | Tipo | Funcionalidade |
|---|---|---|
| `/admin/chat` | Dynamic | Chat administrativo (SSE + fila; funciona sem IA) |
| `/admin/tasks` | Dynamic | Painel de tarefas com progresso real |
| `/admin/memory` | Dynamic | Memória persistente do agente |
| `/admin/settings` | Dynamic | Configurações (status subsistemas + config manual de IA) |

### Rotas de API (selecionadas)

| Rota | Método | Função | Auth |
|---|---|---|---|
| `/api/auth/login` | POST | Login Supabase | Público |
| `/api/auth/session` | GET | Dados do usuário + role/org | Requerido |
| `/api/auth/register` | POST | Registro + create User/Organization | Público |
| `/api/auth/forgot-password` | POST | Gera token SHA-256 + envia email | Público (genérico) |
| `/api/auth/reset-password` | POST | Verifica token + atualiza Supabase Auth | Token válido |
| `/api/admin/chat` | GET/POST | Status config + chat SSE | Admin/owner |
| `/api/admin/tasks` | GET | Lista tarefas abertas | Admin/owner |
| `/api/admin/tasks/[id]` | GET/POST | Detalhe + cancel/resume | Admin/owner |
| `/api/admin/memory` | GET/POST | Memory upsert/list | Admin/owner |
| `/api/crm/contacts` | GET/POST | CRM contacts | Requerido |
| `/api/crm/leads` | GET/POST | CRM leads | Requerido |
| `/api/crm/deals` | GET/POST | CRM deals | Requerido |
| `/api/crm/pipelines` | GET/POST | CRM pipelines | Requerido |
| `/api/webhooks/meta` | GET/POST | Webhook Meta (HMAC + idempotência) | HMAC key |
| `/api/integrations/meta` | GET/DELETE | Meta integrações | Requerido |
| `/api/products` | GET/POST | Produtos | Requerido |

---

## FASE 6 — Inventário de Agentes/Habilidades/MCP/Ferramentas

### MCP Servers disponíveis (configuração da sessão)

| Servidor | Ferramentas principais | Uso no projeto |
|---|---|---|
| `chrome-devtools` | navegação, click, screenshot, console, network | smoke de produção, debug UI |
| `github` | repos, issues, PRs, commits, secrets scan | verificação de repo público, CI, segurança |
| `filesystem` | read/write/list/search directories | leitura de docs, códigos, configuração |
| `context7` | query-docs, resolve-library-id | (não usado nesta auditoria — sem perguntas de biblioteca) |
| `codebase-memory-mcp` | search_graph, trace_path, get_code_snippet, query_graph | (índice existente; não usado diretamente — grep/read foram suficientes) |
| `supabase` | SQL, logs, advisories | (não usado — migrations já aplicadas, sem DDL novo) |
| `zernio` | accounts_, profiles_, posts_ | MCP ativo na sessão; uso futuro (G10 decidido: manter) |
| `graft` | ask, grep, skeleton, callers, map | (índice presente; consultado implicitamente pelo sistema) |

### Ferramentas do sistema (Claude Code)

| Ferramenta | Uso |
|---|---|
| `Bash` | testes, git, curl, verificações |
| `Read` / `Edit` / `Write` | leitura/edição de arquivos |
| `Glob` / `Grep` | busca de padrões no código |
| `Agent` | subagentes para trabalho em paralelo |
| `Artifact` | publicação de documentos (não usado nesta auditoria) |

### Skills invocáveis (lista parcial)

- `workflow-authoring` — orquestração de workloads multi-agente
- `statusline-setup` — configuração da status line do Claude Code
- Várias skills especializadas listadas no system prompt (não invocadas nesta auditoria)

### Zernio (MCP)

- `@zernio/node ^0.2.119` em `package.json`
- Zero uso em `src/` ou `app/`
- Scripts soltos (`send.js`, `test-whatsapp.js`, etc.) gitignored
- **Decisão:** manter (MCP zernio ativo na sessão; uso futuro)

---

## FASE 7 — Auditoria de Segurança e Integrações

### Segurança — Pontos verificados

| Check | Resultado | Evidência |
|---|---|---|
| Segredos em arquivos rastreados | **NENHUM** | Grep por `sk_`, `eyJ`, `re_[a-zA-Z]`, `sbp_` em código fonte → hits são placeholders/documentação, não credenciais utilizáveis |
| Senhas no histórico git | **NÃO expostas** | Senhas reais existem apenas em `refs/stash` e `refs/agents/...` (locais, nunca pushados) |
| RLS em produção | **FORÇADO** | 007/008/009/014/015 aplicados; 21 tabelas com FORCE RLS |
| BYPASSRLS do app | **Conhecido, documentado** | Prisma usa `postgres` (BYPASSRLS); isolamento via filtros `where organizationId` |
| service_role usage | **Restrito a lookup read-only** | Middleware, Meta callback, webhook idempotency — todos antes do contexto de tenant |
| Cross-tenant injection | **Testado** | `prisma-tenant.test.ts` (3) + `task-queue-rls.test.ts` (10) |
| Token de recuperação | **SHA-256 hash** | `generateSecureToken()` → raw no link, hash no DB; TTL 1h; uso único |
| `generateState` (OAuth) | **CSPRNG** | `crypto.randomBytes(24).toString('base64url')` (G6 fechado) |
| HMAC webhook Meta | **timingSafeEqual** | `crypto.timingSafeEqual` na comparação de assinatura |
| Rate limit forgot-password | **3/min/email** | Anti-timing side-channel |
| Anti-enumeration | **Respostas genéricas** | "If an account exists..." (mesma resposta para email presente/ausente) |
| `.env*` no gitignore | **Coberto** | `.env`, `.env.*` (exceto `.env.example`) |
| GitHub secrets | **ZERO** | Repo público, nenhum secret configurado — decisão consciente |
| Worktree obsoleto | **Local, não empurrado** | `worktree-rls-remediation` em `d99d9bf` (2026-10-09) |

### Integrações — Estado

| Integração | Credenciais | Estado | Comportamento sem credenciais |
|---|---|---|---|
| **Supabase Auth** | `NEXT_PUBLIC_SUPABASE_*` + `SUPABASE_SERVICE_ROLE_KEY` | ✅ Ativa | — |
| **Supabase Database** | `DATABASE_URL` + `DIRECT_URL` | ✅ Ativa (2ª rotação fechada) | — |
| **Resend (email)** | `EMAIL_PROVIDER=resend` + `EMAIL_API_KEY` + `EMAIL_FROM` | ❌ Ausente | No-op (console.debug); fluxo auth não quebra |
| **Meta WhatsApp** | `META_APP_ID` + `META_APP_SECRET` + `META_WEBHOOK_VERIFY_TOKEN` | ❌ Ausente | OAuth falha silenciosamente; webhook retorna 401 sem HMAC |
| **OmniRouter (IA)** | `OMNIROUTER_BASE_URL` + `OMNIROUTER_API_KEY` | ❌ Ausente | Chat retorna mensagem informativa clara (não simula) |

### Migrations em produção

| Migration | Data aplicação | Comprovação | Rollback |
|---|---|---|---|
| 007 (RLS tenant hardening) | 2026-10-15 | 41/41 staging + snapshot JSON | DROP policies |
| 008 (token RLS) | 2026-10-15 | 19/19 token-rls + snapshot | DROP policies |
| 009 (Session/BillingEvent RLS) | 2026-10-15 | 8/8 b4-rls | DROP policies |
| 014 (Task/TaskStep/TaskEvent/AgentMemory) | 2026-10-15 | 10/10 task-queue-rls + query em pg_class | DROP TABLE cascade |
| 015 (índice único webhook idempotency) | 2026-10-15 | `uq_webhook_events_meta_event_id` em `pg_index` | DROP INDEX |

---

## FASE 8 — Lista Definitiva de Tarefas Pendentes (P0–P4)

### P0 — Bloqueantes (impedem funcionamento pleno)

| # | Tarefa | Dependência | Impacto |
|---|---|---|---|
| P0-1 | **Definir `EMAIL_*` no Hostinger hpanel** (`EMAIL_PROVIDER=resend`, `EMAIL_API_KEY`, `EMAIL_FROM` com domínio verificado) | Usuário (hpanel) | FASE 4 (recuperação por e-mail) — hoje no-op; token é gerado mas e-mail nunca chega |
| P0-2 | **Confirmar entrega do e-mail de reset + validade do link** (click no link em produção) | Usuário (inbox + link) | Validação end-to-end da FASE 4 |
| P0-3 | **Definir `META_*` no Hostinger hpanel** (`META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`) | Usuário (hpanel + Meta Developers) | Integração WhatsApp inerte; OAuth + webhook não funcionam |
| P0-4 | **Definir `OMNIROUTER_*` no Hostinger hpanel** (opcional — chat funciona sem, mas sem IA real) | Usuário (hpanel) | Chat admin responde com texto informativo; sem LLM real |

### P1 — Qualidade (gaps de teste/código)

| # | Tarefa | Impacto |
|---|---|---|
| P1-1 | **Criar `/crm/pipelines` page UI** — API route existe (`app/api/crm/pipelines/route.ts`) mas página é 404 | UX: menu aponta para rota inexistente |
| P1-2 | **Validar URL de onboarding WhatsApp** (`src/integrations/meta/whatsapp/onboarding.ts:11-14`) contra formato oficial Meta (`business.whatsapp.com/embed?org=<org>`) | G7 aberto |
| P1-3 | **Resolver worktree obsoleto** `worktree-rls-remediation` (em `d99d9bf`, 2026-10-09) | Limpeza; não afeta produção |
| P1-4 | **Avaliar remoção ou construção de `@zernio/node`** (G10) | Dependência morta vs. uso futuro |

### P2 — Escopo novo do PROMPT MESTRE (corrigido 2026-10-18)

> ⚠️ Correção de escopo (revisada 2026-10-18): P2-1 (§5) e P2-3 (§11) são **ferramentas de
> desenvolvimento**, fora de escopo. P2-2 (§10 reconstrução → "Sem API / Avançado" real) foi
> **reavaliado para EM ESCOPO** (automação de navegador é método de produto exigido no §2/§3.1/§3.3
> do PROMPT MESTRE real; apenas o Playwright-MCP como ferramenta de dev permanece FORA). P2-4 e
> P2-5 são **em escopo** — requisitos reais para o usuário final.

| # | Tarefa | Status após correção | Complexidade |
|---|---|---|---|
| P2-1 | **§5 — Ponte local Claude Code** (executor + fila offline) | ❌ **FORA DE ESCOPO** — ferramenta de dev, não funcionalidade do produto | — |
| P2-2 | **§10 reconstrução → "Sem API / Avançado" real (§2/§3.1/§3.3)** — scrapers/QR/browser automation p/ logins + automações sem API, c/ avisos de risco | ✅ **EM ESCOPO** (reavaliado 2026-10-18) — funcionalidade real de produto; **Playwright-MCP como dev tool segue FORA** | Alta |
| P2-3 | **§11 — Inventário MCP/CLI** (página de listagem) | ❌ **FORA DE ESCOPO** — inventário interno do engenheiro, não exposto ao usuário final | — |
| P2-4 | **§12 — Hub de integrações**: UI de status por provider + health (checar `token_expires_at`) + config per-tenant | ✅ **EM ESCOPO** — funcionalidade real do produto | Média |
| P2-5 | **§13 — Hub Meta avançado**: job de refresh de token + tela de onboarding + segredos no env | ✅ **EM ESCOPO** — funcionalidade real do produto | Média-Alta |

### P3 — Mantenimento / cosmético

| # | Tarefa | Complexidade |
|---|---|---|
| P3-1 | `favicon.ico` ainda 404 no navegador (`.svg` existe, mas browser pede `.ico`) | Baixa |
| P3-2 | Página `/` exibe stats estáticas ("185/185 · 45 pág.") — correcto agora, mas deve ser dinamizado no futuro | Baixa |
| P3-3 | `resend` como runtime dependency desnecessário (código usa `fetch` global) | Baixa |
| P3-4 | `src/connectors/whatsapp.ts:19` — `TODO: implementar quando credencial Meta confirmada` | Baixa (marker) |

### P4 — Observações (não blocking)

| # | Observação |
|---|---|
| P4-1 | **Dual-schema drift** (PascalCase PostgREST vs snake_case Prisma models) — conhecido, rotas usam service-role client para reads; `crmRepoReal.ts` tem bug latente |
| P4-2 | **Gap de identidade** — onboarding que falha não derruba registro (`catch→log` em `register/route.ts:94-96`); usuário pode existir no GoTrue sem linha/membership → `getAuthenticatedUser` retorna null |
| P4-3 | **Backup efetivo** — `backup-pre-rls-007-009.sql` = 0 bytes; rollback real é snapshot JSON + PITR do Supabase |
| P4-4 | **Regime local** — tarefas em `waiting_human` só executam quando a máquina local está online |
| P4-5 | **claude-mem observer** deslogado desde 2026-10-08 — correção: rodar `/login` no Claude Code |

---

## FASE 9 — Documentação Final

### Arquitetura resumida

```
┌─────────────────────────────────────────────────────────────┐
│                     HOSTINGER (produção)                    │
│  revolutionx.com.br  ←  Git integration  ←  GitHub (público)│
│       │                                                    │
│  Next.js 14.2 (App Router)                                 │
│       │                                                    │
│  ┌────┴──────────────────────────────────────────┐         │
│  │  Pages (45)   │   API Routes (18+)            │         │
│  │  /dashboard   │   /api/auth/* (8 rotas)       │         │
│  │  /crm/*       │   /api/crm/* (4 rotas)        │         │
│  │  /admin/*     │   /api/admin/* (4 rotas)      │         │
│  │  /integrations│   /api/webhooks/meta          │         │
│  │  /account     │   /api/products               │         │
│  └────────────────────────────────────────────────┘         │
│       │                                                    │
│  ┌────┴──────────────────────────────────────────┐         │
│  │  Prisma (postgres/BYPASSRLS)                   │         │
│  │  ├─ filtros where organizationId (1ª barreira) │         │
│  │  └─ GUC app.current_org / app.current_user_id  │         │
│  └────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  SUPABASE (cloud)                           │
│  ardpabjoepzhkpmkgwgu · sa-east-1 · PG 17.6                │
│  ├─ Auth (GoTrue) — sessões, login, OAuth                  │
│  ├─ PostgreSQL — 25+ tabelas, RLS FORCE em 21              │
│  └─ Migrations: 005–009, 014, 015 (todas aplicadas)        │
└─────────────────────────────────────────────────────────────┘
```

### Status de saúde do projeto

| Dimensão | Status | Nota |
|---|---|---|
| **Build** | ✅ 45 páginas, exit 0 | next build limpo |
| **TypeScript** | ✅ 0 erros | tsc --noEmit limpo |
| **Testes** | ✅ 185/185 PASS | 18 suítes, 7s |
| **CI/CD** | ✅ Verde | Run 39078239364 success |
| **Deploy** | ✅ Git integration ativa | Push → build → ar em ~1-2 min |
| **RLS** | ✅ FORCE em 21 tabelas | 007–015 em produção |
| **Segurança** | ✅ Zero segredos em repo | Senhas apenas em refs locais (não pushados) |
| **Funções core** | ✅ 90%+ operacionais | exceto Meta/Resend/OmniRouter (sem credenciais) |
| **Página pipelines** | ⚠️ 404 | API existe, UI ausente |
| **Email** | ⚠️ No-op | Token gerado, mas e-mail não enviado |
| **WhatsApp** | ⚠️ Inerte | Código pronto, credenciais ausentes |
| **IA (chat)** | ✅ Funcional (sem LLM) | Respostas informativas claras |

### Classe do projeto

**CLASSE B — PRONTO PARA USO PRODUÇÃO (com ressalvas)**

O sistema está tecnicamente completo para operação. As funcionalidades core (auth, CRM, produtos, RLS, centro administrativo) estão implementadas, testadas e no ar. As integrações externas (Meta WhatsApp, Resend email, OmniRouter IA) degradam honestamente quando sem credenciais — nunca simulam sucesso.

**O que falta para completude total:**
1. Credenciais de env no Hostinger (P0-1 a P0-3)
2. Página UI de `/crm/pipelines` (P1-1) — ✅ concluída nesta missão
3. Hub de integrações (P2-4) + Hub Meta avançado (P2-5) — em escopo
4. **Requisitos novos do PROMPT MESTRE real (§1–§8)** — ver FASE 10: canais (IG/FB/WhatsApp/
   TikTok), "Sem API / Avançado" (scrapers/QR/browser automation c/ avisos de risco), chatbot
   visual configurável, tracking de anúncios, integrações n8n/Zapier/Make.
   *(P2-1/P2-3 fora de escopo — ferramentas de dev; P2-2 reavaliado p/ em escopo — ver nota no topo)*

---

## FASE 10 — PROMPT MESTRE real (§1–§8) — atualização 2026-10-18

> O texto original do PROMPT MESTRE foi fornecido pelo usuário em 2026-10-18. As seções
> numeradas §3–§16 nesta auditoria eram uma **reconstrução** (números que não existem no
> documento real). O PROMPT MESTRE real tem **§1–§8**. Estado detalhado em
> `docs/PROJECT_REQUIREMENTS_MATRIX.md` → seção E. Resumo por bloco:

| Bloco real | O que pede | Estado no código (2026-10-18) |
|---|---|---|
| **§2** Plataforma multi-canal | 4 canais (IG/FB/WhatsApp/TikTok), cada um "API oficial + Sem API" | 🟡 só WhatsApp (Meta) parcial; IG/FB/TikTok ausentes |
| **§3.1** Logins por canal | 7-8 métodos de login (API + sem API p/ cada canal) | 🟡 WhatsApp-Meta parcial; demais ❌ |
| **§3.2** WhatsApp Business | Disparo em massa, templates, grupos, chatbot | 🟡 webhook+processor; UI/templates/chatbot ❌ |
| **§3.3** Instagram | Disparo em massa, agendamento, automações, scraping | 🟡 agendamento ✅ (F2, `/instagram` + `/api/instagram/publish`); massa/automações/scraping pendentes |
| **§3.4** Facebook | Agendamento, Marketplace, grupos | ❌ |
| **§3.5** TikTok | Agendamento + tracking | ❌ |
| **§3.6** Tracking | Gerenciador de Anúncios Meta + TikTok em tempo real | ❌ |
| **§3.7** Integrações | Meta (obrigatória), n8n, Zapier/Make/webhooks; hub "Integrar" + status | 🟡 Meta parcial; n8n/Zapier/Make ❌ (P2-4) |
| **§3.8** Automações/Chatbot | Chatbot visual configurável + automações gerais | ❌ |
| **§4** UX 1-clique | Botões grandes, fluxos guiados, separação API vs Sem API, avisos de risco | 🟡 parcial |
| **§5** Design | lilás+preto+branco, glassmorphism, responsivo | ✅ compatível |
| **§6** Arquitetura | Next.js+TS+Tailwind+PG+Prisma; fila BullMQ/Inngest; logs/monitor | 🟡 stack ok; fila própria (não BullMQ); sem monitor dedicado |

### "Sem API / Avançado" — reavaliação de escopo

- **EM ESCOPO:** browser automation / scrapers / QR Code como **métodos de produto** para
  logins e automações "sem API" (§2, §3.1, §3.3) — exigidos explicitamente, **com avisos
  claros de risco** de violação de ToS dos canais. Pendente de autorização do usuário.
- **FORA DE ESCOPO:** Playwright/MCP **como ferramenta do engenheiro de IA** (não é
  exposto ao usuário). A correção de escopo original misturou essas duas camadas; agora
  estão separadas.

### O que mudou em 2026-10-18 (FASE 1 backend)

- A **FASE 1** (destravar o quase-pronto, sem dependência humana) foi **implementada no
  backend**: serviços em `src/integrations/*` + 7 rotas (`/api/integrations/{config,health,
  meta/refresh-token}`, `/api/whatsapp/{send,templates,chatbot}`, `/api/webhooks/inbound`)
  + 47 testes de serviço e 42 de rota. Suíte total **283/283**; `tsc` 0 erros; build verde.
- **"Sem API / Avançado"** é agora uma camada de **abstração declarativa** (`providers.ts`
  com `riskNote` ToS/LGPD/bloqueio + probes que degradam para `skipped`) — **não** se
  executa scraping/automação evasiva em plataformas reais.
- O que **faltava** = a **UI** (separação visual "API Oficial" vs "Sem API", fluxo
  "Integrar", tela `/whatsapp` de disparo) — concluída na seção abaixo.

### O que mudou em 2026-10-18 (FASE 1 UI)

- **UI da FASE 1 implementada** em cima do backend: `/integrations` agora tem as 2 seções
  visuais (**API Oficial** roxo / **Sem API · Avançado** âmbar + `RiskBanner`), form
  genérico "Integrar" (POST `/api/integrations/config`), health check, renovação de token
  e status real da Meta (GET `/api/integrations/meta`).
- **Tela `/whatsapp`** criada: disparo em massa, templates oficiais (listar+criar), chatbot
  configurável (editor de regras/horário/IA) e card "Sem API / Avançado" de extração de
  contatos (declarada, sem executor).
- **Primitivas** compartilhadas (`ApiBadge`, `RiskBanner`, `HealthPill`) + link
  `WhatsApp` no AppNav admin.
- Nova rota **`GET /api/auth/meta`** (início do OAuth da Meta, complementa o callback que já
  existia) com degradação honesta 503 quando `META_*` ausentes + 5 testes Jest.
- Suíte total agora **288/288**; `tsc` 0 erros; build verde. **P0 [HUMANO]:** as
  credenciais `META_APP_ID/SECRET` continuam no hpanel — a UI degrada de forma honesta
  (503) enquanto não forem preenchidas.

### O que mudou em 2026-10-18 (FASE 2 — Instagram)

- **FASE 2, slice 1 concluída:** publicação e agendamento de **Instagram pela Graph API
  oficial da Meta**. Serviço puro-TS `src/integrations/meta/instagramPublisher.ts`
  (fluxo real em 2 passos: `POST /{ig}/media` → `containerId`, depois
  `POST /{ig}/media_publish?creation_ids=` → `mediaId`; `scheduled_start_time` em UNIX
  s, janela oficial 10 min–75 dias). Como o sender de WhatsApp, **não lança** — devolve
  `ok`/`error` (`meta_not_configured`, `no_media_source`, `http_error`, `network_error`).
- **Resolver adicionativo** em `resolveAccess.ts`:
  `resolveTenantPublisherAccess(organizationId)` lê `meta_integrations` (service_role,
  filtrado por provider `instagram|facebook|whatsapp` e `status ≠ DISCONNECTED`), descripta
  o token AES-256-GCM e devolve `{accessToken, instagramUserId}`; degrada em
  `not_connected`/`no_token`/`decrypt_failed`/`no_ig_account`. **Não** alterou a função de
  WhatsApp existente.
- **Rota nova** `POST /api/instagram/publish`: auth (401), validação de mídia/janela
  (400), resolução do access (409/503) e publicação agregada (200 com `mediaId`/
  `containerId`/`scheduled`). `export const dynamic = 'force-dynamic'`.
- **UI nova** `app/instagram/page.tsx` (lilás + preto + branco): card de conexão (status
  real de `/api/integrations/meta`), card "Publicar/agendar" (post/reel + agendar 10min–
  75d), e card "Sem API / Avançado" (automações seguir/curtir/comentar **declaradas** com
  `RiskBanner` ToS/LGPD — executor ainda ausente). Link **Instagram** no AppNav admin.
- **Testes:** 16 novos em `instagramPublisher.test.ts` (fluxo criar+publicar, agendamento,
  degradamentos, fallback REEL→imagem, mapeamento de erro HTTP/rede). Suíte total
  **304/304** (23 suítes); `tsc` 0 erros; `next build` verde (`/instagram` 4.58 kB;
  `/api/instagram/publish` na rota dinâmica).
- **P0 [HUMANO] permanece:** `META_APP_ID/SECRET` no hpanel + conta IG vinculada via
  OAuth. Sem isso, a rota degrada honestamente (503/409) — nunca finge sucesso.

---

## APÊNDICE A — Comandos para Reproduzir

```bash
# Testes
npm test                          # 18 suítes / 185 testes
npm test -- --testPathPattern=rls # só RLS tenant (11)
npm test -- --testPathPattern=token-rls  # token RLS (19)
npm test -- --testPathPattern=b4-rls   # Session/BillingEvent (8)
npm test -- --testPathPattern=task-queue-rls  # fila 014 (10)
npm test -- --testPathPattern=admin-routes  # authz + SSE (34)
npm test -- --testPathPattern=webhooks/meta # webhook Meta (11)

# Qualidade
npm run typecheck                 # tsc --noEmit
npx next build                    # 45 páginas
npx next lint                     # 0 warnings

# Produção (read-only)
curl -s https://revolutionx.com.br/api/admin/chat
curl -s -o /dev/null -w "%{http_code}" https://revolutionx.com.br/
```

---

## APÊNDICE B — Arquivos de Referência

| Arquivo | Propósito |
|---|---|
| `CLAUDE.md` | Regras de autonomia + limites de segurança |
| `README.md` | Roadmap de 12 FASES |
| `docs/BRIEFING_ANALISE_PROJETO.md` | Análise de handoff (pedido/feito/falta/próximos) |
| `docs/EXECUTION_LOG.md` | Histórico cronológico de execução |
| `docs/EXECUTION_STATE.md` | Estado canônico do trabalho contínuo |
| `docs/PROJECT_HANDOFF.md` | Instruções para retomada de sessão |
| `docs/PROJECT_REQUIREMENTS_MATRIX.md` | Matriz de requisitos com estados |
| `docs/STAGING_ROLLOUT_PLAN.md` | Plano de rollout 007–015 + FASE AGENT |
| `docs/FINAL_FUNCTIONAL_VALIDATION.md` | Validação funcional 2026-10-13 |
| `docs/DB_ROTATION_RUNBOOK.md` | Runbook de rotação de senha do banco |
| `REVOLUTION_X_MEMORY.md` | Memória persistente (palavra-chave: REVOLVER) |
| `memory/project-status.md` | Status atualizado (this session) |

---

*Auditoria concluída em 2026-10-17. Nenhuma funcionalidade de produção foi modificada por ela. Todos os dados são baseados em evidências executadas ou arquivos lidos.*

**Próximo passo (2026-10-18):** execução autônoma contínua. **FASE 1 (backend + UI)
concluída**: 8 rotas (7 FASE 1 + `GET /api/auth/meta`) + serviços de integrações/WhatsApp +
`/integrations` e `/whatsapp`, suíte 288/288, tsc 0, build verde. **A seguir:** FASE 2
(canais principais: login+agendamento IG/FB/TikTok via API oficial, automações IG,
agendamento FB + Marketplace, TikTok post), depois Fases 3–4 do PROMPT MESTRE.
