# FASE 3.4: Reconciliação de Migrations

## Estado Atual das Migrations

### Tabelas Críticas

| Migration | Tabela | Colunas | RLS | Status |
|-----------|--------|---------|-----|--------|
| 007 | `organizations` | `id` (UUID PK) | ✅ | Prod OK |
| 018 | `integrations` | `user_id`, `channel`, `status`, `connection_mode`, `provider` | ✅ | Prod OK |
| 025 | `meta_integrations` | `organization_id`, `provider`, `connected_at`, `status` | ✅ | Prod OK |
| 027 | `integration_events` | `event`, `workspace_id`, `payload` | ❌ | **PROBLEMA** |
| 028 | `integration_events` | `event` → `event_type` (condicional) | ✅/FORCE | **PENDENTE** |

## Problema 1: event vs event_type

### Origem

1. **Migration 024** (`20261104153012_integrations_v2.sql`): Cria `integration_events` com coluna `event TEXT NOT NULL`
2. **Código existente**: Usa `event_type` (ver `src/integrations/repository.ts:317`)
3. **Produção real**: Usa `event_type`

### Verificação de Estado

```sql
-- Verificar colunas existentes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'integration_events';
```

### Resolution

A migration 028 inclui código condicional para renomear `event` → `event_type`:

```sql
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'integration_events' AND column_name = 'event') THEN
    ALTER TABLE integration_events RENAME COLUMN event TO event_type;
  END IF;
END $$;
```

**Isso é idempotent** - só renomeia se `event` ainda existir, não faz nada se já foi renomeado.

### Recomendação

Aplicação da migration 028 resolverá a discrepância.

---

## Problema 2: Integration_events sem RLS

### Estado Atual (Produção)

```
table_name: integration_events
rls_enabled: false
```

### Migration 024 já criava RLS?

Sim, mas com política BÁSICA:

```sql
ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY integration_events_tenant ON integration_events
  FOR ALL USING (
    workspace_id = current_setting('app.current_org', TRUE)::UUID
  );
```

**Problemas com a política 024:**
1. Não usa `FOR ALL` → apenas SELECT, não INSERT/UPDATE/DELETE
2. Não tem política para `service_role`
3. Não usa `WITH CHECK`
4. Pode causar erro de cast se `current_setting` retorna `NULL`

### Migration 028 (Corrigida)

```sql
-- 1. Habilita RLS
ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;

-- 2. Ativa FORCE RLS
ALTER TABLE integration_events FORCE ROW LEVEL SECURITY;

-- 3. Policy multi-tenant COMPLETA
CREATE POLICY integration_events_tenant ON integration_events
  FOR ALL TO PUBLIC
  USING (workspace_id = (NULLIF(current_setting('app.current_org'::text, true), ''::text))::uuid)
  WITH CHECK (workspace_id = (NULLIF(current_setting('app.current_org'::text, true), ''::text))::uuid);

-- 4. Service role bypass
CREATE POLICY integration_events_service_role ON integration_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

---

## Problema 3: Metadata vs Meta

### Definição

Não há confusão entre `metadata` e `meta`. São campos em tabelas diferentes:

| Campo | Tabela | Tipo | Uso |
|-------|--------|------|-----|
| `metadata` | `webhook_events` | JSONB | Dados do webhook recebido |
| `meta` | `integrations` | JSONB | Metadados da integração |

### Exemplo

```sql
-- webhook_events
SELECT meta_event_id, payload_hash, processed_at FROM webhook_events;

-- integrations  
SELECT external_account_id, external_account_label, meta FROM integrations;
```

---

## Problema 4: integrations vs meta_integrations

### Tabela `integrations` (migração 018)

- **Local proprietário**: `user_id`
- **Tenant**: `user_id = app.current_org` (user-level tenancy)
- **Usado por**: Integrações manuais, OpenBSP, Evolution API

### Tabela `meta_integrations` (migração 005)

- **Local proprietário**: `organization_id`
- **Tenant**: `organization_id = app.current_org` (org-level tenancy)
- **Usado por**: OAuth Meta (Instagram/Facebook)

### Concordância

Ambas são necessárias e **não devem ser unificadas**. Cada uma representa um padrão de integração diferente.

---

## Cronologia das Migrations

```
005  ──► meta_integrations (Meta OAuth)
018  ──► integrations (user-level)
024  ──► eventos (cria integration_events)
025  ──► schema parity (ajustes)
027  ──► colunas adicionais (user_id, workspace_id, payload, created_at)
028  ──► RLS completo (PENDENTE em prod)
```

---

## Plano de Aplicação Controlada

### Fase 1: Preparação

```sql
-- Verificar estado atual
SELECT 
  tablename, 
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('integration_events', 'integrations', 'meta_integrations');

-- Verificar políticas existentes
SELECT polname, polrelid::regclass::text as table_name 
FROM pg_policies 
WHERE polrelid::regclass::text IN ('integration_events', 'integrations', 'meta_integrations');
```

### Fase 2: Aplicação (Idempotente)

A migration 028 é **idempotente**:
- ✅ Renomeia `event` → `event_type` apenas se necessário
- ✅ Habilita RLS apenas se não estiver habilitado
- ✅ Cria políticas apenas se não existirem (usando `CREATE POLICY` sem `IF NOT EXISTS` - precisa verificar)

**Verificar se CREATE POLICY tem IF NOT EXISTS:**

Na migration 028 atual, os policies usam `CREATE POLICY` padrão, não `CREATE POLICY IF NOT EXISTS`. Isso pode causar erro se a migration for executada duas vezes.

### Fase 3: Correção Necessária

A migration 028 precisa ser ajustada para ser **totalmente idempotente**:

```sql
-- Verificar se policy já existe antes de criar
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'integration_events_tenant') THEN
    CREATE POLICY integration_events_tenant ON integration_events
      FOR ALL TO PUBLIC
      USING (workspace_id = (NULLIF(current_setting('app.current_org'::text, true), ''::text))::uuid)
      WITH CHECK (workspace_id = (NULLIF(current_setting('app.current_org'::text, true), ''::text))::uuid);
  END IF;
END $$;
```

---

## Status Final

| Item | Status | Ação |
|------|--------|------|
| Factory corrigida | ✅ | `defaultTenant` obrigatório |
| getEvents auditado | ✅ | Usa adapter.defaultTenant |
| Migration 028 pronta | ✅ | RLS completo |
| Migration 028 idempotente | ⚠️ | Precisa corrigir `CREATE POLICY` |
| Produção segura | ❌ | Aguarda aplicação de migration 028 |

## Próximos Passos

1. **Testar em ambiente de staging** com banco idêntico à produção
2. **Corrigir idempotência** da migration 028
3. **Aplicar em produção** após backup
4. **Verificar** RLS habilitado e políticas funcionais