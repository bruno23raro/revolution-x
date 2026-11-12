# FASE 3.3: Auditoria Independente getEvents() e Tenant Context

## Resumo Executivo

| Critério | Status |
|----------|--------|
| build | ✅ PASSOU |
| TypeScript | ✅ LIMPO |
| Testes (1080/1080) | ✅ PASSARIOS |
| getEvents() corrigido | ✅ SIM |
| Migration 028 corrigida | ✅ SIM |
| Produção segura | ⚠️ REQUER MIGRATION 028 |

## 1. Problema Identificado

### getEvents() - Ignora parâmetro tenant

**Local:** `src/integrations/repository.ts:323-361`

**Problema original:**
```typescript
export async function getEvents(
  adapter: DatabaseAdapter,
  workspaceId: string,
  integrationId: string,
  limit = 50,
  tenant?: TenantContext        // <-- IGNORADO
): Promise<...> {
  const rows = await adapter.findMany('integration_events', {
    // ...
  });
}
```

**Analysis:**
- A interface `DatabaseAdapter.findMany()` NÃO aceita parâmetro `tenant`
- O `PrismaDatabaseAdapter` resolve `defaultTenant` internamente via `resolveTenant()` e `applyTenant()`
- Se `defaultTenant.id` estiver vazio (`''`), a política RLS falha

**Correção aplicada (2026-11-12):**
- **Remoção do parâmetro `tenant` da assinatura** - ele era opcional e ignorado
- A função agora depende do `defaultTenant` configurado no adapter (padrão do projeto)

## 2. Interface DatabaseAdapter

**Arquivo:** `src/db/types.ts`

```typescript
export interface DatabaseAdapter {
  findMany<T>(model: string, where: Record<string, unknown>, options?: QueryOptions): Promise<T[]>;
  create<T>(model: string, data: Record<string, unknown>, tenant?: TenantContext): Promise<T>;
  update<T>(model: string, where: Record<string, unknown>, data: Record<string, unknown>, tenant?: TenantContext): Promise<T>;
  delete(model: string, where: Record<string, unknown>, tenant?: TenantContext): Promise<void>;
  transaction<T>(tenant: TenantContext, callback: (tx: TransactionClient) => Promise<T>): Promise<T>;
}
```

**Nota:** Apenas `create`, `update`, `delete` e `transaction` recebem `tenant`. `findMany` depende do `defaultTenant` do adapter.

## 3. Implementação PrismaDatabaseAdapter

**Arquivo:** `src/db/prisma-adapter.ts:46-65`

```typescript
async findMany<T>(model: string, where: Record<string, unknown>, options?: QueryOptions): Promise<T[]> {
  const tenant = this.resolveTenant();        // Usa defaultTenant
  await this.applyTenant(tenant);             // set_config('app.current_org', tenant.id, true)
  // ...
}
```

## 4. Estado da Produção - Verificação em Tempo Real

**Tabela `integration_events`:**
- ❌ RLS: **DESABILITADO** (vulnerabilidade crítica)
- ❌ FORCE RLS: **DESABILITADO**
- Colunas: `event_type` ✅, `user_id` ✅, `workspace_id` ✅

**Tabela `integrations`:**
- ✅ RLS: HABILITADO
- ✅ FORCE RLS: HABILITADO
- Policy: `integrations_user` (user_id = app.current_user_id)

## 5. Migration 028 - Correções Aplicadas

**Arquivo:** `supabase/migrations/028_integration_events_rls.sql`

### Alterações feitas:

1. **Renomear coluna `event` → `event_type`:**
   ```sql
   DO $$
   BEGIN
     IF EXISTS (SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'integration_events' AND column_name = 'event') THEN
       ALTER TABLE integration_events RENAME COLUMN event TO event_type;
     END IF;
   END $$;
   ```

2. **Habilitar RLS com FORCE:**
   ```sql
   ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;
   ALTER TABLE integration_events FORCE ROW LEVEL SECURITY;
   ```

3. **Policies multi-tenant:**
   ```sql
   CREATE POLICY integration_events_tenant ON integration_events
     FOR ALL TO PUBLIC
     USING (workspace_id = (NULLIF(current_setting('app.current_org'::text, true), ''::text))::uuid)
     WITH CHECK (...);
   ```

4. **Policy service_role bypass:**
   ```sql
   CREATE POLICY integration_events_service_role ON integration_events
     FOR ALL TO service_role USING (true) WITH CHECK (true);
   ```

## 6. Colisão event/event_type - Contexto

**Migrações locais (dev):**
- `024_integrations_v2.sql` (linha 98): `event TEXT NOT NULL`
- `027_integration_events_cols.sql`: Adiciona `user_id`, `workspace_id`, `payload`, `created_at`

**Produção:**
- Usa `event_type` (schema diferente)
- Possui colunas: `event_id`, `meta_event_id`, `payload_hash`, `processed_at`

**Solução:** Migration 028 agora renomeia `event` → `event_type` para ambientes que vêm das migrations locais.

## 7. Testes de Isolamento Multi-Tenant

### Testes existentes (não cobrem isolation real)

O arquivo `src/integrations/repository.test.ts` usa mocks e NÃO testa:
- Conexão real com banco
- RLS aplicado
- Isolation entre tenants

### Recomendação

Criar testes de integração com banco local:
```typescript
describe('getEvents isolation', () => {
  it('não vaza eventos de tenant A para tenant B', async () => {
    // Criar eventos para tenant A
    // Criar eventos para tenant B
    // Verificar que getEvents(A) não retorna eventos de B
  });
});
```

## 8. Arquivos Modificados

| Arquivo | Tipo | Alteração |
|---------|------|-----------|
| `src/integrations/repository.ts` | Código | Remoção parâmetro `tenant` opcional de `getEvents()` |
| `supabase/migrations/028_integration_events_rls.sql` | Migration | Adição renomeação `event` → `event_type` |

## 9. Comandos de Verificação

```bash
# TypeScript
npx tsc --noEmit

# Testes
npx jest --testPathPattern='repository.test'

# Build
npm run build
```

## 10. Próximos Passos (NÃO EXECUTADOS - BLOCKED)

**Migration 028 deve ser aplicada em produção:**

```bash
# Listar migrations pendentes
npx supabase db push --dry-run

# Aplicar migration 028
# (Requer autorização humana - NÃO EXECUTO AUTOMATICAMENTE)
```

### Riscos Residuais

1. **Migration 018 `integrations` vs `meta_integrations`**: Diferença de esquema (`metadata` vs `meta`)
2. **Testes de isolamento não cobrem RLS real** - recomenda-se testes com banco real
3. **Service role bypass**: Policy `integration_events_service_role` permite acesso total - usar com precaução

---

**Data da auditoria:** 2026-11-12  
**Auditor:** Claude Code (claude-opus-5-5)  
**Status:** ✅ CORREÇÕES LOCALS APLICADAS - AGUARDA AUTORIZAÇÃO PARA PRODUÇÃO