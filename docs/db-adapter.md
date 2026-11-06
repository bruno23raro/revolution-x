# Database Adapter — Revolution X

**Fase:** A (F1.01)  
**Data:** 2026-11-05  
**Status:** ✅ Implementado, em deploy

---

## Visão Geral

O **Database Adapter** é uma camada de abstração que unifica o acesso ao banco de dados sob uma interface CRUD genérica, substituindo o uso direto do cliente Supabase/Prisma em toda a codebase.

### Por que existe?

- **Multi-tenant com RLS**: Todas as operações de escrita exigem `TenantContext` para injetar `set_config('app.current_org', ...)` ou `set_config('app.current_user_id', ...)` antes das queries.
- **Testabilidade**: Interfaces permitem mocks simples em testes unitários.
- **Abstração de provedor**: O mesmo código funciona com Prisma + PostgreSQL, podendo ser substituído por outro provedor no futuro.

---

## Arquitetura

```
┌─────────────────────────────────────────┐
│  Camada de Negócio (repository.ts)      │
│  - getByChannel, upsertConnection, etc. │
└──────────────┬──────────────────────────┘
               │ usa
               ▼
┌─────────────────────────────────────────┐
│  DatabaseAdapter (interface)            │
│  - findMany, findUnique, create         │
│  - update, delete, transaction          │
└──────────────┬──────────────────────────┘
               │ implementa
               ▼
┌─────────────────────────────────────────┐
│  PrismaDatabaseAdapter                  │
│  - Mapeia nomes de modelo               │
│  - Aplica set_config para RLS           │
│  - Encapsula PrismaClient               │
└──────────────┬──────────────────────────┘
               │ usa
               ▼
┌─────────────────────────────────────────┐
│  PrismaClient + PostgreSQL              │
│  (com RLS policies ativas)              │
└─────────────────────────────────────────┘
```

---

## Tipos Principais

### `TenantContext`

```typescript
type TenantContext = {
  type: 'org' | 'user';
  id: string;
};
```

- **`type: 'org'`** → injeta `app.current_org` (tabelas de negócio)
- **`type: 'user'`** → injeta `app.current_user_id` (tabelas pessoais)

### `DatabaseAdapter`

```typescript
interface DatabaseAdapter {
  findMany<T>(model, where, options?): Promise<T[]>;
  findUnique<T>(model, where): Promise<T | null>;
  create<T>(model, data, tenant?): Promise<T>;
  update<T>(model, where, data, tenant?): Promise<T>;
  delete(model, where, tenant?): Promise<void>;
  transaction<T>(tenant, callback): Promise<T>;
}
```

**Regra crítica**: `create`, `update` e `delete` exigem `tenant` (ou usam `defaultTenant` do construtor). `findMany` e `findUnique` leem o tenant do contexto atual.

### `QueryOptions`

```typescript
interface QueryOptions {
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  select?: string[] | null;
}
```

---

## Factory

```typescript
import { createDatabaseAdapter } from './db/factory';

const adapter = createDatabaseAdapter();
```

- Usa `DATABASE_URL` do `.env` automaticamente
- Aceita conexão string ou `pg.Pool` injetado (para testes)
- Retorna `PrismaDatabaseAdapter` com `defaultTenant` opcional

---

## Mapeamento de Modelos

O adapter traduz nomes de modelo usados pela API para nomes do PrismaClient:

| Nome na API | Nome no Prisma | Tabela SQL |
|-------------|----------------|------------|
| `'integration'` | `integration` | `integration` |
| `'integrations'` | `integration` | `integration` |
| `'integrationEvents'` | `integrationEvent` | `integration_events` |
| `'contact'` | `contact` | `contact` |
| `'lead'` | `lead` | `lead` |
| `'deal'` | `deal` | `deal` |
| `'campaign'` | `campaign` | `campaign` |

---

## Exemplo de Uso

### Repositório de Integrações

```typescript
import type { DatabaseAdapter, TenantContext } from '../db/types';

export async function getByChannel(
  adapter: DatabaseAdapter,
  workspaceId: string,
  channel: Channel,
  tenant?: TenantContext
): Promise<IntegrationRow | null> {
  const resolvedTenant = tenant ?? { type: 'org', id: workspaceId };
  
  const data = await adapter.findMany<IntegrationRow>('integration', {
    channel,
    user_id: workspaceId,
  }, { orderBy: 'created_at', orderDirection: 'desc', limit: 1 });
  
  return data?.[0] ?? null;
}
```

### Em uma API Route

```typescript
import { createDatabaseAdapter } from '@/db/factory';
import { getIntegration } from '@/integrations/repository';

export async function GET(req: Request) {
  const adapter = createDatabaseAdapter();
  const session = await getSession(req);
  
  const integration = await getIntegration(adapter, session.userId);
  
  return Response.json(integration);
}
```

---

## Testes

### Mock Simples

```typescript
function makeMockAdapter(): DatabaseAdapter {
  return {
    findMany: jest.fn(async () => []),
    findUnique: jest.fn(async () => null),
    create: jest.fn() as unknown as DatabaseAdapter['create'],
    update: jest.fn() as unknown as DatabaseAdapter['update'],
    delete: jest.fn() as unknown as DatabaseAdapter['delete'],
    transaction: jest.fn() as unknown as DatabaseAdapter['transaction'],
  };
}
```

### Teste de Requisito de Tenant

```typescript
it('lança DatabaseContextError quando tenant é inválido', async () => {
  const adapter = makeMockAdapter();
  
  await expect(
    adapter.create('integration', { user_id: '123' }, { type: 'org', id: '' })
  ).rejects.toThrow('missing required field');
});
```

---

## RLS (Row Level Security)

As políticas RLS no banco esperam:

```sql
-- Para tabelas de org
WHERE app.current_org = organization_id

-- Para tabelas de usuário
WHERE app.current_user_id = user_id
```

O adapter aplica automaticamente via `set_config`:

```typescript
await this.client.$executeRaw`SELECT set_config('app.current_org', ${tenant.id}, true)`;
```

**Importante**: `set_config(..., true)` faz a configuraçãopersistir apenas na conexão atual, não afetando outras requisições.

---

## Arquivos

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/db/types.ts` | Interfaces e tipos (`DatabaseAdapter`, `TenantContext`, `QueryOptions`) |
| `src/db/adapter.ts` | Definição da interface (re-export para compatibilidade) |
| `src/db/prisma-adapter.ts` | Implementação concreta com Prisma |
| `src/db/factory.ts` | Factory `createDatabaseAdapter()` |
| `src/db/adapter.test.ts` | Testes da interface |
| `src/integrations/repository.ts` | Repositório migrado para usar adapter |
| `src/integrations/repository.test.ts` | Testes do repositório com mock |

---

## Checklist de Migração

Para migrar um novo repositório para o padrão DatabaseAdapter:

1. [ ] Receber `adapter: DatabaseAdapter` como primeiro parâmetro
2. [ ] Resolver `tenant` via `tenant ?? { type: 'org', id: workspaceId }`
3. [ ] Lançar `DatabaseContextError` se `tenant.id` for vazio
4. [ ] Usar `adapter.findMany/findUnique/create/update/delete` em vez de `prisma.*`
5. [ ] Passar `resolvedTenant` em operações de escrita
6. [ ] Atualizar testes com `makeMockAdapter()`

---

## Status

| Item | Status |
|------|--------|
| Interface + tipos | ✅ Concluído |
| Implementação Prisma | ✅ Concluída |
| Factory | ✅ Concluída |
| Testes unitários | ✅ 17/17 passing |
| TypeScript | ✅ 0 erros |
| Migração repository.ts | ✅ Concluída |
| Deploy produção | 🔄 Em andamento |
| Testes integração RLS | ⏳ Pendente (F1.07) |
