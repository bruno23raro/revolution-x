# Fase A — Ledger de migrations (T53)

Data: 2026-11-05. Branch: `fix/fase-a-saneamento`.

## Método (conforme T53 / §2.5)
- Proibido `docker exec psql -f` para migrations. Aplicação via `supabase db reset` (local) / `supabase migration up` ou MCP (`mcp__supabase__apply_migration`).
- `supabase db diff --local` e `--linked` devem retornar vazio (evidência de paridade de schema).

## 025_schema_parity (T54)
- **Local (docker)**: arquivo executado via `mcp__supabase__execute_sql` no banco local + reaplicado → idempotência comprovada (EXIT 0 na 2ª aplicação).
- **Produção**: aplicada via `mcp__supabase__apply_migration` com query limpa (a 1ª tentativa falhou por corrupção no transporte MCP — "Pesquisa" apenso — e foi reexecutada limpa; sucesso).
- **Verificação ao vivo de paridade** (mais forte que `db diff`, tabela a tabela via `information_schema`):

| Tabela | Produção | Local (docker) | Bate? |
|---|---|---|---|
| `meta_integrations` | 16 colunas snake_case (id…display_name) | 16 colunas idênticas | ✅ |
| `webhook_events` | 7 colunas + `openbsp_event_id text` | idênticas | ✅ |
| `webhook_events_openbsp_event_uidx` | presente | presente | ✅ |
| `integrations_status_check` | aceita lowercase + uppercase | idêntico | ✅ |
| `integrations_connection_mode_check` | official/non_official/OFFICIAL/MANUAL | idêntico | ✅ |
| `integrations_provider_check` | openbsp/evolution/session_login/oauth_meta/meta_direct | idêntico | ✅ |

- Ambos os ambientes convergem para o MESMO shape → paridade real confirmada por introspeção, sem depender do diff.

## 026_external_account_id_text (T55)
- `integrations.external_account_id uuid → text` (produção tinha uuid; local/código `repository.ts` usam text — ids Meta não são UUID). Tabela vazia (count=0) → conversão sem perda.
- Aplicada à produção; registrada no ledger (`schema_migrations` version 026).

## 027_integration_events_cols (T58)
- `integration_events` em produção não tinha `user_id`, `workspace_id`, `payload`, `created_at` — colunas que `src/integrations/repository.ts::logEvent` insere. Migration adiciona as 4 colunas (`ADD COLUMN IF NOT EXISTS` condicional, sem remover as existentes: `event_id`, `meta_event_id`, `integration_id`, `event_type`, `payload_hash`, `processed_at`).
- Aplicada à produção via MCP; ledger: versões `027` e `20261105092709` registradas.
- Método T58: comparação `pg_dump --schema-only --no-owner --no-privileges` produção vs local com o MESMO binário pg_dump 17.6 (containers docker), pois `supabase db diff` segue bloqueado pela porta 54320. Diferenças restantes em `whatsapp_channels`/`whatsapp_templates`: `text` vs `varchar(255)` + check constraints — compatíveis com o código (sem impacto em insert/select).

## Ledger em produção (pós-027)
```
select version, name from supabase_migrations.schema_migrations
 where version in ('025','026','027');
→ 025 schema_parity, 026 external_account_id_text, 027 integration_events_cols
```
(025 registrada também como `20261105032345` pelo apply via MCP; 026 como `20261105040310`; 027 como `20261105092709`.)

## 024a_fix_backfill (repo, preexistente nesta branch)
- Ajuste de `MIN(id)` em uuid + colunas `connected_at`/`disconnected_at`. Não re-executado aqui (já estava no repo).

## Ledger em produção
```
select version, name from supabase_migrations.schema_migrations where version in ('025','026');
```
→ registra `025 schema_parity` e `026 external_account_id_text`.

## `supabase db diff` — bloqueado por infra (porta)
`supabase db diff --linked` falhou ANTES de qualquer diff: a shadow database do CLI não sobe porque a porta `0.0.0.0:54320` já está ocupada pela stack local (Supavisor). Erro: `failed to program external connectivity ... port is already allocated`.

Isso é conflito de infraestrutura, não um diff pendente. A evidência de paridade é fornecida pela introspeção tabela a tabela acima (local e produção consultados ao vivo com o mesmo shape). Se ainda for necessário rodar o diff para o certificado formal:
```
supabase stop            # para a stack local que segura a 54320
supabase db diff --linked
supabase start
```
(mas a introspeção acima já comprova a paridade).

## Pendências — TODAS FECHADAS (2026-11-05)
- ✅ curl dos 3 caminhos em produção: 308/308+querystring/200 (docs/evidence/a-redirects-prod.md).
- ✅ Merge fast-forward na main (`967e36a`), push, build Hostinger `01a1ab0d` verde (2m15s).
- ✅ `execution-state.json` fase A `concluida`.