# F1.4 — Verdade do Schema (State of Reality)

**Data**: 2026-11-04  
**Branch**: `refactor/integrations-f1`  
**Banco**: Supabase local (docker, port 54321) — **NÃO** projeto linked production

---

## 1.1 Tabelas Reais (information_schema.columns)

### `meta_integrations` — EXISTE (11 colunas)

| Coluna | Tipo | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | — |
| organizationId | uuid | NO | — |
| accessToken | text | NO | — |
| refreshToken | text | YES | — |
| expiresIn | integer | YES | — |
| pageAccessToken | text | YES | — |
| phoneNumberId | varchar | YES | — |
| accountId | varchar | YES | — |
| status | varchar | NO | 'connected' |
| createdAt | timestamp w/o tz | NO | CURRENT_TIMESTAMP |
| updatedAt | timestamp w/o tz | NO | — |

**Observação**: Nomes em **PascalCase** (diferente do audit que previa snake_case).  
**Row count**: 0 linhas.

### `integrations` — **NÃO EXISTE** no banco local

```sql
SELECT * FROM information_schema.columns WHERE table_name = 'integrations';
-- 0 rows returned
```

---

## 1.2 Migration 021 — Verificada

**Arquivo**: `supabase/migrations/021_integrations_mode.sql`

```sql
ALTER TABLE integrations
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'OFFICIAL';

DO $$
BEGIN
  ALTER TABLE integrations
    ADD CONSTRAINT integrations_mode_check CHECK (mode IN ('OFFICIAL', 'MANUAL'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
```

- Adiciona `mode` na tabela `integrations`
- Default: `'OFFICIAL'`
- Check: `('OFFICIAL', 'MANUAL')`
- Índice: `idx_integrations_user_mode ON integrations(user_id, mode)`

**Mas a tabela `integrations` não foi criada no banco local** — a migration 018 (`integrations` table creation) não foi aplicada aqui.

---

## 1.3 Supabase DB Diff / Migration List

### `npx supabase migration list` — FALHA
- Local stack (port 54322) não está rodando (container `supabase-db` usa porta 54321)
- Erro: `ECONNREFUSED 127.0.0.1:54322`

### `npx supabase db diff --remote` — FALHA
- Porta 54320 já alocada (outro container Supabase local)
- Não foi possível criar shadow database

**Conclusão**: Não há projeto linked funcional para comparar. O banco local **não reflete** o schema das migrações 018/021.

---

## 1.4 Identificadores de Tenancy / FK

### `meta_integrations` (legacy)
- `organizationId` UUID NOT NULL → FK para `organizations` (conforme Prisma `MetaIntegration.organizationId`)
- RLS policy esperada: `organization_id = current_setting('app.current_org', TRUE)::UUID`

### `integrations` (nova — migration 018/021)
- `user_id` UUID NOT NULL → FK para `auth.users` ON DELETE CASCADE
- RLS policy: `user_id = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid`
- **Único por**: `(user_id, channel, meta_account_id)`

### Código do Repositório (`src/integrations/repository.ts`)
- Usa `workspace_id` como alias para `user_id`
- Query: `.eq('user_id', workspaceId)` — **workspace = user_id**
- Não usa `organizationId`

---

## 1.5 Consumidores no Código

| Arquivo | Tabela | Colunas Esperadas |
|---------|--------|-------------------|
| `src/integrations/repository.ts` | `integrations` | `user_id`, `channel`, `connection_mode`, `provider`, `status`, `status_reason`, `last_checked_at`, `last_error_at`, `external_account_id`, `external_account_label`, `credentials_ref`, `access_token`, `refresh_token`, `expires_at`, `meta_account_id`, `meta_account_name`, `phone_number`, `waba_id`, `meta`, `deleted_at`, `created_at`, `updated_at`, `mode` |
| `src/integrations/meta/accounts.ts` | `meta_integrations` | `id`, `provider`, `display_name`, `phone_number_id`, `whatsapp_business_account_id`, `status`, `connected_at`, `organization_id` |
| `src/integrations/types.ts` (IntegrationRow) | `integrations` | Ver interface — inclui `workspace_id` alias de `user_id`, todos os campos acima |

---

## 1.6 Matriz de Decisão Aplicada

**CASO A** — `integrations` não existe em lugar nenhum (banco local vazio, migrações 018/021 não aplicadas localmente)

**Ação**: Criar a tabela completa na migration `integrations_v2` com `CREATE TABLE IF NOT EXISTS` + `ALTER ... ADD COLUMN IF NOT EXISTS` para idempotência.

---

## Resumo para a Migration

1. **Tabela `integrations`**: Criar do zero (`CREATE TABLE IF NOT EXISTS`) com todas as colunas do contrato Fase 1
2. **Tabela `meta_integrations`**: Já existe (vazia, PascalCase) — backfill usará nomes reais (`organizationId`, `phoneNumberId`, etc.)
3. **Tenancy**: `integrations.user_id` = `workspace_id` (user-level); `meta_integrations.organizationId` = org-level
4. **RLS**: Seguir padrão `user_id = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid` para `integrations`
5. **Backfill**: `meta_integrations` → `integrations` mapeando `organizationId` → precisa de tabela de ponte ou assumir que `user_id` do owner da org — **BLOQUEIO REAL se não houver mapeamento**