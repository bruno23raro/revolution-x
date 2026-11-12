# FASE 3.3: Auditoria da Migration 028 - RLS para integration_events

## Visão Geral

A migration 028 é uma correção de segurança CRÍTICA que habilita Row Level Security (RLS) para a tabela `integration_events`, que anteriormente estava sem isolamento multi-tenant.

## Estrutura da Migration

```sql
-- Migration 028_integration_events_rls.sql
-- Versão corrigida em 2026-11-12
```

### 1. Renomeação de Coluna (Adicionado)

```sql
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'integration_events' AND column_name = 'event') THEN
    ALTER TABLE integration_events RENAME COLUMN event TO event_type;
    COMMENT ON COLUMN integration_events.event_type IS 'Tipo do evento: connection_success, connection_failed, disconnection, credential_renewal, mode_switch, error';
  END IF;
END $$;
```

**Por que?**
- Migration 024/20261104 cria a coluna como `event`
- Produção já usa `event_type`
- Código usa `event_type`
- Esta condição garante idempotência

### 2. Habilitar RLS

```sql
ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_events FORCE ROW LEVEL SECURITY;
```

**FORCE RLS:** Garante que até `superuser` e `bypassrls` não possam acessar dados sem passar pela política.

### 3. Policy de Tenant

```sql
CREATE POLICY integration_events_tenant ON integration_events
  FOR ALL TO PUBLIC
  USING (workspace_id = (NULLIF(current_setting('app.current_org'::text, true), ''::text))::uuid)
  WITH CHECK (workspace_id = (NULLIF(current_setting('app.current_org'::text, true), ''::text))::uuid);
```

**Análise:**
- `current_setting('app.current_org', true)` retorna NULL se GUC não definido
- `NULLIF(..., ''::text)` retorna NULL se valor vazio
- Cast para UUID resulta em NULL
- Política falha quando `workspace_id != NULL` → acesso negado

**Critério de segurança:**
- Usuário vê apenas eventos com `workspace_id` igual ao contexto do tenant
- INSERT/UPDATE/DELETE também restringidos pelo `WITH CHECK`

### 4. Policy Service Role

```sql
CREATE POLICY integration_events_service_role ON integration_events
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
```

**Justificativa:**
- Operações admin precisam de acesso total
- Service role é limitado a processos autorizados
- Não expor service_role key no cliente

### 5. Índices

```sql
CREATE INDEX IF NOT EXISTS idx_integration_events_workspace_id ON integration_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_integration_events_integration_id_workspace ON integration_events(integration_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_integration_events_created_at_desc ON integration_events(created_at DESC);
```

**Justificativa:**
- `workspace_id`: filtro principal RLS
- `(integration_id, workspace_id)`: queries por integração dentro de tenant
- `created_at DESC`: ordenação por data (auditoria)

## Verificação em Produção

### Estado Atual (consultado via MCP Supabase)

```
integration_events:
  rls_enabled: false
  force_rls: false

integrations:
  rls_enabled: true
  force_rls: true
  policies: ['integrations_user']

meta_integrations:
  rls_enabled: true
  force_rls: true
  policies: ['meta_integrations_tenant']
```

### Gap de Segurança

❌ **CRÍTICO:** `integration_events` SEM RLS permite:
- Usuário A ler eventos de Usuário B
- Usuário A inserir eventos fake
- Exfiltração de dados de auditoria

## Testes Recomendados

### 1. Teste de SELECT Autorizado

```sql
-- Contexto: app.current_org = 'org-A-uuid'
SELECT * FROM integration_events WHERE workspace_id = 'org-A-uuid'; -- ✅ Passa
SELECT * FROM integration_events WHERE workspace_id = 'org-B-uuid'; -- ❌ Bloqueado
```

### 2. Teste de INSERT

```sql
-- Contexto: app.current_org = 'org-A-uuid'
INSERT INTO integration_events (workspace_id, ...) VALUES ('org-A-uuid', ...); -- ✅ Passa
INSERT INTO integration_events (workspace_id, ...) VALUES ('org-B-uuid', ...); -- ❌ Bloqueado por WITH CHECK
```

### 3. Teste Service Role

```sql
-- Como service_role:
SELECT * FROM integration_events; -- ✅ Passa (bypass)
```

## Dependências

| Migration | Dependência | Status |
|-----------|-------------|--------|
| 018 | Cria `integrations` | ✅ Necessária para FK |
| 024 | Cria `integration_events` com coluna `event` | ✅ Necessária |
| 027 | Adiciona `user_id`, `workspace_id`, `payload`, `created_at` | ✅ Necessária |

## Aplicação em Ambiente Local

```bash
# Verificar migrations pendentes
npx supabase db push --dry-run

# Aplicar migrations
npx supabase db push

# Verificar RLS
psql -h localhost:54321 -U postgres -d postgres -c "
SELECT tablename, rowsecurity, forcerowsecurity 
FROM pg_tables 
WHERE tablename = 'integration_events';
"
```

## Riscos

1. **Política vazia se defaultTenant.id = ''**: Se o adapter for criado com ID vazio, nenhuma linha será retornada
2. **Performance**: FK ausente em `integration_id` pode causar lenta para joins
3. **Timestamp inconsistente**: `created_at` pode não estar ordenado corretamente

## Conclusão

A migration 028 **deve ser aplicada** em todos os ambientes (dev, staging, prod) para:

1. Garantir isolamento multi-tenant dos eventos
2. Corrigir discrepância de nomes `event` → `event_type`
3. Adicionar índices de performance

**Classificação:** GO PARA APLICAÇÃO CONTROLADA

---

**Data:** 2026-11-12  
**Verificado por:** Claude Code (claude-opus-5-5) via MCP Supabase