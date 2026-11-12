#!/usr/bin/env node
/**
 * Auditoria RLS - Script Simplificado
 * Projeto: ardpabjoepzhkpmkgwgu (Revolution X)
 *
 * USAGE: node scripts/audit-rls-simple.js
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Conexão produção - usando pooler Supabase
// REQUERIDO: SUPABASE_DB_PASSWORD no .env.local
const POSTGRES_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
if (!POSTGRES_PASSWORD) {
    console.error('❌ ERRO: SUPABASE_DB_PASSWORD é obrigatório. Defina em .env.local');
    process.exit(1);
}

const pool = new Pool({
    host: 'aws-0-sa-east-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.ardpabjoepzhkpmkgwgu',
    password: POSTGRES_PASSWORD,
    ssl: { rejectUnauthorized: true },
    max: 5,
    connectionTimeoutMillis: 10000
});

// Tabelas críticas para multi-tenant
const CRITICAL_TABLES = [
    'organizations', 'organization_members', 'subscriptions', 'billing_events',
    'usage', 'roles', 'permissions', 'products', 'product_variations',
    'warehouses', 'stock_balances', 'inventory_movements', 'users'
];

async function audit() {
    let client;
    try {
        console.log('Conectando ao Supabase produção...');
        client = await pool.connect();
        console.log('Conexão estabelecida!\n');

        // 1. Estado RLS de todas as tabelas
        const rlsResult = await client.query(`
            SELECT t.tablename, t.rowsecurity as rls_enabled, COUNT(p.polname) as policy_count
            FROM pg_tables t
            LEFT JOIN pg_policies p ON t.tablename = p.tablename
            WHERE t.schemaname = 'public'
            GROUP BY t.tablename, t.rowsecurity
            ORDER BY t.tablename
        `);

        const withoutRLS = rlsResult.rows.filter(r => !r.rls_enabled);
        const withRLS = rlsResult.rows.filter(r => r.rls_enabled);

        console.log('═'.repeat(60));
        console.log('  ESTADO RLS DE TODAS AS TABELAS');
        console.log('═'.repeat(60));
        console.log(`\nTabelas com RLS: ${withRLS.length}`);
        console.log(`Tabelas sem RLS: ${withoutRLS.length}\n`);

        // 2. Tabelas críticas sem RLS
        const criticalWithout = withoutRLS.filter(t => CRITICAL_TABLES.includes(t.tablename));

        console.log('═'.repeat(60));
        console.log('  TABELAS CRÍTICAS SEM RLS (Multi-tenant)');
        console.log('═'.repeat(60));

        if (criticalWithout.length === 0) {
            console.log('\n✅ Nenhuma tabela crítica sem RLS!\n');
        } else {
            console.log('\n🚨 TABELAS CRÍTICAS SEM RLS:\n');
            criticalWithout.forEach(t => {
                const risk = ['organizations', 'organization_members', 'subscriptions', 'billing_events', 'usage'].includes(t.tablename) ? 'CRÍTICO' : 'MÉDIO';
                console.log(`  ❌ ${t.tablename} (Risco: ${risk})`);
            });
            console.log('');
        }

        // 3. Contar dados
        console.log('═'.repeat(60));
        console.log('  ANÁLISE DE DADOS NAS TABELAS CRÍTICAS');
        console.log('═'.repeat(60));

        const dataResult = await client.query(`
            SELECT 'organizations' as table_name, COUNT(*) as row_count FROM organizations
            UNION ALL
            SELECT 'organization_members', COUNT(*) FROM organization_members
            UNION ALL
            SELECT 'subscriptions', COUNT(*) FROM subscriptions
            UNION ALL
            SELECT 'billing_events', COUNT(*) FROM billing_events
            UNION ALL
            SELECT 'usage', COUNT(*) FROM usage
            UNION ALL
            SELECT 'products', COUNT(*) FROM products
            UNION ALL
            SELECT 'integration_events', COUNT(*) FROM integration_events
            UNION ALL
            SELECT 'meta_integrations', COUNT(*) FROM meta_integrations
        `);

        console.log('\nTabela                    | Linhas  | Status');
        console.log('-'.repeat(50));
        dataResult.rows.forEach(r => {
            const status = r.row_count > 0 ? '🔴 DADOS REAIS' : '✅ VAZIA';
            console.log(`${r.table_name.padEnd(27)} | ${String(r.row_count).padEnd(7)} | ${status}`);
        });
        console.log('');

        // 4. Migrations 025-029 status
        console.log('═'.repeat(60));
        console.log('  MIGRATIONS 025-029 STATUS');
        console.log('═'.repeat(60));

        const migResult = await client.query(`
            SELECT version FROM supabase_migrations.schema_migrations
            WHERE version IN ('025','026','027','028','029')
        `);

        const applied = migResult.rows.map(r => r.version);

        console.log('');
        ['025', '026', '027', '028', '029'].forEach(v => {
            const status = applied.includes(v) ? '✅ APLICADA' : '❌ PENDENTE';
            console.log(`  Migration ${v}: ${status}`);
        });
        console.log('');

        // 5. integration_events detalhes
        console.log('═'.repeat(60));
        console.log('  INTEGRATION_EVENTS (Verificação Migration 029)');
        console.log('═'.repeat(60));

        const ieRls = await client.query(`SELECT rowsecurity FROM pg_tables WHERE tablename = 'integration_events'`);
        const iePol = await client.query(`SELECT policyname FROM pg_policies WHERE tablename = 'integration_events'`);

        console.log(`\n  RLS habilitado: ${ieRls.rows[0]?.rls_enabled ? '✅ SIM' : '❌ NÃO'}`);
        console.log(`  Políticas: ${iePol.rows.length} (${iePol.rows.map(p => p.policyname).join(', ') || 'NENHUMA'})\n`);

        // 6. Status tabelas sem RLS
        console.log('═'.repeat(60));
        console.log('  TABELAS SEM RLS (completas)');
        console.log('═'.repeat(60));

        if (withoutRLS.length === 0) {
            console.log('\n✅ Todas as tabelas têm RLS ativado!\n');
        } else {
            console.log('\n');
            withoutRLS.forEach(t => {
                console.log(`  - ${t.tablename} (${t.policy_count} policies)`);
            });
            console.log('');
        }

        // 7. Schema organization columns
        console.log('═'.repeat(60));
        console.log('  COLUNAS DE TENANT (organization_id)');
        console.log('═'.repeat(60));

        const tenantTables = ['organizations', 'organization_members', 'subscriptions', 'billing_events', 'products', 'roles'];
        for (const table of tenantTables) {
            try {
                const colResult = await client.query(`
                    SELECT column_name FROM information_schema.columns
                    WHERE table_name = $1 AND table_schema = 'public'
                    AND column_name ILIKE '%organization%'
                `, [table]);

                if (colResult.rows.length > 0) {
                    console.log(`\n  ${table}:`);
                    colResult.rows.forEach(c => console.log(`    - ${c.column_name}`));
                } else {
                    console.log(`\n  ${table}: ⚠️  Sem coluna de organização`);
                }
            } catch (e) {
                console.log(`\n  ${table}: ❌ Erro - ${e.message}`);
            }
        }

        client.release();

    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error('   Verifique conexão com produção');
        process.exit(1);
    } finally {
        await pool.end();
    }
}

audit().then(() => {
    console.log('═'.repeat(60));
    console.log('  AUDITORIA CONCLUÍDA');
    console.log('═'.repeat(60));
});