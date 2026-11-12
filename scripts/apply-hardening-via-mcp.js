#!/usr/bin/env node
/**
 * Script para aplicar RLS via Supabase MCP
 * Executa políticas uma por vez (supabase MCP não suporta múltiplos comandos)
 */

const pg = require('pg');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: true }
});

async function executeQuery(query, description) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(query);
    await client.query('COMMIT');
    console.log(`✅ ${description}`);
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ ${description}: ${error.message}`);
    return false;
  } finally {
    client.release();
  }
}

async function main() {
  console.log('Iniciando Hardening RLS via MCP...\n');

  const operations = [
    // organization_members
    { sql: "ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY", desc: "org_members: ENABLE RLS" },
    { sql: "ALTER TABLE organization_members FORCE ROW LEVEL SECURITY", desc: "org_members: FORCE RLS" },
    { sql: "CREATE POLICY organization_members_tenant ON organization_members FOR ALL TO public USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid) WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid)", desc: "org_members: Policy tenant" },

    // subscriptions
    { sql: "ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY", desc: "subscriptions: ENABLE RLS" },
    { sql: "ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY", desc: "subscriptions: FORCE RLS" },
    { sql: "CREATE POLICY subscriptions_tenant ON subscriptions FOR ALL TO public USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid) WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid)", desc: "subscriptions: Policy tenant" },

    // billing_events
    { sql: "ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY", desc: "billing_events: ENABLE RLS" },
    { sql: "ALTER TABLE billing_events FORCE ROW LEVEL SECURITY", desc: "billing_events: FORCE RLS" },
    { sql: "CREATE POLICY billing_events_tenant ON billing_events FOR ALL TO public USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid) WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid)", desc: "billing_events: Policy tenant" },

    // products
    { sql: "ALTER TABLE products ENABLE ROW LEVEL SECURITY", desc: "products: ENABLE RLS" },
    { sql: "ALTER TABLE products FORCE ROW LEVEL SECURITY", desc: "products: FORCE RLS" },
    { sql: "CREATE POLICY products_tenant ON products FOR ALL TO public USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid) WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid)", desc: "products: Policy tenant" },

    // roles
    { sql: "ALTER TABLE roles ENABLE ROW LEVEL SECURITY", desc: "roles: ENABLE RLS" },
    { sql: "ALTER TABLE roles FORCE ROW LEVEL SECURITY", desc: "roles: FORCE RLS" },
    { sql: "CREATE POLICY roles_tenant ON roles FOR ALL TO public USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid) WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid)", desc: "roles: Policy tenant" },

    // permissions
    { sql: "ALTER TABLE permissions ENABLE ROW LEVEL SECURITY", desc: "permissions: ENABLE RLS" },
    { sql: "ALTER TABLE permissions FORCE ROW LEVEL SECURITY", desc: "permissions: FORCE RLS" },
    { sql: "CREATE POLICY permissions_tenant ON permissions FOR ALL TO public USING (role_id IN (SELECT id FROM roles WHERE organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid)) WITH CHECK (role_id IN (SELECT id FROM roles WHERE organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid))", desc: "permissions: Policy tenant" },

    // inventory_movements
    { sql: "ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY", desc: "inventory_movements: ENABLE RLS" },
    { sql: "ALTER TABLE inventory_movements FORCE ROW LEVEL SECURITY", desc: "inventory_movements: FORCE RLS" },
    { sql: "CREATE POLICY inventory_movements_tenant ON inventory_movements FOR ALL TO public USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid) WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid)", desc: "inventory_movements: Policy tenant" },

    // plans (globais)
    { sql: "ALTER TABLE plans ENABLE ROW LEVEL SECURITY", desc: "plans: ENABLE RLS" },
    { sql: "ALTER TABLE plans FORCE ROW LEVEL SECURITY", desc: "plans: FORCE RLS" },
    { sql: "CREATE POLICY plans_tenant ON plans FOR ALL TO public USING (true) WITH CHECK (true)", desc: "plans: Policy global" },

    // stock_balances
    { sql: "ALTER TABLE stock_balances ENABLE ROW LEVEL SECURITY", desc: "stock_balances: ENABLE RLS" },
    { sql: "ALTER TABLE stock_balances FORCE ROW LEVEL SECURITY", desc: "stock_balances: FORCE RLS" },
    { sql: "CREATE POLICY stock_balances_tenant ON stock_balances FOR ALL TO public USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid) WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid)", desc: "stock_balances: Policy tenant" },

    // warehouses
    { sql: "ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY", desc: "warehouses: ENABLE RLS" },
    { sql: "ALTER TABLE warehouses FORCE ROW LEVEL SECURITY", desc: "warehouses: FORCE RLS" },
    { sql: "CREATE POLICY warehouses_tenant ON warehouses FOR ALL TO public USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid) WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid)", desc: "warehouses: Policy tenant" },

    // usage
    { sql: "ALTER TABLE usage ENABLE ROW LEVEL SECURITY", desc: "usage: ENABLE RLS" },
    { sql: "ALTER TABLE usage FORCE ROW LEVEL SECURITY", desc: "usage: FORCE RLS" },
    { sql: "CREATE POLICY usage_tenant ON usage FOR ALL TO public USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid) WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid)", desc: "usage: Policy tenant" },

    // product_variations
    { sql: "ALTER TABLE product_variations ENABLE ROW LEVEL SECURITY", desc: "product_variations: ENABLE RLS" },
    { sql: "ALTER TABLE product_variations FORCE ROW LEVEL SECURITY", desc: "product_variations: FORCE RLS" },
    { sql: "CREATE POLICY product_variations_tenant ON product_variations FOR ALL TO public USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid) WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid)", desc: "product_variations: Policy tenant" },
  ];

  let successCount = 0;
  for (const op of operations) {
    const success = await executeQuery(op.sql, op.desc);
    if (success) successCount++;
  }

  // Verificar resultado
  const result = await pool.query(`
    SELECT COUNT(*) as tables_with_rls
    FROM pg_tables
    WHERE schemaname = 'public' AND rowsecurity = true
  `);

  console.log(`\n📊 Resultado Final:`);
  console.log(`   Tables with RLS: ${result.rows[0].tables_with_rls}`);
  console.log(`   Successos: ${successCount}/${operations.length}`);

  await pool.end();
}

main().catch(console.error);