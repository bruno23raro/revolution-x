# Fase A — Evidência de Gate (T52–T55)

Data: 2026-11-05. Branch: `fix/fase-a-saneamento`.

## T52 — Rota canônica de integrações (308 permanente)
- **Decisão** (docs/decisions.md §4): `/integracoes` é canônica (importa `IntegrationCard`, seletor de modo OFFICIAL|MANUAL, multi-conta com Remover Conta). `/integrations` e `/hub-integracoes` são legadas.
- `/integrations` e `/hub-integracoes` → `permanentRedirect()` (308) para `/integracoes` preservando querystring.
- Links internos atualizados: `app/tiktok/page.tsx`, `app/instagram/page.tsx`, `app/facebook/page.tsx`, `src/lib/testCenter.ts`, `src/components/AppShell.tsx` (duplicado de nav removido). `app/robots.ts` adiciona as rotas novas ao disallow.
- `grep 'href="/integrations"'` → 0 órfãos.
- Commit: `6757743`.

## T54 — Paridade de schema (meta_integrations/webhook_events snake_case)
- **Migration `025_schema_parity.sql`** convergiu LOCAL (docker) e PRODUÇÃO.
- Produção verificada ao vivo:
  - `meta_integrations`: 16 colunas snake_case (id…display_name) ✓
  - `webhook_events`: agora tem `openbsp_event_id text` ✓ + índice único `webhook_events_openbsp_event_uidx` ✓
  - `integrations_status_check` / `connection_mode_check` / `provider_check` ampliados para aceitar os valores reais (lowercase + uppercase + `meta_direct`) ✓
- **Prisma**: model `MetaIntegration`/`WebhookEvent` recriados com `@map` snake_case por coluna (produção é a verdade). `npx prisma generate` OK.
- **Bug exposto pelo parity**: `webhook_events` NÃO tem `organization_id`, mas `app/api/webhooks/inbound/route.ts` e `app/api/integrations/openbsp/incoming/route.ts` gravavam `organizationId` → quebraria em runtime. Corrigido: dedup agora via `openbsp_event_id` (wamid), `metaEventId` non-null. Teste `fase1-routes.test.ts` atualizado.
- **Roundtrip real** (node + Prisma client vs docker local, migration 025 aplicada): INSERT/SELECT/UPDATE/DELETE de `meta_integrations` OK; `@map` snake_case confirmado por SQL cru (colunas `display_name,encrypted_access_token,last_error,token_expires_at`); token AES-256-GCM cifrado e decriptável (não é texto puro).
- `tsc 0`, `jest 833/833`, `eslint 0`.

## T55 — Persistência de conta Instagram (external_account_id)
- Análise: `integrations.external_account_id` era `uuid` na PRODUÇÃO, mas `text` no LOCAL/código (`repository.ts` grava ids externos como texto: waba, IG account id, phone). Ids da Meta NÃO são UUID → insert falharia.
- **Migration `026_external_account_id_text.sql`**: `external_account_id uuid → text` (tabela vazia nos dois ambientes, sem perda). Aplicada à produção e registrada no ledger.
- Backfill: tabela `integrations` vazia (count=0) nos dois ambientes — nada a migrar.
- Callbacks: `app/api/auth/callback/meta/route.ts` grava `instagram_account_id` (coluna snake) em `meta_integrations`; `app/api/oauth/callback/instagram/route.ts` grava `meta_account_id` + `meta_account_name` em `integrations`. `repository.ts::upsertConnection` já suporta `externalAccountId`/`externalAccountLabel` (linhas 135-136/165-166) — mas nenhum caller app o invoca hoje; segue coberto por testes existentes.

## T56 — WF-04 n8n (severity)
- `n8n/workflows/WF-04_alerta-5xx.json` corrigido (Enrich Alert `$json.body || $json`; jsonBody severity com default `{{ $json.severity || 'warning' }}` e uppercase em JS).
- Diagnóstico em docs/evidence/a-wf04.md. Reexecução pendente (requer acesso ao n8n — humano).

## Gates (T57 parcial — build/prisma pendentes de commit)
| Gate | Resultado |
|---|---|
| `tsc --noEmit` | 0 erros |
| `eslint . --max-warnings=0` | 0 |
| `jest --no-coverage --silent` | 833/833 (59 suites) |
| migration 025 local (docker) | EXIT 0, idempotente |
| migration 025 produção | aplicada, verificado |
| migration 026 produção | aplicada, verificado |
| roundtrip Prisma `@map` snake_case | insert/select/update/delete OK |

## Pendências para fechar T57
- `supabase db diff --local` / `--linked` vazio → evidência em `docs/evidence/a-ledger.md` (T53).
- curl -sI dos 3 caminhos em produção.
- Commit/squash na main; `execution-state.json` fase A done.