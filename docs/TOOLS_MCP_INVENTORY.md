# Tools & MCPs Inventory — Revolution X
**Generated**: 2026-10-22  
**Purpose**: Real validation results for all MCP servers and tools used in this project  
**Context**: Local development environment with FreeLLMAPI at http://127.0.0.1:3001

## Claude Code MCP List (`claude mcp list`)

| MCP Server | Status | Details |
|------------|--------|---------|
| **integrated-browser-mcp** | ✅ Connected | node C:\Users\Bruno\.integrated-browser-mcp\mcp-server.mjs — streamable HTTP bridge for VS Code integrated browser |
| **meta-mcp** | ✅ Connected | npx @mentu/metamcp — Meta integration MCP |
| **perplexity** | ✅ Connected | pwm-mcp — Perplexity AI search MCP |
| **context7** | ✅ Connected | https://mcp.context7.com/mcp (HTTP) — Context7 documentation MCP |
| **playwright** | ✅ Connected | npx -y @playwright/mcp@latest — Playwright browser automation MCP (3 variants) |
| **supabase-http** | ✅ Connected | https://mcp.supabase.com/mcp (HTTP) — Supabase HTTP MCP (needs auth for some ops) |
| **graft** | ✅ Connected | npx -y @nanonets/graft mcp — Graft repo graph MCP |
| **codebase-memory-mcp** | ✅ Connected | C:/Users/Bruno/AppData/Local/Programs/codebase-memory-mcp/codebase-memory-mcp.exe — Codebase memory MCP |
| **github** | ✅ Connected | https://api.githubcopilot.com/mcp/ (HTTP) — GitHub Copilot MCP |
| **playwright-auth** | ✅ Connected | npx -y @playwright/mcp@latest — Playwright auth MCP |
| **playwright-extension** | ✅ Connected | npx -y @playwright/mcp@latest --extension — Playwright extension MCP |
| **hostinger-hosting** | ✅ Connected | npx.cmd --package=@hostinger/mcp@latest hostinger-hosting-mcp |
| **hostinger-wordpress** | ✅ Connected | npx.cmd --package=@hostinger/mcp@latest hostinger-wordpress-mcp |
| **hostinger-agency-hosting** | ✅ Connected | npx.cmd --package=@hostinger/mcp@latest hostinger-agency-hosting-mcp |
| **hostinger-domains** | ✅ Connected | npx.cmd --package=@hostinger/mcp@latest hostinger-domains-mcp |
| **hostinger-dns** | ✅ Connected | npx.cmd --package=@hostinger/mcp@latest hostinger-dns-mcp |
| **hostinger-billing** | ✅ Connected | npx.cmd --package=@hostinger/mcp@latest hostinger-billing-mcp |
| **hostinger-reach** | ✅ Connected | npx.cmd --package=@hostinger/mcp@latest hostinger-reach-mcp |
| **hostinger-ecommerce** | ✅ Connected | npx.cmd --package=@hostinger/mcp@latest hostinger-ecommerce-mcp |
| **hostinger-vps** | ✅ Connected | npx.cmd --package=@hostinger/mcp@latest hostinger-vps-mcp |
| **hostinger-wordpress-sites** | ✅ Connected | C:\Program Files\nodejs\node.exe C:\Users\Bruno\.hostinger-mcp\wordpress-sites.js |
| **supa** | ❌ Failed | ENOTFOUND: getaddrinfo ENOTFOUND mcpservers.supabase.com — DNS resolution fails |
| **hermes** | ❌ Failed | CONNECTION_CLOSED — Connection closed immediately after attempt |
| **supabase (HTTP)** | ⚠️ Needs auth | Connects but requires authentication — HTTP MCP with auth requirement |

## FreeLLMAPI Integration Status

| Aspect | Status |
|--------|--------|
| **FreeLLMAPI server** | ✅ Running at http://127.0.0.1:3001 (Docker Compose, healthy 7h+) |
| **FreeLLMAPI MCP server** | ❌ **DISABLED** — `/mcp` returns 403. Must enable via dashboard (Keys → Agent compatibility) or `PUT /api/settings/enable-mcp {"enabled":true}` with dashboard token. After enabling, register via: `claude mcp add --transport http freellmapi http://localhost:3001/mcp --header "Authorization: Bearer freellmapi-your-unified-key"` |
| **Claude Code base URL** | http://127.0.0.1:3001 (process-scoped ANTHROPIC_BASE_URL) |
| **Model in use** | `auto` slot — catalog context_window: 1048576, but routed free models have smaller windows |
| **Routing verified** | ✅ `npx freellmapi doctor claude` → "OK claude: routed ... ANTHROPIC_BASE_URL (process environment) = http://127.0.0.1:3001" |
| **Tool-call test** | ✅ Returned `stop_reason: tool_use` with `{"name":"get_weather","input":{"city":"Sao Paulo"}}` and header `X-Routed-Via: nvidia/nvidia/nemotron-3.5-lightning-30b-a3b` |
| **Unified auth token** | Process-scoped `ANTHROPIC_AUTH_TOKEN` — works as Bearer token for FreeLLMAPI gateway |
| **Autocompact root cause** | `CLAUDE_CODE_AUTO_COMPACT_WINDOW=1048576` (full advertised window) vs actual routed free models have smaller context windows → compaction fires prematurely. Evidence from real routing. |

## Failed / Unreachable MCPs

| MCP Server | Error | Diagnosis |
|------------|-------|-----------|
| **supa** | ENOTFOUND: mcpservers.supabase.com | DNS cannot resolve — not reachable from this network/environment |
| **hermes** | CONNECTION_CLOSED | Connection refused/closed immediately — server not available or incompatible |

## Working MCP Tools by Category

### Browsing & Automation
- **integrated-browser-mcp**: Click, type, navigate, snapshot, evaluate on VS Code integrated browser
- **playwright ×3**: Full browser automation (auth, extension, standard) — Playwright tests, screenshots, snapshots
- **meta-mcp**: Meta OAuth, API integration, account management

### AI & Model Routing
- **context7**: Library/documentation lookup via Context7 MCP
- **perplexity**: Web search and AI query via Perplexity

### Database & Backend
- **supabase-http**: Supabase Postgres/Rest operations (needs auth)
- **graft**: Repository graph, symbol search, call tracking, repo map
- **codebase-memory-mcp**: Graph-aware code search and reasoning

### Cloud & Hosting
- **github**: Repository operations, PR management, issue tracking
- **hostinger-***: All Hostinger hosting operations (websites, DNS, billing, VPS, WordPress, etc.)

### Development & AI Providers
- **buildDirectGeminiProvider()** in `src/ai/aiProviders.ts` — direct Gemini, no OmniRouter
- **FreeLLMAPI** at http://127.0.0.1:3001 — unified LLM router (MCP disabled, using HTTP gateway only)

## Key Observations

1. **24 MCP servers configured**, 22 connected successfully, 2 failed (supa, hermes), 1 needs auth (supabase HTTP)
2. **FreeLLMAPI MCP is disabled** — requires human step via dashboard to enable. Process cannot auto-enable it.
3. **All Hostinger MCPs connected** — hosting operations fully accessible from this environment
4. **Graft and codebase-memory-mcp** provide graph-aware code navigation — useful for large codebase navigation
5. **FreeLLMAPI HTTP gateway is functional** — routing proven via `npx freellmapi doctor claude` and real tool-call tests
6. **Autocompact issue documented** — `CLAUDE_CODE_AUTO_COMPACT_WINDOW=1048576` mismatch with routed free models is the likely root cause of premature stops

## Recommended Next Steps

1. **Enable FreeLLMAPI MCP** via dashboard (Keys → Agent compatibility) or `PUT /api/settings/enable-mcp` with dashboard token, then `claude mcp add --transport http freellmapi http://localhost:3001/mcp`
2. **Investigate autocompact mitigation** — consider lowering `CLAUDE_CODE_AUTO_COMPACT_WINDOW` via config backup+merge (supported, does not disturb running session)
3. **Document human-dependent steps** — FreeLLMAPI MCP enable requires dashboard access; cannot be auto'd in this environment
4. **Continue Revolution X accessibility verification** — Dashboard, Admin Settings, Integrations pages
---

## Re-verificação (ciclo 2026-10-23, missão de continuação autônoma)

| Ferramenta | Estado real | Evidência |
|---|---|---|
| Git 2.55.0 | ✅ funcionando | push `f34ae04..aa07f90` em origin/feat/finalizacao-missao-2-2026-10-22 |
| GitHub CLI (`gh`) | ❌ não instalado | `gh: command not found`; substituído pelo MCP github |
| MCP github | ⚠️ parcial | leitura OK (PRs, check-runs); **escrita em PR retorna 403** (PAT sem scope) — merge do PR #4 é passo humano |
| Jest | ✅ | 705/705 em 51 suítes (13.0s) neste ciclo |
| tsc / ESLint | ✅ | 0 erros ambos, neste ciclo |
| npm run build | ✅ | exit 0 no HEAD `aa07f90` (~70 rotas) |
| Supabase MCP (HTTP) | ✅ (ciclo anterior) | migrations 3 aplicadas vs 17 locais revisadas |
| Playwright/Lighthouse | ✅ (ciclo anterior) | `.a11y-lighthouse/report.json`: a11y=100 no /dashboard |
| CI GitHub Actions | ✅ | build-and-test success em `9a78b9a` e `aa07f90` |
| hermes / memory / freeLLMAPI MCP | ❌ sem mudança | CONNECTION_CLOSED / 403 intencional |
