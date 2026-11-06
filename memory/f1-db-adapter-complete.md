---
name: f1-db-adapter-complete
description: F1 DatabaseAdapter interface + PrismaAdapter implementados, repository.ts migrado, testes 834/834 passando
metadata:
  type: project
---

## F1 — Database Adapter (2026-11-05)

**Status:** ✅ Implementação completa, em deploy para produção

### O que foi feito

1. **Interface `DatabaseAdapter`** em `src/db/types.ts`
   - `findMany`, `findUnique`, `create`, `update`, `delete`, `transaction`
   - `TenantContext` com `type: 'org' | 'user'` e `id: string`
   - `QueryOptions` com orderBy, limit, offset, select
   - `DatabaseContextError` para validação de tenant

2. **Implementação `PrismaDatabaseAdapter`** em `src/db/prisma-adapter.ts`
   - Mapeia nomes de modelo (integrations → integration, etc.)
   - Aplica `set_config('app.current_org', ...)` ou `set_config('app.current_user_id', ...)` antes de cada operação
   - `transaction()` usa proxy com métodos reduzidos

3. **Factory** em `src/db/factory.ts`
   - `createDatabaseAdapter(source?, defaultTenant?)`
   - Usa `DATABASE_URL` do `.env` por padrão
   - Aceita `pg.Pool` injetado para testes

4. **Migração do repositório de integrações**
   - `src/integrations/repository.ts` migrado de SupabaseClient para DatabaseAdapter
   - Todas as funções recebem `adapter: DatabaseAdapter` como primeiro parâmetro
   - `logEvent` corrigido: usa `adapter.create('integration_events', ...)`
   - Erros de redeclaração de variável corrigidos

5. **Testes atualizados**
   - `src/integrations/repository.test.ts` reescrito com mocks typed
   - `src/db/adapter.test.ts` para validação da interface
   - **834/834 testes passando, tsc 0 erros**

### Arquivos criados/modificados

- `src/db/types.ts` (novo)
- `src/db/adapter.ts` (novo)
- `src/db/prisma-adapter.ts` (novo)
- `src/db/factory.ts` (novo)
- `src/db/adapter.test.ts` (novo)
- `src/integrations/repository.ts` (modificado)
- `src/integrations/repository.test.ts` (modificado)
- `docs/db-adapter.md` (novo)

### Commits

- `59d9220` feat(fase-a): DatabaseAdapter interface + PrismaAdapter implementation + types
- `b211455` fix(integrations): F1.06 fix repository.ts logEvent calls and update tests for DatabaseAdapter

### Deploy

- Branch: `refactor/db-adapter-f1`
- Build UUID: `01a1ae32-41c5-708a-a219-d7d8f46024d0`
- Status: Em andamento (2026-11-06)

### Pendentes

- **F1.07**: Testes de integração validando set_config e RLS no PrismaAdapter (requer banco local)
- **F1.08**: Documentação em `docs/db-adapter.md` ✅ concluída

**Why:** DatabaseAdapter é a base para multi-tenancy com RLS no Revolution X.
**How to apply:** Novos repositórios devem usar `DatabaseAdapter` como primeira dependência, nunca PrismaClient diretamente.
