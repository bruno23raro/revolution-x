# FASE 3.4: DatabaseAdapter - Arquitetura e Segurança

## Visão Geral

O `DatabaseAdapter` é a abstração principal para acesso ao banco de dados, projetado para gerenciar **Tenant Context** via PostgreSQL GUC (`app.current_org`) e políticas RLS.

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                     Request Context                         │
│   - Usuário autenticado                                     │
│   - Organization (tenant)                                   │
│   - Workspace / user_id                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              DatabaseAdapter (PrismaDatabaseAdapter)        │
│                                                             │
│   defaultTenant: TenantContext                              │
│   ├─ type: 'org' | 'user'                                   │
│   └─ id: UUID (organizationId ou userId)                    │
│                                                             │
│   Methods:                                                  │
│   - findMany()  → resolveTenant() → applyTenant() → query   │
│   - create()    → resolveTenant(optional) → applyTenant()   │
│   - update()    → resolveTenant(optional) → applyTenant() │
│   - delete()    → resolveTenant(optional) → applyTenant() │
│   - transaction() → applyTenant() → callback              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│             PostgreSQL (Prisma Client)                      │
│                                                             │
│   set_config('app.current_org', tenantId, true)             │
│   │                                                          │
│   ▼                                                          │
│   Query com RLS aplicado                                    │
│   → WHERE workspace_id = current_setting('app.current_org')│
└─────────────────────────────────────────────────────────────┘
```

## Fluxo de Segurança

### 1. Resolução do Tenant (`resolveTenant`)

```typescript
private resolveTenant(tenant?: TenantContext): TenantContext {
  if (!tenant) {
    if (!this.defaultTenant?.id) {
      throw new DatabaseContextError(null);
    }
    return this.defaultTenant;
  }
  if (!tenant.id) {
    throw new DatabaseContextError(tenant);
  }
  return tenant;
}
```

**Comportamento:** Se `tenant` não for passado, usa `defaultTenant`. Se `defaultTenant.id` for vazio ou nulo, lança erro.

### 2. Aplicação do Contexto (`applyTenant`)

```typescript
private async applyTenant(tenant: TenantContext): Promise<void> {
  if (tenant.type === 'org') {
    await this.client.$executeRaw`SELECT set_config('app.current_org', ${tenant.id}, true)`;
  } else {
    await this.client.$executeRaw`SELECT set_config('app.current_user_id', ${tenant.id}, true)`;
  }
}
```

**Importante:** O `true` no terceiro parâmetro torna o `set_config` transacional (visível apenas nesta conexão/transação).

### 3. Query com RLS

```typescript
async findMany<T>(model: string, where: Record<string, unknown>, options?: QueryOptions): Promise<T[]> {
  const tenant = this.resolveTenant();
  await this.applyTenant(tenant);
  // ... query com RLS aplicado pelo PostgreSQL
}
```

## Ponto Crítico Identificado

### Factory Perigosa

O problema identificado é que a `factory` permitia criar um `adapter` com `defaultTenant = { type: 'org', id: '' }`:

```typescript
// ANTIGO (PERIGOSO)
return new PrismaDatabaseAdapter(client, defaultTenant ?? { type: 'org', id: '' });

// NO (CORRIGIDO)
if (!defaultTenant?.id) {
  throw new Error('createDatabaseAdapter: defaultTenant.id é obrigatório');
}
return new PrismaDatabaseAdapter(client, defaultTenant);
```

### Por que o Id é Vazio Perigoso?

1. `resolveTenant()` verifica `if (!tenant)` mas um objeto `{ type: 'org', id: '' }` **não é** `undefined`
2. No entanto, `!this.defaultTenant?.id` seria `true` se `id: ''` → lança erro
3. **O problema é que o erro só acontece em tempo de execução**, não na criação

### Correção Aplicada

A factory agora **requer** `defaultTenant` como argumento obrigatório e valida que `id` não é vazio na criação.

## Testes de Isolamento

### Testes de RLS (src/tests/rls.test.ts)

São executados com dois pools separados:
- `admin`: Conexão admin (BYPASSRLS) - para setup/cleanup
- `rls`: Conexão restrita - para testes de isolamento

### Testes com Prisma (src/tests/prisma-tenant.test.ts)

Usam `withTenantContextOn()` para:
1. Configurar `app.current_org`
2. Executar query
3. Verificar isolamento

## Regras de Segurança

### 1. Tenant Context é OBRIGATÓRIO

- Nenhuma operação de leitura deve ocorrer sem contexto de tenant válido
- `findMany()` depende do `defaultTenant` do adapter
- Operações de escrita (create/update/delete) podem aceitar tenant explícito

### 2. GUC Set Config é Transacional

```typescript
await tx.$executeRaw`SELECT set_config('app.current_org', ${tenantId}, true)`;
```

O `true` garante que o valor é válido apenas para a transação atual, **não afeta outras conexões**.

### 3. RLS deve ser habilitado em Produção

- `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
- `ALTER TABLE table_name FORCE ROW LEVEL SECURITY;` (recomendado)

### 4. Policy CORRETA para multi-tenant

```sql
CREATE POLICY tenant_isolation ON table_name
  FOR ALL TO PUBLIC
  USING (workspace_id = NULLIF(current_setting('app.current_org'::text, true), ''::text)::uuid)
  WITH CHECK (workspace_id = NULLIF(current_setting('app.current_org'::text, true), ''::text)::uuid);
```

O `NULLIF(..., ''::text)` garante que:
- Se `app.current_org` for vazio → `NULL::uuid` → política falha → acesso negado
- Se `app.current_org` for ausente → `current_setting(..., true)` retorna `NULL` → mesmo resultado

## Padrões Recomendados

### 1. Criação de Adapter (pelo serviço)

```typescript
// Em um serviço de tenant-aware
export function createTenantAdapter(
  organizationId: string,
  source?: string,
): DatabaseAdapter {
  const tenant: TenantContext = { type: 'org', id: organizationId };
  return createDatabaseAdapter(source, tenant);
}
```

### 2. Uso em Repository

```typescript
export async function getByChannel(
  adapter: DatabaseAdapter,
  workspaceId: string,
  channel: Channel,
): Promise<IntegrationRow | null> {
  // O adapter já tem o tenant configurado internamente
  const data = await adapter.findMany<IntegrationRow>('integration', {
    channel,
    user_id: workspaceId,
  }, { orderBy: 'created_at', limit: 1 });
  return data?.[0] ?? null;
}
```

### 3. getEvents() - Validação

```typescript
export async function getEvents(
  adapter: DatabaseAdapter,
  workspaceId: string,  // VALIDADO pelo caller (contexto da requisição)
  integrationId: string,
  limit = 50,
): Promise<Array<{...}>> {
  const rows = await adapter.findMany('integration_events', {
    where: {
      integration_id: integrationId,
      workspace_id: workspaceId,
    },
    orderBy: 'created_at',
    orderDirection: 'desc',
    limit,
  });
  return (rows ?? []) as Array<{...}>;
}
```

## Referências

- [Supabase RLS Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [PostgreSQL set_config](https://www.postgresql.org/docs/current/functions-config.html)
- Testes: `src/tests/rls.test.ts`, `src/tests/prisma-tenant.test.ts`