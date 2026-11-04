# Tooling — Refatoração de Integrações

## CLI e Ferramentas

| Ferramenta | Versão | Finalidade |
|---|---|---|
| `node` / `npm` | v10.1.2 (do projeto) | Build, testes, scripts |
| `pnpm` | latest | Gerenciador de pacotes (padrão do projeto) |
| `jq` | via npx | Manipulação JSON de linha de comando |
| `ripgrep` | via npx | Busca de conteúdo em arquivos |
| `git` | via bash | Versionamento |
| `gh` | via gh CLI | GitHub operations |
| `supabase` | via mcp / cli | Migrações e introspecção banco |
| `playwright` | 1.44.0 | Browser headless, E2E tests |
| `vitest` | via project | Unit tests (config do projeto) |
| `jest` | 29.7.0 | E2E e testes de integração |
| `typescript` | via project | Type-check |
| `prettier` | via project | Formatação |
| `eslint` | via project | Lint |
| `dotenv-cli` | via project | Var env em scripts |
| `@faker-js/faker` | via project | Dados de teste fake |
| `tsx` | via project | Execução TS direta |
| `husky` | via project | Git hooks |
| `lint-staged` | via project | Lint em arquivos stageados |

## MCPs Disponíveis

- `mcp__playwright` — browser headless controlado
- `mcp__github` — GitHub operations
- `mcp__postgres` — PostgreSQL queries (read-only no dev)
- `mcp__supabase` — Supabase project operations
- `mcp__qiksy` — browser session (already active)

## Skills (`.claude/skills/`)

| Skill | Arquivo | Finalidade |
|---|---|---|
| `supabase-migration` | `supabase-migration.SKILL.md` | Cria/migra tabelas Supabase |
| `provider-adapter` | `provider-adapter.SKILL.md` | Fábrica e interface de adaptador |
| `oauth-meta` | `oauth-meta.SKILL.md` | Fluxo OAuth Meta (state, PKCE, callback) |
| `session-login-capture` | `session-login-capture.SKILL.md` | Playwright login session capture |
| `evolution-qr` | `evolution-qr.SKILL.md` | QR Code Evolution, pairing, health check |
| `openbsp-webhook` | `openbsp-webhook.SKILL.md` | Webhook OpenBSP, verificação, idempotência |
| `e2e-integration-test` | `e2e-integration-test.SKILL.md` | Matriz de aceite E2E |
| `credential-gate` | `credential-gate.SKILL.md` | Tela de credenciais, pending_credentials |
| `regression-guard` | `regression-guard.SKILL.md` | Regressão de módulos vizinhos |
| `release-notes` | `release-notes.SKILL.md` | Geração de release notes |

## Plugins/Agents (`.claude/agents/`)

| Agent | Descrição | Ferramentas |
|---|---|---|
| `architect` | Valida contratos de adaptador e limites de módulo | Read, Grep, StructuredOutput |
| `db-migrator` | Migrations, backfill, RLS, índices, rollback | Bash, Glob, Grep, mcp__supabase |
| `whatsapp-official` | Adaptador OpenBSP, webhooks, templates | Read, Write, Bash, MCP |
| `whatsapp-qr` | Evolution, QR, polling, health check | Playwright, MCP |
| `social-session` | Playwright, storageState cifrado, 2FA/checkpoint | Playwright, MCP |
| `meta-oauth` | OAuth, state assinado, PKCE, refresh, callback | Bash, MCP |
| `ui-integrator` | Rota única, cards, badges, estados, timeouts | Read, Write, Edit |
| `credential-gate` | Tela de credenciais, teste, pendências | Read, Write, Edit |
| `qa-e2e` | Matriz de aceite, testes E2E, regressão | Playwright, Jest |
| `cleanup` | Deleção duplicados, redirects, compat | Bash, Grep |
| `reviewer` | Revisão final de PR antes do squash | StructuredOutput |

**Orquestração padrão:** `db-migrator` + `architect` seqüencial → paralelização de agentes de implementação → `qa-e2e`, `cleanup`, `reviewer` por último.

---

## Execução

- Um commit por tarefa concluída.
- Branch por fase: `refactor/integrations-f{n}`.
- Push a cada commit verde.
- Squash na `main` ao fechar a fase.
- Loop de qualidade: typecheck → lint → testes → build. Máx. 5 ciclos; no 6º, isolar e registrar.
- Nada de mock silencioso: `TODO(real)` se não puder ser real.
- Estado persistido em `docs/execution-state.json`.
- Pause APENAS por ação humana externa (criar app Meta, gerar token, instanciar OpenBSP/Evolution, 2FA, etc.).