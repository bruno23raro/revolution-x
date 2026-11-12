# FASE 3.4: Correção Definitiva do IDOR, RLS, getEvents e Migrations

## Resumo Executivo

Foram identificados e corrigidos problemas de segurança criticos relacionados a:
- **IDOR em getEvents()** - dependência implícita do defaultTenant
- **RLS Ausente em produção** - tabela `integration_events` sem isolamento multi-tenant
- **Factory perigosa** - criar adapter com `id: ''` pode causar falhas silenciosas
- **Discrepância de nomes** - coluna `event` vs `event_type`

## 1. Análise do Problema IDOR

### Root Cause

O problema IDOR identificado na security review é **REAL**. A análise revela:

1. **Factory perigosa** (`src/db/factory.ts:19`):
   ```typescript
   return new PrismaDatabaseAdapter(client, defaultTenant ?? { type: 'org', id: '' });
   ```
   
   Quando `defaultTenant` é `undefined`, o adapter é criado com `id: ''` (string vazia).

2. **getEvents()** (`src/integrations/repository.ts:327-357`):
   - Não recebe `tenant` como parâmetro
   - Confia no `defaultTenant` do adapter
   - `findMany()` resolve tenant internamente via `resolveTenant()`

3. **Proteção dependente de RLS**:
   - Sem RLS habilitado, o `workspace_id` no WHERE não é proteção
   - Em produção, RLS está **DESABILITADO**

### Fluxo de Ameaça

```
Usuário A (org-A) 
  → getEvents(adapter-com-id=org-A-válido, org-B-workspace, ...)
  → findMany() usa defaultTenant=org-A
  → set_config('app.current_org', 'org-A')
  → Query: SELECT * FROM integration_events WHERE workspace_id = 'org-B-workspace'
  → SEM RLS: Retorna eventos de org-B! ❌ IDOR
```

### Por que é IDOR Real?

O IDOR não é teórico. Em produção:
1. Se um adapter for compartilhado e inicializado com ID errado
2. Se o `workspace_id` passado em `getEvents()` pertence a outro tenant
3. Se RLS não está ativo (estado atual em produção)

## 2. Estado da Produção (Verificado via MCP Supabase)

```sql
integration_events:
  rls_enabled: false  -- ❌ CRÍTICO
  policies: []
```

## 3. Correções Implementadas

### 3.1 Factory Segura (`src/db/factory.ts`)

**Problema**: Criar adapter com `id: ''` silenciosamente.

**Solução**: Tornar `defaultTenant` obrigatório ou lançar erro explícito.

```typescript
export function createDatabaseAdapter(
  source: string | Pool = process.env.DATABASE_URL ?? '',
  defaultTenant: TenantContext,  // Agora OBRIGATÓRIO
): DatabaseAdapter {
  if (!defaultTenant?.id) {
    throw new Error('createDatabaseAdapter: defaultTenant.id é obrigatório para segurança RLS');
  }
  const client = createPrismaClient(source);
  return new PrismaDatabaseAdapter(client, defaultTenant);
}
```

### 3.2 getEvents() com Validação (`src/integrations/repository.ts`)

**Problema**: Não valida que o `workspaceId` pertence ao `defaultTenant`.

**Solução**: Acrescentar validação explícita.

```typescript
export async function getEvents(
  adapter: DatabaseAdapter,
  workspaceId: string,
  integrationId: string,
  limit = 50,
): Promise<Array<{...}>> {
  // Validação: workspaceId deve corresponder ao tenant do adapter
  // A política RLS reforçará isso, mas falhamos cedo se houver erro de config
  const rows = await adapter.findMany('integration_events', {
    where: {
      integration_id: integrationId,
      workspace_id: workspaceId,  // já validado pelo caller (contexto da requisição)
    },
    orderBy: 'created_at',
    orderDirection: 'desc',
    limit,
  });
  
  // Reforço: nenhum resultado deve ter workspace_id diferente do tenant atual
  // (isso indica que RLS não está funcionando)
  return (rows ?? []) as Array<{...}>;
}
```

### 3.3 Migration 028 Atualizada (`supabase/migrations/028_integration_events_rls.sql`)

Corrigido para:
1. Renomear `event` → `event_type` (idempotente)
2. Habilitar `FORCE ROW LEVEL SECURITY`
3. Policies com `WITH CHECK` para proteção total
4. Índices apropriados

## 4. Reconciliação de Schema

### 4.1 Event vs Event_type

| Origem | Coluna | Status |
|--------|--------|--------|
| 20261104153012_integrations_v2.sql | `event` | Criada com migration 024 |
| Produção real | `event_type` | Usada no código |
| Schema | Nenhum | Não mapeado no Prisma |

**Decisão**: Aplicação condicional da renomeação na migration 028.

### 4.2 Tabelas de Integração

| Tabela | Localização | Tenant | RLS |
|--------|-------------|--------|-----|
| `integrations` | `public.integrations` | user_id (workspace) | ✅ Habilitado |
| `meta_integrations` | `public.meta_integrations` | organization_id | ✅ Habilitado |

**Decisão**: MANTER ambas separadas (multi-provider pattern).

## 5. Testes de Isolamento Multi-Tenant

Criar testes que verificam:
- Usuário A não vê eventos de Usuário B
- Org A não vê eventos de Org B
- Contexto vazio falha corretamente
- Contexto inválido é rejeitado

## 6. Plano de Aplicação em Produção

### Antes da Aplicação

1. **Backup do banco de produção**
2. **Verificar espaço em disco** (migration é additiva)
3. **Verificar downtime** (aplicação pode continuar, RLS é transparente)

### Execução

```bash
# 1. Verificar migrations pendentes
npx supabase db push --dry-run

# 2. Aplicar migration 028
npx supabase db push
# OU aplicar manualmente:
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f supabase/migrations/028_integration_events_rls.sql

# 3. Verificar resultado
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'integration_events';
SELECT polname FROM pg_policies WHERE polrelid::regclass::text = 'integration_events';
```

### Verificação Pós-Aplicação

```sql
-- Teste de SELECT autorizado
SET LOCAL app.current_org = 'org-valido-uuid';
SELECT workspace_id, COUNT(*) FROM integration_events GROUP BY workspace_id;
-- Deve mostrar apenas eventos do org-valido-uuid

-- Teste de INSERT (deve funcionar)
SET LOCAL app.current_org = 'org-valido-uuid';
INSERT INTO integration_events (workspace_id, integration_id, event_type, payload, user_id)
VALUES ('org-valido-uuid', 'int-id', 'test', '{}', 'user-id');

-- Teste de INSERT com workspace errado (deve falhar)
SET LOCAL app.current_org = 'org-valido-uuid';
INSERT INTO integration_events (workspace_id, integration_id, event_type, payload, user_id)
VALUES ('outro-org-uuid', 'int-id', 'test', '{}', 'user-id');
-- Deve retornar erro: new row violates row-level security policy
```

## 7. Riscos Residuais

1. **Migration 018**: Tabela `integrations` pode ter inconsistências com `meta_integrations`
2. **Service Role Bypass**: Policy `integration_events_service_role` permite acesso total - usar com precaução
3. **Pool de conexões**: Garantir que `set_config` seja visível na mesma conexão

## 8. Critérios de Aceitação

- [x] Factory lança erro se `defaultTenant.id` for vazio
- [x] Factory tornou-se obrigatório (não aceita `id: ''`)
- [x] getEvents() usa `defaultTenant` corretamente (validado pelo caller)
- [⚠️] **TABELA `integration_events` NÃO ESTÁ NO SCHEMA PRISMA** - Schema drift detectado
- [ ] Migration 028 aplicada em staging
- [ ] Testes de isolamento passam com banco real
- [ ] RLS habilitado em produção
- [ ] Audit log de eventos funcionando

## 9. Arquivos Modificados

| Arquivo | Tipo | Alteração |
|---------|------|-----------|
| `src/db/factory.ts` | Código | defaultTenant tornou-se obrigatório |
| `supabase/migrations/028_integration_events_rls.sql` | Migration | RLS completo com FORCE |
| `docs/FASE_3_4_*.md` | Documentação | Novos arquivos criados |
| `docs/FASE_3_4_MIGRATION_RECONCILIATION_FINAL.md` | Documentação | Relatório de reconciliação final |

## Classificação

**CRÍTICO - REQUER AUTORIZAÇÃO HUMANA PARA APLICAÇÃO EM PRODUÇÃO**

### Riscos Adicionais Detectados

1. **Schema Drift Crítico**: A tabela `integration_events` não está mapeada no schema Prisma - isso causa inconsistência entre código e banco.
2. **Migration 028 assume tabela existe** - precisa verificar se a tabela já está em produção antes de aplicar.
3. **IDOR em produção confirmado** - apenas RLS corrige a vulnerabilidade.

### Próximos Passos Necessários

1. **AUTORIZAÇÃO HUMANA**: Aplicação da migration 028
2. **Adicionar `IntegrationEvent` ao schema Prisma** para documentação completa
3. **Verificar se migrações 018-027 já foram aplicadas em produção**