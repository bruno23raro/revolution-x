# F1 Baseline — Estado do Banco Antes da Migration

**Data**: 2026-11-04
**Branch**: refactor/integrations-f1
**Commit**: $(git rev-parse HEAD)
**Banco**: linked project (ardpabjoepzhkpmkgwgu)

---

## 1. Tabela `integrations` (por usuário)

| Status | Channel | Contagem |
|--------|---------|----------|
| — | — | 0 (tabela vazia) |

**Total**: 0 linhas

---

## 2. Tabela `meta_integrations` (legada, por org)

| Provider | Status | Contagem |
|----------|--------|----------|
| — | — | 0 (tabela vazia) |

**Total**: 0 linhas

---

## 3. Tabela `organizations`

| Campo | Valor |
|-------|-------|
| Total de organizações | 0 |

---

## 4. Observações

- Ambas as tabelas existem mas estão vazias no banco de produção linked
- O backfill da migration Fase 1 não terá dados para migrar
- A constraint `UNIQUE(organization_id, provider)` em `meta_integrations` já existe
- A coluna `mode` (OFFICIAL/MANUAL) já existe na tabela `integrations` via migration 021
- RLS já habilitada nas duas tabelas

---

## 5. Schema Atual (excerto relevante)

### `integrations` (migrations 018 + 021)
- `id` UUID PK
- `user_id` UUID FK → auth.users
- `channel` TEXT CHECK (facebook, instagram, whatsapp, meta)
- `status` TEXT CHECK (PENDING, AUTHENTICATED, CONNECTED, DISCONNECTED, ERROR, EXPIRED, REVOKED)
- `access_token` TEXT
- `refresh_token` TEXT
- `expires_at` TIMESTAMPTZ
- `meta_account_id` TEXT
- `meta_account_name` TEXT
- `phone_number` TEXT
- `waba_id` TEXT
- `metadata` JSONB DEFAULT '{}'
- `last_error` TEXT
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ
- `mode` TEXT NOT NULL DEFAULT 'OFFICIAL' CHECK (OFFICIAL, MANUAL)

**Constraints**: UNIQUE(user_id, channel, meta_account_id)
**RLS**: `user_id = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid` (FORÇADA)

### `meta_integrations` (migration 005)
- `id` UUID PK
- `organization_id` UUID FK → organizations
- `provider` TEXT CHECK (facebook, instagram, whatsapp)
- `meta_page_id` TEXT
- `instagram_account_id` TEXT
- `whatsapp_business_account_id` TEXT
- `phone_number_id` TEXT
- `meta_app_id` TEXT
- `encrypted_access_token` TEXT NOT NULL
- `token_expires_at` TIMESTAMPTZ
- `connected_at` TIMESTAMPTZ DEFAULT NOW()
- `disconnected_at` TIMESTAMPTZ
- `status` TEXT CHECK (PENDING, AUTHENTICATED, CONNECTED, DISCONNECTED, ERROR, EXPIRED, REVOKED, PENDING_WHATSAPP)
- `last_error` TEXT
- `webhook_secret` TEXT

**Constraint**: UNIQUE(organization_id, provider)
**RLS**: `organization_id = current_setting('app.current_org', TRUE)::UUID`