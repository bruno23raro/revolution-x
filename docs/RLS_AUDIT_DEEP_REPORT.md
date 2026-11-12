# Auditoria Deep RLS - Tabelas sem Row Level Security
**Projeto:** Revolution X (ardpabjoepzhkpmkgwgu)
**Data:** 2026-11-12
**Auditor:** DBA Senior via Claude Code

---

## 1. Resumo Executivo

### Estado Atual das Tabelas

Baseado na auditoria pós-FASE 3.5 (ver `docs/FASE_3_5_FINAL_REPORT_2026-11-12.md`):

| Métrica | Valor |
|---------|-------|
| Tabelas com RLS | 40/64 (62.5%) |
| Tabelas sem RLS | 24/64 (37.5%) |
| Tabelas críticas sem RLS | 13 |

---

## 2. Mapeamento de Tabelas sem RLS Críticas

### Lista Completa de Tabelas sem RLS

```
organizations, organization_members, roles, permissions
subscriptions, usage, billing_events
products, product_variations
```

**Nota sobre tabelas de inventário:**
- `warehouses`, `stock_balances`, `inventory_movements` - **NÃO EXISTEM** em produção
- Verificado: nenhuma migration cria essas tabelas
- Modelo Prisma menciona, mas não foram criadas no banco
- **Ações:** Não aplicável - tabelas inexistentes

### Matriz de Risco RLS por Tabela

| Tabela | Nível de Risco | Justificativa | Status Atual |
|--------|---------------|---------------|--------------|
| **organizations** | **CRÍTICO** | Tenant root - isolamento multi-tenant essencial | SEM RLS |
| **organization_members** | **CRÍTICO** | Membros vinculados a tenants | SEM RLS |
| **subscriptions** | **CRÍTICO** | Dados de billing/assinaturas | SEM RLS |
| **billing_events** | **CRÍTICO** | Eventos financeiros sensíveis | SEM RLS |
| **usage** | **CRÍTICO** | Métricas de uso por tenant | SEM RLS |
| **users** | MÉDIO | Gerenciado via Auth (RLS do Supabase), mas `auth.users` pode precisar de políticas | Via Auth |
| **roles** | MÉDIO | Permissões de tenant | SEM RLS |
| **permissions** | BAIXO | Permissões globais do sistema | SEM RLS |
| **products** | MÉDIO | Dados e-commerce por tenant | SEM RLS |
| **product_variations** | MÉDIO | Variações de produtos | SEM RLS |
| **warehouses** | MÉDIO | Inventário físico | SEM RLS |
| **stock_balances** | MÉDIO | Saldo de estoque | SEM RLS |
| **inventory_movements** | MÉDIO | Movimentação de inventário | SEM RLS |

---

## 3. Análise das Migrations 025-027

### Migration 025 - schema_parity.sql

**Status:** NÃO APLICADA em produção

**Conteúdo:**
- Converte `meta_integrations` e `webhook_events` de camelCase para snake_case
- Adiciona coluna `openbsp_event_id` em `webhook_events`
- Ajusta constraints em `integrations`

**Dados nas tabelas:**
- Comentário da migration indica tabelas vazias
- **VERIFICAÇÃO:** Conforme relatório FASE 3.5, tabelas críticas estão vazias

**Risco:** BAIXO (tabelas vazias)

### Migration 026 - external_account_id_text.sql

**Status:** NÃO APLICADA em produção

**Conteúdo:**
- Converte `external_account_id` de UUID para TEXT em `integrations`
- Justificativa: IDs externos da Meta (waba_id, IG account id) são numéricos, não UUIDs

**Risco:** BAIXO (necessidade de backup antes de alterar tipo)

### Migration 027 - integration_events_cols.sql

**Status:** NÃO APLICADA em produção

**Conteúdo:**
- Adiciona colunas em `integration_events`: `user_id`, `workspace_id`, `payload`, `created_at`
- Comentário: "tabela NÃO tem modelo Prisma direto - usada via adapter DatabaseAdapter"

**Risco:** BAIXO a MÉDIO (dependente de dados existentes)

---

## 4. Status Verificado - Produção

### Migration 029 - CONFIRMADA APLICADA

Conforme auditoria pós-FASE 3.5 (2026-11-12):

```sql
-- Estado anterior (06/11/2026):
rls_enabled: false
policies: []

-- Estado após correção (12/11/2026):
rls_enabled: true  ✅
policies: 2  ✅
  - integration_events_tenant (multi-tenant isolation)
  - integration_events_service_role (admin bypass)
```

**Verificação:** Migration 029 foi aplicada com sucesso em produção (documentado em `memory/fasa-3-5-migration-029-complete.md`).

### Estado RLS Conhecido (FASE 3.5)

| Métrica | Valor |
|---------|-------|
| Tabelas com RLS | 40/64 (62.5%) |
| Tabelas sem RLS | 24/64 (37.5%) |
| Tabelas críticas sem RLS | 13 |

**Tabelas sem RLS identificadas:**

- products, product_variations
- organizations, organization_members, roles, permissions
- subscriptions, usage, billing_events

**Nota sobre tabelas de inventário:**

- `warehouses`, `stock_balances`, `inventory_movements` - **NÃO EXISTEM** em produção
- Verificado: nenhuma migration cria essas tabelas
- Modelo Prisma menciona, mas não foram criadas no banco
- **Ações:** Não aplicável - tabelas inexistentes

### Dados nas Tabelas Críticas

Conforme relatório FASE 3.5:
> **RISCO:** BAIXO - Tabelas críticas estão vazias (0 rows)

**Status:** Tabelas críticas (organizations, organization_members, subscriptions, billing_events, usage) estão vazias em produção.

**⚠️ IMPORTANTE:** Esta informação deve ser verificada antes de aplicar RLS para garantir que ainda estão vazias. Se houver dados reais, fazer backup antes.

---

## 4. Necessidade de RLS em Cada Tabela

### Tabelas CRÍTICAS (Devem ter RLS)

| Tabela | Deve ter RLS? | Por quê? |
|--------|--------------|----------|
| organizations | **SIM** | Tenant raiz - qualquer usuário pode acessar dados de outro tenant |
| organization_members | **SIM** | Relaciona usuários a tenants - exposição de membros |
| subscriptions | **SIM** | Dados de billing - informações financeiras sensíveis |
| billing_events | **SIM** | Eventos de faturamento - dados sensíveis |
| usage | **SIM** | Métricas por tenant - exposição de uso de outros tenants |
| users | Parcial | Auth já tem RLS, mas `auth.users` pode precisar de políticas customizadas |

### Tabelas MÉDIOS

| Tabela | Deve ter RLS? | Por quê? |
|--------|--------------|----------|
| products | **SIM** | Produtos por tenant - dados comerciais |
| product_variations | **SIM** | Variações de produtos |
| warehouses | **SIM** | Inventário físico por tenant |
| stock_balances | **SIM** | Saldo de estoque por tenant |
| roles | **SIM** | Roles são específicos de tenant |
| inventory_movements | **SIM** | Movimentação de inventário |

### Tabelas BAIXO

| Tabela | Deve ter RLS? | Por quê? |
|--------|--------------|----------|
| permissions | **SIM** (opcional) | Permissões globais podem ser visíveis, mas é mais seguro isolar |

---

## 5. Plano de Ação com Prioridades

### Prioridade 1 - CRÍTICO (Imediato)

**Aplicar RLS nas tabelas de tenant root:**

```sql
-- 1. Organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;

CREATE POLICY organizations_tenant ON organizations
FOR ALL
USING (id = NULLIF(current_setting('app.current_org', true), '')::uuid)
WITH CHECK (id = NULLIF(current_setting('app.current_org', true), '')::uuid);

-- 2. Organization Members
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members FORCE ROW LEVEL SECURITY;

CREATE POLICY organization_members_tenant ON organization_members
FOR ALL
USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid)
WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid);

-- 3. Subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;

CREATE POLICY subscriptions_tenant ON subscriptions
FOR ALL
USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid)
WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid);

-- 4. Billing Events
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events FORCE ROW LEVEL SECURITY;

CREATE POLICY billing_events_tenant ON billing_events
FOR ALL
USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid)
WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid);

-- 5. Usage
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage FORCE ROW LEVEL SECURITY;

CREATE POLICY usage_tenant ON usage
FOR ALL
USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid)
WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid);
```

### Prioridade 2 - MÉDIO (Próxima semana)

**Aplicar RLS em tabelas de negócio:**

```sql
-- Products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;

CREATE POLICY products_tenant ON products
FOR ALL
USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid);

-- Roles
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles FORCE ROW LEVEL SECURITY;

CREATE POLICY roles_tenant ON roles
FOR ALL
USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid);

-- Aplicar similar para: warehouses, stock_balances, inventory_movements, product_variations
```

### Prioridade 3 - Baixa (Planejamento)

**Permissões - análise separada:**

A tabela `permissions` contém permissões globais do sistema. Considerar:
- Se permissões são por tenant → RLS necessário
- Se são globais → RLS opcional, mas recomendado para consistência

---

## 6. Scripts SQL para Habilitar RLS

### Script Completo (Idempotente)

```sql
-- ============================================================
-- HABILITAR RLS EM TABELAS CRÍTICAS - REVOLUTION X
-- Script idempotente - pode ser executado múltiplas vezes
-- ============================================================

-- Conexão: garantir que app.current_org está definido pelo middleware
-- Ou usar service_role para operações admin

DO $$
DECLARE
    rls_enabled BOOLEAN;
BEGIN
    -- ========================================
    -- 1. Organizations (CRÍTICO)
    -- ========================================
    SELECT INTO rls_enabled rowsecurity 
    FROM pg_tables WHERE tablename = 'organizations';
    
    IF NOT rls_enabled THEN
        ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
        ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
    END IF;
    
    DROP POLICY IF EXISTS organizations_tenant ON organizations;
    CREATE POLICY organizations_tenant ON organizations
        FOR ALL
        USING (id = NULLIF(current_setting('app.current_org', true), '')::uuid)
        WITH CHECK (id = NULLIF(current_setting('app.current_org', true), '')::uuid);
    
    -- ========================================
    -- 2. Organization Members (CRÍTICO)
    -- ========================================
    SELECT INTO rls_enabled rowsecurity 
    FROM pg_tables WHERE tablename = 'organization_members';
    
    IF NOT rls_enabled THEN
        ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
        ALTER TABLE organization_members FORCE ROW LEVEL SECURITY;
    END IF;
    
    DROP POLICY IF EXISTS organization_members_tenant ON organization_members;
    CREATE POLICY organization_members_tenant ON organization_members
        FOR ALL
        USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid)
        WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid);
    
    -- ========================================
    -- 3. Subscriptions (CRÍTICO)
    -- ========================================
    SELECT INTO rls_enabled rowsecurity 
    FROM pg_tables WHERE tablename = 'subscriptions';
    
    IF NOT rls_enabled THEN
        ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
        ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
    END IF;
    
    DROP POLICY IF EXISTS subscriptions_tenant ON subscriptions;
    CREATE POLICY subscriptions_tenant ON subscriptions
        FOR ALL
        USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid)
        WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid);
    
    -- ========================================
    -- 4. Billing Events (CRÍTICO)
    -- ========================================
    SELECT INTO rls_enabled rowsecurity 
    FROM pg_tables WHERE tablename = 'billing_events';
    
    IF NOT rls_enabled THEN
        ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
        ALTER TABLE billing_events FORCE ROW LEVEL SECURITY;
    END IF;
    
    DROP POLICY IF EXISTS billing_events_tenant ON billing_events;
    CREATE POLICY billing_events_tenant ON billing_events
        FOR ALL
        USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid)
        WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid);
    
    -- ========================================
    -- 5. Usage (CRÍTICO)
    -- ========================================
    SELECT INTO rls_enabled rowsecurity 
    FROM pg_tables WHERE tablename = 'usage';
    
    IF NOT rls_enabled THEN
        ALTER TABLE usage ENABLE ROW LEVEL SECURITY;
        ALTER TABLE usage FORCE ROW LEVEL SECURITY;
    END IF;
    
    DROP POLICY IF EXISTS usage_tenant ON usage;
    CREATE POLICY usage_tenant ON usage
        FOR ALL
        USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid)
        WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid);
    
    -- ========================================
    -- 6. Products (MÉDIO)
    -- ========================================
    SELECT INTO rls_enabled rowsecurity 
    FROM pg_tables WHERE tablename = 'products';
    
    IF NOT rls_enabled THEN
        ALTER TABLE products ENABLE ROW LEVEL SECURITY;
        ALTER TABLE products FORCE ROW LEVEL SECURITY;
    END IF;
    
    DROP POLICY IF EXISTS products_tenant ON products;
    CREATE POLICY products_tenant ON products
        FOR ALL
        USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid);
    
    -- ========================================
    -- 7. Roles (MÉDIO)
    -- ========================================
    SELECT INTO rls_enabled rowsecurity 
    FROM pg_tables WHERE tablename = 'roles';
    
    IF NOT rls_enabled THEN
        ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
        ALTER TABLE roles FORCE ROW LEVEL SECURITY;
    END IF;
    
    DROP POLICY IF EXISTS roles_tenant ON roles;
    CREATE POLICY roles_tenant ON roles
        FOR ALL
        USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid);
    
    -- ========================================
    -- 8. Permissions (BAIXO - opicional)
    -- ========================================
    SELECT INTO rls_enabled rowsecurity 
    FROM pg_tables WHERE tablename = 'permissions';
    
    IF NOT rls_enabled THEN
        ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
        ALTER TABLE permissions FORCE ROW LEVEL SECURITY;
    END IF;
    
    -- Permissões globais - policy que permite leitura mas protege escrita
    DROP POLICY IF EXISTS permissions_tenant ON permissions;
    CREATE POLICY permissions_tenant ON permissions
        FOR SELECT
        USING (true)  -- Leitura pública de permissões
        FOR INSERT, UPDATE, DELETE
        USING (false); -- Escrita bloqueada via app
    
    -- Grant para service_role
    GRANT SELECT, INSERT, UPDATE, DELETE ON organizations, organization_members, 
        subscriptions, billing_events, usage, products, roles, permissions 
        TO authenticated, service_role;
END $$;
```

---

## 7. Cronograma de Implementação

### Etapa 1 - Preparação (Dia 1)
- [ ] Verificar se tabelas estão vazias em produção
- [ ] Criar backup completo do banco
- [ ] Testar script em ambiente de staging (se disponível)
- [ ] Agendar janela de manutenção

### Etapa 2 - Aplicação RLS Crítico (Dia 2)
- [ ] Executar script RLS para tabelas CRÍTICAS
- [ ] Verificar políticas criadas
- [ ] Testar isolamento multi-tenant
- [ ] Monitorar logs por 24h

### Etapa 3 - Aplicação RLS Médio (Dia 3)
- [ ] Executar script RLS para tabelas MÉDIO
- [ ] Verificar queries de produtos/inventário
- [ ] Testar cenários de uso

### Etapa 4 - Pós-implementação
- [ ] Executar testes de penetração
- [ ] Verificar performance (índices podem ser necessários)
- [ ] Documentar políticas no README

---

## 8. Rollback Plan

Se algum problema ocorrer:

```sql
-- Desabilitar RLS em uma tabela
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;

-- Excluir política específica
DROP POLICY IF EXISTS organizations_tenant ON organizations;

-- Desabilitar RLS completamente
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
```

---

## 9. Verificação de Dados

**IMPORTANTE:** Verificar antes de aplicar RLS:

```sql
-- Contar dados em tabelas críticas
SELECT 'organizations' as t, COUNT(*) as c FROM organizations
UNION ALL
SELECT 'organization_members', COUNT(*) FROM organization_members
UNION ALL
SELECT 'subscriptions', COUNT(*) FROM subscriptions
UNION ALL
SELECT 'billing_events', COUNT(*) FROM billing_events
UNION ALL
SELECT 'products', COUNT(*) FROM products;
```

Se houver dados reais, **FAÇA BACKUP** antes de aplicar RLS.

---

## 10. Considerações Técnicas

### Policy Pattern Recomendado

Todas as políticas seguem o padrão:

```sql
USING (column = NULLIF(current_setting('app.current_org', true), '')::uuid)
```

**Por quê?**
- `current_setting('app.current_org', true)` retorna string vazia se não setada
- `NULLIF(..., '')` converte string vazia para NULL
- Cast para uuid falha silenciosamente se NULL, resultando em política que não match (fail-closed)

### FORCE ROW LEVEL SECURITY

Importante usar `FORCE` para que mesmo o proprietário da tabela (supabase) seja sujeito às políticas.

### Index Recommendations

Após aplicar RLS, considerar índices:
```sql
CREATE INDEX IF NOT EXISTS idx_organizations_id ON organizations(id);
CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org_id ON subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_org_id ON billing_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_org_id ON usage(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_org_id ON products(organization_id);
```

---

## 11. Próximos Passos Recomendados

1. **Executar verificação de dados** - Confirmar se tabelas estão vazias
2. **Criar backup** - `pg_dump` ou via Supabase console
3. **Aplicar migration 029** - Se ainda não foi aplicada (integration_events)
4. **Aplicar migrations 025-027** - Se forem relevantes
5. **Implementar RLS crítico** - Seguir script acima
6. **Testes de integração** - Verificar que a aplicação continua funcionando
7. **Monitoramento** - Verificar logs de erros por 24h

---

## 12. Referências

- [FASE 3.5 Final Report](../FASE_3_5_FINAL_REPORT_2026-11-12.md) - Auditoria anterior
- [Supabase Audit Report](../SUPABASE_AUDIT_REPORT_2026-11-12.md) - Status RLS
- [migration 029](../supabase/migrations/029_integration_events_rls_fix.sql) - Exemplo de correção RLS
- [migration 028](../supabase/migrations/028_integration_events_rls.sql) - Políticas existentes

---

*Relatório gerado via auditoria Deep RLS - 2026-11-12*