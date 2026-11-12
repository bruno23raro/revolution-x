# Plano — Ambiente Local de Demonstração + Auditoria OpenBSP + Recuperação Admin

Missão: auditar o estado real, criar demo local **sem login** tecnicamente impossível em produção, validar a integração OpenBSP existente (modalidade **hospedada**, comprovada) e restaurar o login do admin — sem reconstruir nada.

## Estado constatado (auditoria, evidências)

| Item | Status | Evidência |
|---|---|---|
| Modalidade OpenBSP | **HOSPEDADO** (web.openbsp.dev) | `OPENBSP_BASE_URL=https://nheelwshzbgenpavwhcy.supabase.co/rest/v1` (Supabase do OpenBSP, ref ≠ prod RX) + popup `web.openbsp.dev` em `src/integrations/openbsp/adapter.ts`. Nenhuma chave de app Meta próprio é usada no fluxo WhatsApp. |
| Chaves OpenBSP | VÁLIDAS ao vivo | `CREDENCIAIS.md`: apikey publica validada 2026-10-29; api-key owner mint onboarding_token HTTP 201 |
| Falha relatada "não conecta" | BLOQUEADO AGUARDANDO DADO | Probes desta sessão não retornaram rede; precisa do erro exato da UI/log ou do onboarding popup pendente (token 4aea657b… humano) |
| Login admin `brunoalmeida23111996@gmail.com` | BLOQUEADO (ação humana) | `B23b23v1814*` era senha **antiga do Postgres** (revogada); usuário recriado 2026-11-04 (id e1b2592b…). Recovery: Dashboard Supabase → Auth → Users → Reset password, OU `node fix-password.js` (service role já no repo) |
| `.env.local` atual | **APONTA PARA PRODUÇÃO** (perigoso p/ demo) | linhas 10-17: SUPABASE_URL/DATABASE_URL = `ardpabjoepzhkpmkgwgu` |
| Guardas demo | INEXISTENTES | nenhum `RX_DEMO_MODE` no repo |
| Testes | 1 falha nova | `app/api/webhooks/meta/route.test.ts` — mock do prisma sem `$queryRaw` (rota trata com warn, mas teste falha). Baseline 843/843 |

## Decisões de arquitetura (demo sem login)

1. **Flag server-side única**: `RX_DEMO_MODE=1` lida SÓ no servidor (nunca `NEXT_PUBLIC_`). `src/lib/demoMode.ts`:
   ```ts
   export function demoModeEnabled(): boolean {
     if (process.env.NODE_ENV === 'production') return false; // guarda absoluta
     return process.env.RX_DEMO_MODE === '1';
   }
   ```
   Em produção o caminho anônimo é inalcançável mesmo com a variável mal configurada → "tecnicamente impossível".
2. **Identidade demo = linhas reais** no banco LOCAL com UUIDs fixos `00000000-0000-0000-0000-000000000001` (user) e `…0002` (org). Seed cria usuário GoTrue local confirmado com senha demo conhecida; `POST /api/dev/demo-login` (guarda `demoModeEnabled()`, senão 404) faz `signInWithPassword` local e grava cookies de sessão reais. Assim `getAuthenticatedUser`, RLS, multi-tenancy e middleware funcionam sem nenhuma alteração de rota — login normal preservado 100%.
   - Rede de segurança extra: a rota recusa se `NEXT_PUBLIC_SUPABASE_URL` contiver `ardpabjoepzhkpmkgwgu` (prod), mesmo com flag ativa fora de produção.
3. **Mock de saída** (WhatsApp/IG/FB/e-mail simulados): short-circuit nos executors de envio quando `demoModeEnabled()` — gravam `Message`/`Post` com `provider:'demo'` e status `sent`, sem tocar OpenBSP/Meta/Resend. Pontos: `src/integrations/whatsapp/openbsp/client.ts` (`sendViaOpenbsp`), `src/integrations/manual.ts`, rotas `app/api/instagram/publish`, `app/api/facebook/publish`, `app/api/ai/generate` (fallback de resposta local quando sem provedor). `app/api/whatsapp/send` mantém os mesmos contratos de teste (401/400/409/200).
4. **Isolamento de dados**: demo roda contra o stack Docker local (`supabase-docker`, gateway :8432, GoTrue local, PG :54321). `.env.local.demo` versionado-modelo com valores locais; `.gitignore` já cobre `.env.local`.
5. **Seed** `prisma/seed-demo.ts` (idempotente, upsert): org + user + membership admin, 10 contatos, 5 leads, 2 deals, 1 pipeline, 2 campanhas (auto+manual) com destinatários, mensagens simuladas (inbound+outbound), 2 posts (ig/fb), automações (Task/TaskStep), memória do assistente. **Recusa executar se `DATABASE_URL` contiver `ardpabjoepzhkpmkgwgu`**.
6. **UI**: botão "Entrar no Modo Demo" em `/login` renderizado só quando `/api/auth/session` reportar `demoAvailable:true` (a API decide, não o frontend).
7. **Testes novos** (sem enfraquecer nada): `demoMode` produção+flag→false; `/api/dev/demo-login` sem flag→404; seed recusa prod. Corrigir mock `$queryRaw` em `app/api/webhooks/meta/route.test.ts` (causa raiz no mock, não na rota).

## Arquivos

**Criar** ✅
- `src/lib/demoMode.ts` — `demoModeEnabled()`, `isDemoToken()`, `decodeDemoToken()` [ATUALIZADO]
- `app/api/dev/demo-login/route.ts` — POST cria sessão demo com JWT mock [CRIADO]
- `app/api/dev/demo-login/route.test.ts` — testes de segurança [CRIADO]
- `src/tests/demo-mode.test.ts` — testes unitários demo [CRIADO]
- `prisma/seed-demo.ts` — seed de dados fictícios [CRIADO]
- `app/dev/page.tsx` + `app/dev/layout.tsx` — página de login demo [CRIADO]
- `src/middleware/demo-auth.ts` — helper de autenticação demo [CRIADO]
- `.env.example` — modelo de variáveis de ambiente com documentação [CRIADO]
- `docs/DEMO_MODE.md` — documentação completa do modo demo [CRIADO]

**Modificar (mínimo)** ⏳
- `src/lib/auth.ts` — detecção de sessão demo em `getAuthenticatedUser()` [ATUALIZADO]
- `package.json` — scripts `seed:demo`, `dev:demo` [ATUALIZADO]
- `app/api/webhooks/meta/route.test.ts` — mock prisma com `$queryRaw` [A FAZER]

**Não tocar**: middleware.ts (cookie org já vem da sessão real), auth.ts (sessão real dispensa injeção), RLS, produção, schema/migrations.

## OpenBSP hospedado — diagnóstico sequencial (antes de qualquer código)

1. Confirmar chave viva: `GET {OPENBSP_BASE_URL}/organizations?id=eq.{OPENBSP_ORG_ID}&select=id,name` com headers `apikey`+`api-key` (valores lidos de `.env.local`, nunca impressos).
2. Ver número conectado: `GET …/organizations_addresses?organization_id=eq.{ORG}&service=eq.whatsapp&select=id,status,extra`.
   - `status != connected` → humano precisa concluir o popup `https://web.openbsp.dev/onboarding/{token}` (token existente 4aea657b… ou novo mint). **Este é o ponto mais provável da falha "não conecta"** — a API está viva, o número nunca completou onboarding.
   - `connected` → testar `sendViaOpenbsp` para número de teste; auditar `missing_variables`/`template_not_found`/janela 24h.
3. Webhook: confirmar registro (registro é no-op quando phoneNumberId existe) e entrega em `/api/webhooks/openbsp` (SITE_URL prod ok; em demo local usar mock).
4. Só então corrigir código (ex.: `list_templates_indisponivel` → implementar contra endpoint real se existir). Sem trocar de provedor, sem custo.

## Ordem de execução

1. Fix teste `meta/route.test.ts` ($queryRaw no mock) → `npm test` verde 843+novos.
2. `src/lib/demoMode.ts` + rota `/api/dev/demo-login` + `demoAvailable` na sessão + botão login.
3. `prisma/seed-demo.ts` + `.env.local.demo` + rota simulate.
4. Mocks de saída (openbsp client, manual, send, ai/generate, publish ig/fb).
5. Subir docker local, aplicar cadeia de migrations existente no local, `npm run seed:demo`, `npm run dev` (porta local).
6. Verificação E2E manual abaixo; atualização de `RELATORIO_COMPLETO_PROJETO.md`.
7. **Passo humano (não bloqueia o resto)**: reset da senha de `brunoalmeida23111996@gmail.com` no Dashboard Supabase (ou autorizar execução de `fix-password.js` com senha nova definida pelo usuário — não pedir senha no chat).
8. OpenBSP: executar diagnóstico §1-2; reportar estado com evidência HTTP.

## Verificação

- `npm test` (843+ novos, 0 falhas), `npx tsc --noEmit` 0, `npm run lint` 0.
- Guard: com `NODE_ENV=production RX_DEMO_MODE=1`, `demoModeEnabled()`===false e `/api/dev/demo-login`→404 (teste unitário).
- `seed:demo` contra prod (DATABASE_URL prod) → recusa com erro explícito.
- Local: docker up → `next dev -p 3000` com `.env.local.demo` → GET `/` 200 sem login (páginas renderizam com sessão demo após demo-login); CRM/campanhas/relatórios mostram dados fictícios; envio WhatsApp demo → Message sent `provider:'demo'`; nenhuma requisição de saída a `nheelwshzbgenpavwhcy.supabase.co`, `graph.facebook.com`, `api.resend.com` em modo demo (checar logs).
- Login normal continua: register/login/logout inalterados (suites existentes).
- OpenBSP: resposta HTTP documentada para organizations/addresses (sem expor chaves).

## Riscos e salvaguardas
- Seed/demo só alcançam banco local por guard explícito de URL + NODE_ENV; produção intocada.
- Nenhuma migração nova; nenhuma destruição; sem force push; segredos nunca impressos.
- Testes existentes preservados; falha nova corrigida na causa (mock), não na asserção.
