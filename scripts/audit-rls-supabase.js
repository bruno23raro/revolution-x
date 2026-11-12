#!/usr/bin/env node
/**
 * Auditoria RLS via Supabase Client
 * Projeto: ardpabjoepzhkpmkgwgu (Revolution X)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ardpabjoepzhkpmkgwgu.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY não encontrado em .env.local');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: 'public' }
});

// SQL para verificar RLS
const queryRLS = `
SELECT
    t.tablename,
    t.rowsecurity as rls_enabled,
    COUNT(p.polname) as policy_count
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename
WHERE t.schemaname = 'public'
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename
`;

// SQL para contar dados
const queryData = `
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
UNION ALL
SELECT 'auth_users', COUNT(*) FROM auth.users
`;

async function executeSQL(sql) {
    const { data, error } = await supabase.rpc('exec_sql', {
        query: sql,
        is_read_only: true
    }).catch(async () => {
        // Fallback: usar rest directly
        const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: sql })
        });
        return { data: await response.json(), error: null };
    });
    return { data, error };
}

async function main() {
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║   AUDITORIA RLS - Tabelas sem Row Level Security               ║');
    console.log('║   Projeto: ardpabjoepzhkpmkgwgu (Revolution X)                 ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝\n');

    try {
        // Usar PostgreSQL diretamente
        const { Pool } = require('pg');

        // Conexão via pooler Supabase
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
            ssl: { rejectUnauthorized: true }
        });

        console.log('🔌 Conectando ao Supabase...');
        const client = await pool.connect();
        console.log('✅ Conexão estabelecida\n');

        // 1. Verificar tabelas sem RLS
        const rlsResult = await client.query(queryRLS);
        const withoutRLS = rlsResult.rows.filter(r => !r.rls_enabled);
        const withRLS = rlsResult.rows.filter(r => r.rls_enabled);

        console.log('═'.repeat(60));
        console.log('  1. STATUS RLS DE TODAS AS TABELAS');
        console.log('═'.repeat(60));
        console.log(`\n📊 Tabelas COM RLS:  ${withRLS.length}`);
        console.log(`📊 Tabelas SEM RLS:  ${withoutRLS.length}\n`);

        // 2. Tabelas críticas sem RLS
        const CRITICAL = ['organizations', 'organization_members', 'subscriptions',
                          'billing_events', 'usage', 'roles', 'products', 'product_variations',
                          'warehouses', 'stock_balances', 'inventory_movements', 'users'];

        console.log('═'.repeat(60));
        console.log('  2. TABELAS CRÍTICAS SEM RLS');
        console.log('═'.repeat(60));

        const criticalWithout = withoutRLS.filter(t => CRITICAL.includes(t.tablename));

        if (criticalWithout.length === 0) {
            console.log('\n✅ Nenhuma tabela crítica sem RLS!\n');
        } else {
            console.log('\n🚨 TABELAS CRÍTICAS SEM RLS:\n');
            criticalWithout.forEach(t => {
                const risk = ['organizations', 'organization_members', 'subscriptions', 'billing_events', 'usage'].includes(t.tablename) ? 'CRÍTICO' : 'MÉDIO';
                console.log(`  ❌ ${t.tablename.padEnd(30)} | Risco: ${risk}`);
            });
            console.log('');
        }

        // 3. Contar dados
        console.log('═'.repeat(60));
        console.log('  3. ANÁLISE DE DADOS');
        console.log('═'.repeat(60));

        const dataResult = await client.query(queryData);
        console.log('\n  ' + 'Tabela'.padEnd(30) + ' | ' + 'Linhas');
        console.log('  ' + '-'.repeat(28) + '-+--------');
        dataResult.rows.forEach(r => {
            const status = r.row_count > 0 ? '🔴' : '✅';
            console.log(`  ${status} ${r.table_name.padEnd(28)} | ${r.row_count}`);
        });
        console.log('');

        // 4. Migrations status
        console.log('═'.repeat(60));
        console.log('  4. MIGRATIONS 025-029 STATUS');
        console.log('═'.repeat(60));

        const migResult = await client.query(`
            SELECT version FROM supabase_migrations.schema_migrations
            WHERE version IN ('025','026','027','028','029')
        `);

        const applied = migResult.rows.map(r => r.version);
        ['025', '026', '027', '028', '029'].forEach(v => {
            const status = applied.includes(v) ? '✅' : '❌';
            console.log(`  ${status} Migration ${v}`);
        });
        console.log('');

        // 5. integration_events detalhes
        console.log('═'.repeat(60));
        console.log('  5. INTEGRATION_EVENTS (Migration 029)');
        console.log('═'.repeat(60));

        const ieRls = await client.query("SELECT rowsecurity FROM pg_tables WHERE tablename = 'integration_events'");
        const iePol = await client.query("SELECT policyname FROM pg_policies WHERE tablename = 'integration_events'");

        console.log(`\n  RLS: ${ieRls.rows[0]?.rls_enabled ? '✅ ATIVO' : '❌ DESATIVADO'}`);
        console.log(`  Políticas: ${iePol.rows.length}`);
        console.log('');

        client.release();
        await pool.end();

        // Resumo
        console.log('═'.repeat(60));
        console.log('  RESUMO');
        console.log('═'.repeat(60));

        const hasCritical = criticalWithout.length > 0;
        const hasPending = !applied.includes('029');
        const hasData = dataResult.rows.some(r => r.table_name !== 'auth_users' && r.row_count > 0);

        console.log('');
        if (!hasCritical && !hasPending) {
            console.log('✅ Estado de segurança: OK');
        } else {
            if (hasCritical) {
                console.log('🚨 Tabelas críticas sem RLS:', criticalWithout.map(t => t.tablename).join(', '));
            }
            if (hasPending) {
                console.log('🚨 Migrations pendentes: 025, 026, 027, 028, ou 029');
            }
            if (hasData) {
                console.log('⚠️  Dados reais detectados - fazer backup antes de aplicar RLS');
            }
        }

    } catch (error) {
        console.error('❌ Erro:', error.message);
        console.error('\n💡 DICA: Configure POSTGRES_PASSWORD ou SUPABASE_DB_PASSWORD');
        console.error('   Valor pode ser extraído de .env.local.prisma para uso local');
        process.exit(1);
    }
}

main();