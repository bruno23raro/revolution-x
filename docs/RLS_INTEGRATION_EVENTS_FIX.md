# RELATÓRIO DE CORREÇÃO: RLS integration_events

## Data: 2026-11-12

## Resumo Executivo

**STATUS CRÍTICO RECOBERTO**: RLS desativado na tabela `integration_events` em PRODUÇÃO.

### Evidências
| Verificação | Estado em 06/11/2026 | Estado em 12/11/2026 | Impacto |
|-------------|---------------------|---------------------|---------|
| `rowsecurity` | `true` (FORCE) | `false` | **IDOR** - eventos de outros tenants visíveis |
| `policy count` | 2 policies | 0 policies | Nenhum isolamento |
| Políticas | `integration_events_tenant`, `integration_events_service_role` | ❌ Ausentes | Falha crítica |

---

## Análise de Causa Raiz

### 1. Discrepância Temporal
- **06/11/2026**: Banco tinha RLS ativo com 2 policies
- **12/11/2026**: Banco mostra RLS desativado, 0 policies

### 2. Possíveis Causas
1. **Rollback acidental** - alguém executou `ALTER TABLE integration_events DISABLE ROW LEVEL SECURITY`
2. **Migração não aplicada** - migration 028 existia no código mas não foi aplicada em produção
3. **Script de manutenção** - políticas removidas acidentalmente

### 3. Schema Drift Identificado
- **Produção (antiga)**: Tabela com `event_id` como PK, colunas extras
- **Migration 028**: Cria tabela com `id` como PK

---

## Correção Implementada

### Migration Criada: `029_integration_events_rls_fix.sql`

#### Estratégia: Forward-Only, Idempotente

A migration 029 foi criada para:

1. **NÃO recrear tabela** - Usa `DO $$ ...` para verificar se PK já existe
2. **Adicionar colunas ausentes** - `ADD COLUMN IF NOT EXISTS event_id`, `meta_event_id`, `payload_hash`, `processed_at`
3. **Habilitar RLS se desativado** - Check explícito antes de habilitar
4. **Criar policies de forma idempotente** - `IF NOT EXISTS` em todos os `CREATE POLICY`

### SQL Correção

```sql
-- Habilitar RLS (se não estiver habilitado)
DO $$ 
DECLARE rls_enabled BOOLEAN;
BEGIN
  SELECT rowsecurity INTO rls_enabled FROM pg_tables WHERE tablename = 'integration_events';
  IF NOT rls_enabled THEN
    ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Habilitar FORCE RLS
ALTER TABLE integration_events FORCE ROW LEVEL SECURITY;

-- Policies idempotentes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'integration_events' AND policyname = 'integration_events_tenant') THEN
    CREATE POLICY integration_events_tenant ON integration_events FOR ALL TO PUBLIC
      USING (workspace_id = NULLIF(current_setting('app.current_org', true), '')::uuid)
      WITH CHECK (workspace_id = NULLIF(current_setting('app.current_org', true), '')::uuid);
  END IF;
END $$;
```

---

## Preparação para Aplicação em Produção

### ✅ PRE REQUISITOS ATENDIDOS
- [x] Código TypeScript compila sem erros (`tsc --noEmit`)
- [x] ESLint limpo
- [x] Testes RLS criados (`src/tests/rls.test.ts`)
- [x] Factory corrigida (`src/db/factory.ts`)
- [x] Modelo Prisma adicionado (`prisma/schema.prisma`)

### ⏳ REQUERIDO AUTORIZAÇÃO HUMANA
- [ ] **BACKUP DO BANCO DE PRODUÇÃO** - Necessário antes de qualquer operação
- [ ] **APLICAÇÃO DA MIGRATION 029** - Via `psql` ou Supabase CLI
- [ ] **VERIFICAÇÃO PÓS-APLICAÇÃO** - Confirmar RLS e policies funcionais

### Comando para Aplicação (quando autorizado)

```bash
# Via Supabase CLI
npx supabase db push --db-url $DATABASE_URL

# Ou diretamente via psql
psql "postgresql://postgres:MWf4HWz66Vx1EMMw@db.ardpabjoepzhkpmkgwgu.supabase.co:5432/postgres" \
  -f supabase/migrations/029_integration_events_rls_fix.sql
```

### Rollback Plan

```sql
DROP POLICY IF EXISTS integration_events_tenant ON integration_events;
DROP POLICY IF EXISTS integration_events_service_role ON integration_events;
ALTER TABLE integration_events DISABLE ROW LEVEL SECURITY;
```

---

## Testes de Verificação Pós-Aplicação

### Script de Validação

```sql
-- 1. Verificar RLS habilitado
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'integration_events';
-- Esperado: integration_events, true

-- 2. Verificar policies
SELECT policyname, polfor, polroles FROM pg_policies WHERE tablename = 'integration_events';
-- Esperado: 2 policies (tenant + service_role)

-- 3. Teste de isolamento multi-tenant
SET LOCAL app.current_org = 'org-test-uuid';
SELECT COUNT(*) FROM integration_events;
-- Deve retornar 0 (sem contexto válido)

-- 4. Teste de INSERT com workspace errado (deve falhar)
SET LOCAL app.current_org = 'org-test-uuid';
INSERT INTO integration_events (workspace_id, integration_id, event_type, payload) 
VALUES ('other-org-uuid', 'int-uuid', 'connection_success', '{}');
-- Esperado: ERROR - new row violates row-level security policy
```

---

## Arquivos Modificados/Criados

| Arquivo | Tipo | Status |
|---------|------|--------|
| `supabase/migrations/029_integration_events_rls_fix.sql` | Novo | ✅ Criado |
| `src/tests/rls.test.ts` | Modificado | ✅ 5 testes adicionados |
| `src/db/factory.ts` | Modificado | ✅ defaultTenant obrigatório |
| `prisma/schema.prisma` | Modificado | ✅ Modelo IntegrationEvent |
| `docs/FASE_3_5_EXECUTIVE_SUMMARY.md` | Novo | ✅ Criado |
| `docs/RLS_INTEGRATION_EVENTS_FIX.md` | Novo | ✅ Este relatório |

---

## Próximos Passos

1. **HUMANO**: Autorizar backup de produção
2. **HUMANO**: Aplicar migration 029 em produção
3. **QA**: Executar testes de integração multi-tenant
4. **QA**: Monitorar logs por 24h após aplicação
5. **DOCUMENTAÇÃO**: Atualizar MEMORY.md com status final

---

## Referências Cruzadas

- [[FASE 3.5 Exec Summary]] - Resumo executivo
- [[2026-11-06 introspecção produção]] - Evidência auditiva original
- [[Evidências RLS Produção]] - Estado atual verificado
- [[Factory Fix]] - Correção IDOR (verificar se já aplicada)