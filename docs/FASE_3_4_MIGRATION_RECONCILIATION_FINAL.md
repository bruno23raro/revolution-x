# FASE 3.4: Reconciliação de Migrations - Relatório Final

## Resumo Executivo

Identificadas **4 inconsistências críticas** entre migrations, schema Prisma e código de produção. A migration 028 está pronta para corrigir o IDOR e habilitar RLS, mas **NÃO PODE SER APLICADA AUTOMATICAMENTE** sem autorização do humano.

---

## 1. Estado Atual da Tabela `integration_events`

### Schema Real em Produção (baseado em migration 027)

| Coluna | Tipo | Origem | Código usa |
|--------|------|--------|------------|
| `id` | UUID PK | 024 | ✅ |
| `integration_id` | UUID FK | 024 | ✅ |
| `workspace_id` | UUID | 027 | ✅ |
| `event_type` | TEXT | 027 (renomeado de `event` via 028) | ✅ |
| `payload` | JSONB | 027 | ✅ |
| `created_at` | TIMESTAMPTZ | 027 | ✅ |
| `user_id` | UUID | 027 | ✅ |
| `event` | TEXT | 024 (não renomeado em alguns ambientes) | ❌ |
| `event_id` | UUID | Produção antiga? | ❓ |
| `meta_event_id` | UUID | Produção antiga? | ❓ |
| `payload_hash` | TEXT | Produção antiga? | ❓ |
| `processed_at` | TIMESTAMPTZ | Produção antiga? | ❓ |

### Problema de Schema Drift

A tabela `integration_events` **NÃO ESTÁ NO SCHEMA PRISMA** (`prisma/schema.prisma`).

O código usa `event_type` mas o Prisma não sabe dessa tabela → **isma client não pode ser usado**.

---

## 2. IDOR - Insecure Direct Object Reference

### Vetor de Ameaça Confirmado

O `getEvents()` em `src/integrations/repository.ts:327` tem IDOR real:

```typescript
export async function getEvents(
  adapter: DatabaseAdapter,      // defaultTenant vem da factory
  workspaceId: string,           // PASSADO PELO CALLER - NÃO VALIDADO
  integrationId: string,
  limit = 50
): Promise<...> {
  const rows = await adapter.findMany('integration_events', {
    where: {
      integration_id: integrationId,
      workspace_id: workspaceId,  // workspace_id do caller, não do tenant do adapter!
    },
    ...
  });
}
```

### Fluxo de Ameaça

1. Usuário A (org-A) chama `getEvents(adapter-org-A, org-B-workspace, integration-X)`
2. Adapter tem `defaultTenant = org-A`
3. Query busca eventos com `workspace_id = org-B-workspace`
4. **SEM RLS**: retorna eventos de org-B! ❌ **IDOR**

---

## 3. Migration 028 - Status

### O que corrige

1. ✅ Renomeia `event` → `event_type` (idempotente)
2. ✅ Habilita RLS com `FORCE ROW LEVEL SECURITY`
3. ✅ Policy multi-tenant com `WITH CHECK`
4. ✅ Service role bypass
5. ✅ Índices otimizados

### O que falta

A migration 028 **NÃO CRIA A TABELA** - ela supõe que a tabela já existe.

Se a tabela `integration_events` NÃO existir em produção, a migration falhará.

### Verificação Necessária

Antes de aplicar, verificar:

```sql
-- Verificar se tabela existe
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'integration_events'
) as table_exists;

-- Verificar colunas
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'integration_events'
ORDER BY ordinal_position;
```

---

## 4. Factory - Status Atual

### Código em `src/db/factory.ts`

```typescript
export function createDatabaseAdapter(
  source: string | Pool = process.env.DATABASE_URL ?? '',
  defaultTenant: TenantContext,  // OBRIGATÓRIO agora
): DatabaseAdapter {
  if (!defaultTenant?.id) {
    throw new Error(
      'createDatabaseAdapter: defaultTenant.id é obrigatório para segurança RLS. ' +
      'O tenant contexto deve ser resolvido a partir do usuário autenticado.'
    );
  }
  const client = createPrismaClient(source);
  return new PrismaDatabaseAdapter(client, defaultTenant);
}
```

**Status**: ✅ CORRIGIDA - `defaultTenant` tornou-se obrigatório.

---

## 5. Estado do RLS em Produção

### Verificado via introspection documental

A produção mostrava:
- `integration_events`: `rowsecurity = false`
- Sem policies

**Status**: ❌ **CRÍTICO** - Tabela sem isolamento multi-tenant.

---

## 6. Plano de Correção

### Etapa 1: Preparação (PENDENTE - Precisa do humano)

1. [ ] **Verificar estado atual do banco de produção**
   - Tabela `integration_events` existe?
   - Colunas corretas?
   - RLS habilitado?

2. [ ] **Fazer backup do banco de produção**

### Etapa 2: Aplicação da Migration 028 (PENDENTE - Autorização necessária)

```bash
# Opção A: via Supabase CLI
npx supabase db push --db-url $DATABASE_URL

# Opção B: via psql
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f supabase/migrations/028_integration_events_rls.sql
```

### Etapa 3: Verificação Pós-Aplicação

```sql
-- Verificar RLS habilitado
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'integration_events';

-- Verificar policies
SELECT polname, polrole FROM pg_policies 
WHERE polrelid::regclass::text = 'integration_events';

-- Teste de isolamento
SET LOCAL app.current_org = 'org-valido-uuid';
SELECT COUNT(*) FROM integration_events;
-- Deve retornar apenas eventos do org-valido-uuid

-- Teste INSERT com workspace errado (deve falhar)
SET LOCAL app.current_org = 'org-valido-uuid';
INSERT INTO integration_events (workspace_id, integration_id, event_type, payload)
VALUES ('outro-org-uuid', 'int-id', 'test', '{}');
-- Deve retornar: "new row violates row-level security policy"
```

---

## 7. Arquivos Criados

| Arquivo | Propósito |
|---------|-----------|
| `docs/FASE_3_4_IDOR_GETEVENTS_FACTORY_FIX.md` | Correção de IDOR e Factory |
| `docs/FASE_3_4_DATABASE_ADAPTER.md` | Arquitetura do DatabaseAdapter |
| `docs/FASE_3_4_MIGRATION_RECONCILIATION_FINAL.md` | Este documento |

---

## 8. Recomendações

1. **Migration 028 deve ser aplicada com autorização explícita do humano**
2. **Adicionar `IntegrationEvent` ao schema Prisma** para documentação completa
3. **Adicionar validação explícita em `getEvents()`** para garantir que `workspaceId` pertence ao tenant
4. **Adicionar testes de RLS com banco real** (não apenas mocks)

---

## 9. Comandos para Verificação

Para o humano verificar o estado atual:

```powershell
# Verificar migrations no banco
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;"

# Verificar tabela integration_events
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\d public.integration_events"

# Verificar RLS
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT tablename, rowsecurity FROM pg_tables WHERE tablename LIKE '%integration%';"
```