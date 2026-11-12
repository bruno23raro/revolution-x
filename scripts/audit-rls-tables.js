#!/usr/bin/env node
/**
 * Script de auditoria de tabelas sem RLS
 * Verifica qual tabelas estão sem Row Level Security e avalia risco multi-tenant
 */

const pg = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

// Conexão com produção via DATABASE_URL ou local via SUPABASE_DB_PASSWORD
// Produção: usar variável de ambiente DATABASE_URL do .env.local ou .env.local.prisma
// Local: usar SUPABASE_DB_PASSWORD do .env.local (port 54321 do stack docker)
// USAGE: node scripts/audit-rls-tables.js
//   - Para produção: configure DATABASE_URL no .env.local (supabase production pooler)
//   - Para local: configure SUPABASE_DB_PASSWORD no .env.local

// Carregar .env.local automaticamente
require('dotenv').config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL ||
    (process.env.SUPABASE_DB_PASSWORD ?
     `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD}@localhost:54321/postgres` : null);

if (!DATABASE_URL) {
    console.error('❌ ERRO: DATABASE_URL ou SUPABASE_DB_PASSWORD é necessário');
    console.error('   Configure em .env.local:');
    console.error('   - DATABASE_URL para produção (pooler), ou');
    console.error('   - SUPABASE_DB_PASSWORD para stack local');
    process.exit(1);
}

// Indicar qual conexão será usada (não mostrar credenciais)
if (DATABASE_URL.includes('localhost')) {
    console.log('🔍 Conectando ao DATABASE LOCAL (stack Docker)...');
} else {
    console.log('🔍 Conectando ao DATABASE DE PRODUÇÃO (Supabase pooler)...');
}

const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: {
        rejectUnauthorized: true,
        // For dev environments with self-signed certs, you may need to add:
        // ca: fs.readFileSync('path/to/supabase-ca.crt', 'utf8')
    }
});

// Tabelas críticas para multi-tenant (deve ter RLS)
const CRITICAL_MULTITENANT = [
    'organizations',
    'organization_members',
    'subscriptions',
    'billing_events',
    'usage',
    'roles',
    'permissions',
    'products',
    'product_variations',
    'warehouses',
    'stock_balances',
    'inventory_movements',
    'users'
];

const sqlAudit = `
SELECT
    t.tablename,
    t.rowsecurity as rls_enabled,
    COUNT(p.polname) as policy_count,
    STRING_AGG(p.polname, ', ') as policies
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename
WHERE t.schemaname = 'public'
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;
`;

const sqlRowCount = `
SELECT
    schemaname,
    tablename,
    n_tup_ins + n_tup_upd + n_tup_del as writes,
    n_tup_hot_upd as hot_updates,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY tablename;
`;

const sqlTableColumns = `
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('organizations', 'organization_members', 'products', 'subscriptions', 'billing_events', 'users', 'integration_events')
ORDER BY table_name, ordinal_position;
`;

(async () => {
    let client;
    try {
        client = await pool.connect();

        console.log('═══════════════════════════════════════════════════════════════════');
        console.log('  AUDITORIA DE TABELAS SEM RLS - Revolution X');
        console.log('═══════════════════════════════════════════════════════════════════\n');

        // 1. Verificar estado RLS de todas as tabelas
        console.log('## ESTADO RLS DE TODAS AS TABELAS\n');
        const tablesResult = await client.query(sqlAudit);

        const tablesWithoutRLS = [];
        const tablesWithRLS = [];

        tablesResult.rows.forEach(row => {
            const tableInfo = {
                name: row.tablename,
                rls: row.rls_enabled,
                policies: row.policy_count,
                policyNames: row.policies
            };

            if (!row.rls_enabled) {
                tablesWithoutRLS.push(tableInfo);
            } else {
                tablesWithRLS.push(tableInfo);
            }
        });

        console.log('Tabelas COM RLS ativo: ' + tablesWithRLS.length);
        console.log('Tabelas SEM RLS: ' + tablesWithoutRLS.length);
        console.log('');

        // 2. Listar tabelas sem RLS com risco
        console.log('## TABELAS CRÍTICAS SEM RLS (Multi-tenant)\n');

        const criticalWithoutRLS = tablesWithoutRLS.filter(t =>
            CRITICAL_MULTITENANT.includes(t.name)
        );

        criticalWithoutRLS.forEach(t => {
            const riskLevel = ['organizations', 'organization_members', 'subscriptions', 'billing_events', 'usage', 'users'].includes(t.name)
                ? 'CRÍTICO'
                : 'MÉDIO';
            console.log(`❌ ${t.name.padEnd(30)} | Risco: ${riskLevel}`);
        });
        console.log('');

        // 3. Verificar dados nas tabelas críticas
        console.log('## ANÁLISE DE DADOS NAS TABELAS CRÍTICAS\n');
        const countResult = await client.query(`
            SELECT
                'organizations' as table_name,
                COUNT(*) as row_count
            FROM organizations
            UNION ALL
            SELECT
                'organization_members' as table_name,
                COUNT(*) as row_count
            FROM organization_members
            UNION ALL
            SELECT
                'subscriptions' as table_name,
                COUNT(*) as row_count
            FROM subscriptions
            UNION ALL
            SELECT
                'billing_events' as table_name,
                COUNT(*) as row_count
            FROM billing_events
            UNION ALL
            SELECT
                'products' as table_name,
                COUNT(*) as row_count
            FROM products
            UNION ALL
            SELECT
                'integration_events' as table_name,
                COUNT(*) as row_count
            FROM integration_events
            UNION ALL
            SELECT
                'meta_integrations' as table_name,
                COUNT(*) as row_count
            FROM meta_integrations
            UNION ALL
            SELECT
                'users' as table_name,
                COUNT(*) as row_count
            FROM auth.users
        `);

        console.log('Tabela                    | Linhas  | Risco');
        console.log('-'.repeat(50));
        countResult.rows.forEach(r => {
            const risk = r.row_count > 0 ? 'ALTO (dados expostos)' : 'BAIXO (tabela vazia)';
            console.log(`${r.table_name.padEnd(25)} | ${String(r.row_count).padEnd(7)} | ${risk}`);
        });
        console.log('');

        // 4. Verificar colunas de organização nas tabelas sem RLS
        console.log('## COLUNAS DE TENANT (organizationId) NAS TABELAS SEM RLS\n');

        const tablesToCheck = ['organizations', 'organization_members', 'subscriptions', 'billing_events', 'products', 'warehouses', 'stock_balances', 'inventory_movements'];

        for (const tableName of tablesToCheck) {
            try {
                const colResult = await client.query(`
                    SELECT column_name, data_type
                    FROM information_schema.columns
                    WHERE table_name = $1 AND (column_name ILIKE '%organization%' OR column_name ILIKE '%tenant%')
                `, [tableName]);

                if (colResult.rows.length > 0) {
                    console.log(`✅ ${tableName}: possui colunas de tenant:`);
                    colResult.rows.forEach(c => console.log(`    - ${c.column_name} (${c.data_type})`));
                } else {
                    console.log(`⚠️  ${tableName}: SEM colunas de tenant`);
                }
            } catch (e) {
                console.log(`? ${tableName}: tabela não existe`);
            }
        }
        console.log('');

        // 5. Verificar migrations aplicadas
        console.log('## STATUS DE MIGRATIONS RECENTES\n');
        const migrationsResult = await client.query(`
            SELECT version, name
            FROM supabase_migrations.schema_migrations
            WHERE version IN ('025', '026', '027', '028', '029')
            ORDER BY version
        `);

        const appliedMigrations = migrationsResult.rows.map(r => r.version);
        ['025', '026', '027', '028', '029'].forEach(m => {
            const status = appliedMigrations.includes(m) ? '✅ APLICADA' : '❌ NÃO APLICADA';
            console.log(`Migration ${m}: ${status}`);
        });
        console.log('');

        // 6. Resumo de risco
        console.log('═══════════════════════════════════════════════════════════════════');
        console.log('  RESUMO DE RISCOS');
        console.log('═══════════════════════════════════════════════════════════════════\n');

        const orgsCount = countResult.rows.find(r => r.table_name === 'organizations')?.row_count || 0;
        const usersCount = countResult.rows.find(r => r.table_name === 'users')?.row_count || 0;

        console.log(`Tabelas críticas sem RLS: ${criticalWithoutRLS.length}`);
        console.log(`Organizations cadastradas: ${orgsCount}`);
        console.log(`Usuários cadastrados: ${usersCount}`);
        console.log(`Migrations pendentes: ${['025', '026', '027'].filter(m => !appliedMigrations.includes(m)).length}`);
        console.log('');

        if (orgsCount > 0 || usersCount > 0) {
            console.log('⚠️  ALERTA: Dados reais em produção podem ser expostos!');
            console.log('   Recomendação: aplicar RLS imediatamente após backup');
        } else {
            console.log('ℹ️  Tabelas críticas estão vazias - risco de dados baixo, mas ainda crítico');
            console.log('   Recomendação: aplicar RLS antes de qualquer ingresso de dados');
        }

    } catch (error) {
        console.error('Erro na auditoria:', error.message);
        process.exit(1);
    } finally {
        if (client) client.release();
        await pool.end();
    }
})();