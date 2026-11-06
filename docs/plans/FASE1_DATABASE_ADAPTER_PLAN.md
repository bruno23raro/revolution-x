# Fase 1 — Database Adapter Work Plan

**Projeto**: Revolution X
**Data**: 2026-11-04
**Branch alvo**: `refactor/db-adapter-f1`
**Status**: PLANEJAMENTO

---

## 1. Objetivos

### Objetivos Measuráveis
1. **Abstração unificada**: Criar interface `DatabaseAdapter` que encapsula acesso a PostgreSQL via Prisma/Supabase, eliminando chamadas diretas de `prisma` espalhadas nos repositories
2. **Tenant context garantido**: Toda query passa por contexto `app.current_org` ou `app.current_user_id` via transações `set_config`, com validação em tempo de compilação
3. **Testabilidade**: Repositories recebem adapter injetado; testes unitários usam `createPrismaClient` com pool em memória (pg-mem adaptado) ou stub thenable
4. **Zero breaking changes**: Gates existentes mantidos — `tsc --noEmit` exit 0, `jest` 833/833 verdes, `eslint` 0 erros
5. **Documentação de contrato**: Interface e exemplos de uso publicados em `docs/` com exemplos reais de repositories (`crmRepoReal`, `integrations/repository`)

**Critério de sucesso Fase 1**: Adapter implementado, 3 repositories migrados (contacts, campaigns, integrations), testes verdes, documentação publicada.

---

## 2. Escopo

### Dentro do Escopo
- Interface `DatabaseAdapter` com métodos CRUD base: `findMany`, `findUnique`, `create`, `update`, `delete`, `transaction`
- Implementação `PrismaDatabaseAdapter` usando `src/lib/prisma.ts` e `withTenantContextOn/withUserContextOn`
- Factory `createAdapter({ tenantType, id })` para resolver adapter por contexto
- Migração de `src/repositories/crmRepoReal.ts`, `src/repositories/campaignRepoReal.ts`, `src/integrations/repository.ts` para usar adapter
- Testes unitários com stub thenable (padrão F1) para adapter e repositories
- Validação de RLS: garantir que `set_config` é chamado antes de qualquer query

### Fora do Escopo
- Criptografia de colunas sensíveis (`TODO(cripto)` Fase 7)
- Pooling avançado ou read replicas
- Suporte a múltiplos bancos simultâneos
- Cache de query ou ORM custom
- Mudança de schema — Fase 1 não altera migrations

---

## 3. Tarefas

### F1.01 — Criar interface do adapter
- **ID**: F1.01
- **Descrição**: Definir `DatabaseAdapter` interface tipada com métodos CRUD e transação
- **Arquivos**: `src/db/adapter.ts` (novo), `src/db/types.ts` (novo)
- **Acceptance Criteria**:
  - Interface exporta `DatabaseAdapter` com métodos `findMany<T>`, `findUnique<T>`, `create<T>`, `update<T>`, `delete<T>`, `transaction`
  - Métodos aceitam `workspaceId` ou `userId` e `tenantType: 'org'|'user'`
  - TypeScript strict passa sem `any`
- **Esforço**: 2h
- **Dependências**: Nenhuma

### F1.02 — Implementar PrismaDatabaseAdapter
- **ID**: F1.02
- **Descrição**: Implementar adapter real sobre Prisma client com `withTenantContextOn`
- **Arquivos**: `src/db/prisma-adapter.ts` (novo), `src/lib/prisma.ts` (refatorar para expor `createPrismaClient`)
- **Acceptance Criteria**:
  - `PrismaDatabaseAdapter` implementa `DatabaseAdapter`
  - `transaction` usa `client.$transaction` e chama `set_config` dentro da transação
  - Lança `DatabaseContextError` se `workspaceId` ausente
- **Esforço**: 4h
- **Dependências**: F1.01

### F1.03 — Factory de criação
- **ID**: F1.03
- **Descrição**: Criar factory `createDatabaseAdapter()` que resolve adapter por variáveis de ambiente
- **Arquivos**: `src/db/factory.ts` (novo)
- **Acceptance Criteria**:
  - Factory retorna `PrismaDatabaseAdapter` em prod/dev
  - Aceita `source: string | Pool` para testes
  - Logs de inicialização em dev
- **Esforço**: 1h
- **Dependências**: F1.02

### F1.04 — Migrar crmRepoReal para adapter
- **ID**: F1.04
- **Descrição**: Refatorar `src/repositories/crmRepoReal.ts` para injetar `DatabaseAdapter`
- **Arquivos**: `src/repositories/crmRepoReal.ts` (modificado), `src/repositories/crmRepoReal.test.ts` (novo)
- **Acceptance Criteria**:
  - `contactRepoReal` recebe adapter via parâmetro ou singleton
  - Métodos `findByOrganization` e `create` usam `adapter.transaction`
  - Testes unitários com mock thenable passam
- **Esforço**: 3h
- **Dependências**: F1.03

### F1.05 — Migrar campaignRepoReal para adapter
- **ID**: F1.05
- **Descrição**: Refatorar `src/repositories/campaignRepoReal.ts` para adapter
- **Arquivos**: `src/repositories/campaignRepoReal.ts` (modificado)
- **Acceptance Criteria**:
  - Repository usa adapter para queries de campaign e recipients
  - Tenant context aplicado corretamente
- **Esforço**: 3h
- **Dependências**: F1.03

### F1.06 — Migrar integrations repository para adapter
- **ID**: F1.06
- **Descrição**: Refatorar `src/integrations/repository.ts` para usar `DatabaseAdapter` ao invés de Supabase client direto
- **Arquivos**: `src/integrations/repository.ts` (modificado), `src/integrations/repository.test.ts` (atualizar mocks)
- **Acceptance Criteria**:
  - Métodos `getByChannel`, `upsertConnection`, `setStatus`, `logEvent` usam adapter
  - Testes existentes 16/16 verdes mantidos
  - Mock thenable adaptado para adapter
- **Esforço**: 5h
- **Dependências**: F1.03, F1.04

### F1.07 — Testes de integração adapter
- **ID**: F1.07
- **Descrição**: Criar testes de integração que validam `set_config` é chamado
- **Arquivos**: `src/db/adapter.test.ts` (novo)
- **Acceptance Criteria**:
  - Teste verifica que `withTenantContextOn` chama `set_config` com org correta
  - Teste verifica erro quando contexto não definido
  - Cobertura >80% para adapter
- **Esforço**: 2h
- **Dependências**: F1.02

### F1.08 — Documentação
- **ID**: F1.08
- **Descrição**: Documentar interface, exemplos de uso, e migration guide
- **Arquivos**: `docs/db-adapter.md` (novo), `docs/decisions.md` (atualizar)
- **Acceptance Criteria**:
  - Docs explica interface, factory, e como migrar repository existente
  - Exemplo real com `crmRepoReal`
  - Registra decisão de abstração em `docs/decisions.md`
- **Esforço**: 2h
- **Dependências**: F1.06

---

## 4. Technical Design

### 4.1 Adapter Interface Contract

```typescript
export interface DatabaseAdapter {
  findMany<T>(model: string, where: Record<string, unknown>, options?: QueryOptions): Promise<T[]>;
  findUnique<T>(model: string, where: Record<string, unknown>): Promise<T | null>;
  create<T>(model: string, data: Record<string, unknown>, tenant: TenantContext): Promise<T>;
  update<T>(model: string, where: Record<string, unknown>, data: Record<string, unknown>, tenant: TenantContext): Promise<T>;
  delete(model: string, where: Record<string, unknown>, tenant: TenantContext): Promise<void>;
  transaction<T>(tenant: TenantContext, callback: (tx: TransactionClient) => Promise<T>): Promise<T>;
}

export type TenantContext = {
  type: 'org' | 'user';
  id: string;
}
```

**Decisão**: Interface genérica por modelo string para evitar acoplamento com Prisma types. Repositories mapeiam para Prisma queries internas.

### 4.2 Database Schema Requisitos

- **Existente**: Tabela `integrations` com `user_id`, `channel`, `connection_mode`, `status`, `deleted_at`, RLS habilitada
- **Existente**: `integration_events` com RLS dual
- **Existente**: `contacts`, `campaigns`, `campaign_recipients` com `organizationId`
- **Gate**: Verificar índices `uq_integrations_workspace_channel_mode` e `idx_integrations_workspace_channel_status` existem

### 4.3 Connection Management

- **Singleton**: `src/lib/prisma.ts` mantém `PrismaClient` singleton com `PrismaPg` adapter sobre `pg.Pool`
- **Tenant context**: `withTenantContextOn` chama `SELECT set_config('app.current_org', ${orgId}, true)` dentro de `$transaction`
- **User context**: `withUserContextOn` chama `set_config('app.current_user_id', ...)`
- **Pool**: Criado por `new Pool({ connectionString })`; testes podem passar `Pool` custom

### 4.4 Error Handling Strategy

- `DatabaseContextError`: Lançado se `tenant.id` ausente antes de query
- `DatabaseConstraintError`: Mapeia PostgreSQL code 23505 para `DuplicateIntegrationError`
- `DatabaseRLSError`: Mapeia 42501 para mensagem amigável
- Nunca expõe stack trace para UI; log interno via `src/lib/prisma.ts` logs

### 4.5 Testing Approach

- **Unit**: Mock thenable (padrão F1) para `DatabaseAdapter`; cada teste declara fila FIFO de resultados
- **Integration**: Testes reais contra PostgreSQL dockerizado com `supabase-docker`; validam `set_config`
- **Regression**: `jest` suite existente mantida — 833/833 verdes

---

## 5. Gate Criteria

Fase 1 completa quando **todos** os seguintes passam:

### TypeScript
```bash
npx tsc --noEmit
# EXIT CODE 0
```

### Tests
```bash
npx jest src/db src/repositories/crmRepoReal src/repositories/campaignRepoReal src/integrations/repository
# Test Suites: 60+ passed
# Tests: 850+ passed (833 existentes + novos)
```

### Lint
```bash
npx eslint src/db src/repositories --ext .ts
# 0 errors, warnings aceitáveis em growth pages
```

### Validação Manual
1. Adapter cria sem erro em dev (`DATABASE_URL` presente)
2. `crmRepoReal.findByOrganization` retorna dados com tenant context aplicado
3. `integrations.repository.upsertConnection` mantém constraint única
4. Logs Prisma mostram `set_config` sendo executado
5. Documentação publicada em `docs/db-adapter.md`

---

## 6. Risks & Mitigations

### R1 — Regressão em repositories existentes
**Risco**: Refatorar repositories quebra queries existentes
**Mitigação**: Migrar um por vez, testes unitários antes/depois, `git stash` de backup, validar com `tsc` e `jest` a cada passo

### R2 — Perda de contexto RLS
**Risco**: Adapter esquece `set_config`, expondo dados entre tenants
**Mitigação**: Testes de integração verificam `current_setting`; code review obrigatório para `transaction` method; lint rule para proibir queries sem contexto

### R3 — Mock thenable quebra com adapter
**Risco**: Mudança de assinatura quebra mocks existentes em `repository.test.ts`
**Mitigação**: Manter compatibilidade de interface; mock adapter retorna objeto thenable idêntico ao Supabase padrão

### R4 — Performance
**Risco**: Camada adapter adiciona overhead
**Mitigação**: Benchmark de queries críticas (`findByOrganization`); adapter é thin wrapper sem lógica extra

### R5 — Inconsistência Prisma vs Supabase
**Risco**: Algumas partes usam Supabase client, outras Prisma
**Mitigação**: Fase 1 limita-se a repositories Prisma; integração Supabase permanece via `src/integrations/repository.ts` original até Fase 2

---

## 7. Dependências Externas

- `DATABASE_URL` em `.env.local` (existente)
- `SUPABASE_SERVICE_ROLE_KEY` para admin queries (existente)
- Migrations 024 aplicadas (integrations v2)
- `pg@^8`, `@prisma/client@^7`, `@prisma/adapter-pg@^7` já instalados

---

## 8. Próximos Passos Pós-Fase 1

- **Fase 2**: Migrar repositories Supabase para adapter
- **Fase 3**: Criptografia de tokens (`TODO(cripto)` Fase 7)
- **Fase 4**: Adapter para read replicas e multi-region

---

**Aprovado por**: Bruno
**Data de início prevista**: 2026-11-04
**Estimativa total**: 22h
