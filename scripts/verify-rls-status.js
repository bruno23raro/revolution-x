#!/usr/bin/env node
/**
 * Verificação automática de estado RLS
 * Script para validar que RLS está habilitado corretamente
 * Executado pós-aplicação de hardening
 */

const { createClient } = require('@supabase/supabase-js');

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!DATABASE_URL) {
  console.error('❌ Erro: DATABASE_URL ou SUPABASE_DB_URL não configurado');
  console.error('   Execute: export DATABASE_URL="postgresql://..."');
  process.exit(1);
}

async function verifyRLS() {
  console.log('🔍 Verificando estado RLS...\n');

  const { data: tablesWithoutRLS, error: err1 } = await query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    AND rowsecurity = false
    AND tablename NOT IN ('supabase_migrations', 'schema_migrations')
    ORDER BY tablename
  `);

  if (err1) {
    console.error('❌ Erro ao consultar pg_tables:', err1.message);
    process.exit(1);
  }

  console.log('📋 Tabelas sem RLS (necessitam de atenção):');
  if (tablesWithoutRLS.length === 0) {
    console.log('✅ Todas as tabelas têm RLS habilitado!\n');
  } else {
    tablesWithoutRLS.forEach(t => console.log(`  - ${t.tablename}`));
    console.log(`\n⚠️  ${tablesWithoutRLS.length} tabelas sem RLS\n`);
  }

  const { data: rlPolicyCount, error: err2 } = await query(`
    SELECT
      schemaname,
      tablename,
      COUNT(polname) as policy_count,
      MAX(CASE WHEN polname LIKE '%tenant%' THEN 1 ELSE 0 END) as has_tenant_policy,
      MAX(CASE WHEN polname LIKE '%service_role%' THEN 1 ELSE 0 END) as has_service_role_policy
    FROM pg_policies
    JOIN pg_tables USING (schemaname, tablename)
    WHERE schemaname = 'public'
    GROUP BY schemaname, tablename
    HAVING COUNT(polname) > 0
    ORDER BY tablename
  `);

  if (err2) {
    console.error('❌ Erro ao consultar pg_policies:', err2.message);
    process.exit(1);
  }

  console.log('🔐 Políticas RLS por tabela:');
  rlPolicyCount.forEach(p => {
    const icons = [];
    if (p.has_tenant_policy) icons.push('👤 tenant');
    if (p.has_service_role_policy) icons.push('🔧 service_role');
    console.log(`  - ${p.tablename}: ${p.policy_count} política(s) ${icons.length ? '[' + icons.join(', ') + ']' : ''}`);
  });

  // Tabelas críticas que devem ter tenant policy
  const criticalTables = [
    'integration_events', 'meta_integrations', 'webhook_events',
    'organizations', 'organization_members', 'billing_events',
    'subscriptions', 'products', 'roles', 'permissions'
  ];

  const { data: missingTenantPolicy, error: err3 } = await query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = ANY($1::text[])
    AND rowsecurity = true
    AND tablename NOT IN (
      SELECT tablename FROM pg_policies WHERE polname LIKE '%tenant%'
    )
  `, [criticalTables]);

  if (err3) {
    console.error('❌ Erro na verificação:', err3.message);
    process.exit(1);
  }

  console.log('\n📊 Resumo:');
  console.log(`  - Tabelas com RLS: ${64 - tablesWithoutRLS.length}/${64}`);
  console.log(`  - Tabelas críticas sem policy tenant: ${missingTenantPolicy.length > 0 ? missingTenantPolicy.length : 0}`);

  if (missingTenantPolicy.length > 0) {
    console.log('  ⚠️  Tabelas críticas sem policy tenant:');
    missingTenantPolicy.forEach(t => console.log(`    - ${t.tablename}`));
  }

  console.log('\n✅ Verificação concluída!');

  // Exit code
  process.exit(tablesWithoutRLS.length > 0 || missingTenantPolicy.length > 0 ? 1 : 0);
}

async function query(sql, params = []) {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    const client = await pool.connect();
    const result = await client.query(sql, params);
    client.release();
    return { data: result.rows, error: null };
  } catch (e) {
    return { data: null, error: e };
  } finally {
    await pool.end();
  }
}

verifyRLS();