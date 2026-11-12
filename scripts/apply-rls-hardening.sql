-- Script de Hardening RLS - 12/11/2026
-- Aplica RLS nas tabelas críticas sem política de isolamento multi-tenant
--
-- ⚠️ REQUER: app.current_org GUC configurado via middleware
-- ⚠️ BACKUP RECOMENDADO antes de executar
--
-- Status: Tabelas vazias = aplicação segura sem risco de dados

-- ============================================================
-- 1. Organizations - CRÍTICA
-- ============================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;

-- Política baseada em org_id (coluna que aponta para a organização raiz)
CREATE POLICY organizations_tenant ON organizations
  FOR ALL TO public
  USING (org_id = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK (org_id = NULLIF(current_setting('app.current_org', true), '')::uuid);

CREATE POLICY organizations_tenant_insert ON organizations
  FOR INSERT TO public
  WITH CHECK (org_id = NULLIF(current_setting('app.current_org', true), '')::uuid);

COMMENT ON POLICY organizations_tenant ON organizations IS 'Multi-tenant isolation: only organizations belonging to current tenant accessible';

-- ============================================================
-- 2. Organization Members - CRÍTICA
-- ============================================================
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members FORCE ROW LEVEL SECURITY;

CREATE POLICY organization_members_tenant ON organization_members
  FOR ALL TO public
  USING (organization_id IN (SELECT id FROM organizations WHERE org_id = NULLIF(current_setting('app.current_org', true), '')::uuid))
  WITH CHECK (organization_id IN (SELECT id FROM organizations WHERE org_id = NULLIF(current_setting('app.current_org', true), '')::uuid));

COMMENT ON POLICY organization_members_tenant ON organization_members IS 'Multi-tenant isolation via organization_id';

-- ============================================================
-- 3. Billing Events - CRÍTICA
-- ============================================================
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events FORCE ROW LEVEL SECURITY;

CREATE POLICY billing_events_tenant ON billing_events
  FOR ALL TO public
  USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid);

COMMENT ON POLICY billing_events_tenant ON billing_events IS 'Multi-tenant isolation: only billing events belonging to current tenant';

-- ============================================================
-- 4. Subscriptions - CRÍTICA
-- ============================================================
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;

CREATE POLICY subscriptions_tenant ON subscriptions
  FOR ALL TO public
  USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid);

COMMENT ON POLICY subscriptions_tenant ON subscriptions IS 'Multi-tenant isolation: only subscriptions belonging to current tenant';

-- ============================================================
-- 5. Products - MÉDIA
-- ============================================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;

CREATE POLICY products_tenant ON products
  FOR ALL TO public
  USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid);

COMMENT ON POLICY products_tenant ON products IS 'Multi-tenant isolation: only products belonging to current tenant';

-- ============================================================
-- 6. Roles - MÉDIA
-- ============================================================
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles FORCE ROW LEVEL SECURITY;

CREATE POLICY roles_tenant ON roles
  FOR ALL TO public
  USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid);

COMMENT ON POLICY roles_tenant ON roles IS 'Multi-tenant isolation: only roles belonging to current tenant';

-- ============================================================
-- 7. Permissions - MÉDIA
-- ============================================================
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions FORCE ROW LEVEL SECURITY;

CREATE POLICY permissions_tenant ON permissions
  FOR ALL TO public
  USING (role_id IN (SELECT id FROM roles WHERE organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid))
  WITH CHECK (role_id IN (SELECT id FROM roles WHERE organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid));

COMMENT ON POLICY permissions_tenant ON permissions IS 'Multi-tenant isolation via role_id';

-- ============================================================
-- 8. Inventory Movements - MÉDIA
-- ============================================================
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements FORCE ROW LEVEL SECURITY;

CREATE POLICY inventory_movements_tenant ON inventory_movements
  FOR ALL TO public
  USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid);

COMMENT ON POLICY inventory_movements_tenant ON inventory_movements IS 'Multi-tenant isolation: only inventory movements belonging to current tenant';

-- ============================================================
-- 9. Plans - BAIXA
-- ============================================================
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans FORCE ROW LEVEL SECURITY;

CREATE POLICY plans_tenant ON plans
  FOR ALL TO public
  USING (true)  -- Plans são globais, visíveis a todos
  WITH CHECK (true);

COMMENT ON POLICY plans_tenant ON plans IS 'Plans são globais - RLS apenas para consistência';

-- ============================================================
-- 10. Stock Balances - BAIXA
-- ============================================================
ALTER TABLE stock_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_balances FORCE ROW LEVEL SECURITY;

CREATE POLICY stock_balances_tenant ON stock_balances
  FOR ALL TO public
  USING (warehouse_id IN (SELECT id FROM warehouses WHERE organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid))
  WITH CHECK (warehouse_id IN (SELECT id FROM warehouses WHERE organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid));

COMMENT ON POLICY stock_balances_tenant ON stock_balances IS 'Multi-tenant isolation via warehouse_id';

-- ============================================================
-- 11. Warehouses - BAIXA
-- ============================================================
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses FORCE ROW LEVEL SECURITY;

CREATE POLICY warehouses_tenant ON warehouses
  FOR ALL TO public
  USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid);

COMMENT ON POLICY warehouses_tenant ON warehouses IS 'Multi-tenant isolation: only warehouses belonging to current tenant';

-- ============================================================
-- 12. Usage - BAIXA
-- ============================================================
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage FORCE ROW LEVEL SECURITY;

CREATE POLICY usage_tenant ON usage
  FOR ALL TO public
  USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid);

COMMENT ON POLICY usage_tenant ON usage IS 'Multi-tenant isolation: only usage records belonging to current tenant';

-- ============================================================
-- ÍNDICES PARA PERFORMANCE RLS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_organizations_org_id ON organizations(org_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_organization_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_organization_id ON billing_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_organization_id ON subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_organization_id ON products(organization_id);
CREATE INDEX IF NOT EXISTS idx_roles_organization_id ON roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_organization_id ON inventory_movements(organization_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_organization_id ON warehouses(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_organization_id ON usage(organization_id);

-- ============================================================
-- VERIFICAÇÃO
-- ============================================================
SELECT tablename, rowsecurity,
       (SELECT count(*) FROM pg_policies WHERE tablename = pg_tables.tablename) as policy_count
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('organizations', 'organization_members', 'billing_events', 'subscriptions',
                  'products', 'roles', 'permissions', 'inventory_movements', 'plans',
                  'stock_balances', 'warehouses', 'usage')
ORDER BY tablename;