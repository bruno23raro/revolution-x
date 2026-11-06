# TESTES E VALIDAÇÕES — medições reais desta auditoria (2026-11-06)

> Ambiente: Windows, Node 24.21, branch `refactor/db-adapter-f1` @ `88625c6`, sem aplicar
> nenhuma alteração de código. Comandos exatamente como executados.

| # | Verificação | Comando/ação | Resultado |
|---|---|---|---|
| 1 | Typecheck | `npx tsc --noEmit` | **FALHA** — 2 erros de sintaxe em `app/integracoes/page.tsx:283,300` |
| 2 | Suíte completa | `npx jest` | **822 testes, 821 passam, 1 falha; 60 suítes, 2 falham** |
| 3 | Falha A | suíte `app/api/auth/callback/meta/route.test.ts` | módulo `./route` não existe (rota deletada em `1a87fc7`) |
| 4 | Falha B | `src/tests/whatsapp-official-routes.test.ts` | teste espera 503 sem OPENBSP_ORG_ID; rota nova lê `req.json()` antes da checagem e lança `SyntaxError: Unexpected end of JSON input` (incompat teste↔código introduzida pelo routing mode `abedc93`) |
| 5 | Produção viva | `GET https://revolutionx.com.br/` | 200 |
| 6 | Produção | `GET /api/auth/session` | 401 (esperado sem sessão) |
| 7 | Produção | `GET /integrations` | 308 (redirect canônico ok) |
| 8 | Repo | API GitHub `repos/bruno23raro/revolution-x` | `private: false` (PÚBLICO), push 2026-11-06 |
| 9 | Segredos versionados | `git ls-files` + leitura | `AUDITORIA.md` (string de conexão completa c/ senha do prod), `CREDENCIAIS.md`, `AUDIT_REPORT_2026-10-27.json`, `inventory-env.md` **rastre**ados em origin/main |
| 10 | Banco produção (somente-leitura) | `pg` Client com DATABASE_URL | 41 tabelas public |
| 11 | RLS produção | `pg_class.relrowsecurity/relforcerowsecurity` | **RLS forçado: apenas AdminAlert, growth_leads, integrations, whatsapp_instances**; integration_events habilitado sem force; **6 policies**; 36 tabelas sem RLS |
| 12 | Migrations ledger | `select count(*) from _prisma_migrations` | **2 linhas** (vs 24 SQL) |
| 13 | Dados de tenants | `select count(*) from meta_integrations` | **0** (nenhuma integração conectada em produção) |
| 14 | Colunas 016/024-027 | `information_schema.columns` | display_name, user_id, external_account_id, connection_mode, workspace_id, payload **presentes** → docs que dizem "016 pendente" estão obsoletos |
| 15 | OAuth init → callback | leitura `app/api/auth/meta/route.ts` + fs | init gera `redirect_uri=/api/auth/callback/meta`; **arquivo não existe** → fluxo morto |
| 16 | Callbacks novos | `rg "api/oauth/callback"` | existem 4 rotas; nenhuma UI/init as referencia (só whatsapp-qr ↔ próprio card) |
| 17 | Scrapers | leitura `ScraperPageLayout.tsx` | retorna string `[PLACEHOLDER]` como resultado; 5 páginas fora da raiz do router (`src/app/scrapers`) |
| 18 | Deps de produção | package.json | playwright+puppeteer+puppeteer-core+`@qoder-ai/qoder-agent-sdk` em dependencies |

## O que NÃO foi testado (registrado como não verificado)

- Fluxo autenticado ponta a ponta (registro→login→conectar→publicar) — exige sessão real e
  credenciais Meta aprovadas.
- variáveis META_*/OMNIROUTER_* no hPanel de produção (painel humano).
- Evolution API, instância n8n em produção (não existe), OpenBSP popup de signup.
- RLS policies com sessões de tenant (banco local docker não estava de pé nesta sessão).
- Carga/latência.
