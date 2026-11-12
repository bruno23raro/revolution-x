#!/usr/bin/env node
/**
 * Script de auditoria de tabelas sem RLS - Produção Revolution X
 * Projeta: ardpabjoepzhkpmkgwgu
 *
 * USAGE: node scripts/audit-rls-production.js
 *
 * NOTA: Este script usa credenciais do .env.local.prisma.
 * Certifique-se de que o arquivo não foi redatado com valores.
 */

const pg = require('pg');
const path = require('path');

// Carregar .env.local.prisma (não .env.local para usar produção)
require('dotenv').config({ path: path.join(__dirname, '../.env.local.prisma') });

// Pool de conexão - SSL sempre habilitado com validação
// Para Supabase production, o certificado é válido (CA pública)
const sslOptions = { rejectUnauthorized: true };

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: sslOptions,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
});

// Tabelas críticas para multi-tenant (devem ter RLS)
const CRITICAL_TENANT_TABLES = [
    'organizations',        // Tenant raiz
    'organization_members',   // Membros por tenant
    'subscriptions',        // Billing por tenant
    'billing_events',       // Financeiro por tenant
    'usage',                // Métricas por tenant
    'roles',                // Permissões por tenant
    'permissions',          // Permissões globais (menos crítico)
    'products',             // Dados e-commerce por tenant
    'product_variations',   // Variações de produto
    'warehouses',           // Inventário por tenant
    'stock_balances',       // Saldo por tenant
    'inventory_movements',  // Movimentação de inventário
    'users'                 // Usuários (via auth.users)
];

async function runAudit() {
    let client;

    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║   AUDITORIA RLS - Tabelas sem Row Level Security               ║');
    console.log('║   Projeto: ardpabjoepzhkpmkgwgu (Revolution X)                 ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log('');

    try {
        console.log('🔌 Conectando ao Supabase produção...');
        client = await pool.connect();
        console.log('✅ Conexão estabelecida\n');

        // 1. Listar todas as tabelas e seu status RLS
        console.log('═'.repeat(60));
        console.log('  1. STATUS RLS DE TODAS AS TABELAS');
        console.log('═'.repeat(60));

        const rlsResult = await client.query(`
            SELECT
                t.tablename,
                t.rowsecurity as rls_enabled,
                COUNT(p.polname) as policy_count,
                STRING_AGG(p.polname, ', ' ORDER BY p.polname) as policies
            FROM pg_tables t
            LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.tablename = p.tablename
            WHERE t.schemaname = 'public'
            GROUP BY t.tablename, t.rowsecurity
            ORDER BY t.tablename
        `);

        const tablesWithoutRLS = rlsResult.rows.filter(r => !r.rls_enabled);
        const tablesWithRLS = rlsResult.rows.filter(r => r.rls_enabled);

        console.log(`\n📊 Tabelas COM RLS:  ${tablesWithRLS.length}`);
        console.log(`📊 Tabelas SEM RLS:  ${tablesWithoutRLS.length}\n`);

        // 2. Mapear tabelas sem RLS com nível de risco
        console.log('═'.repeat(60));
        console.log('  2. TABELAS SEM RLS - ANÁLISE DE RISCO');
        console.log('═'.repeat(60));

        const criticalWithoutRLS = tablesWithoutRLS.filter(t =>
            CRITICAL_TENANT_TABLES.includes(t.tablename)
        );

        if (criticalWithoutRLS.length === 0) {
            console.log('\n✅ Todas as tabelas críticas possuem RLS ativado!\n');
        } else {
            console.log('\n🚨 TABELAS CRÍTICAS SEM RLS (Multi-tenant exposto):\n');
            console.log('  ' + 'Tabela'.padEnd(30) + ' | ' + 'Nível de Risco');
            console.log('  ' + '-'.repeat(28) + '-+-' + '-'.repeat(15));

            criticalWithoutRLS.forEach(t => {
                const riskLevel = t.tablename === 'users' ? 'MÉDIO (auth RLS)' :
                                  ['organizations', 'organization_members', 'subscriptions', 'billing_events', 'usage'].includes(t.tablename) ?
                                  'CRÍTICO' : 'MÉDIO';
                console.log(`  ${t.tablename.padEnd(30)} | ${riskLevel}`);
            });
            console.log('');
        }

        // Tabelas não críticas sem RLS
        const nonCriticalWithoutRLS = tablesWithoutRLS.filter(t =>
            !CRITICAL_TENANT_TABLES.includes(t.tablename)
        );

        if (nonCriticalWithoutRLS.length > 0) {
            console.log('ℹ️  Tabelas não críticas sem RLS:\n');
            nonCriticalWithoutRLS.forEach(t => {
                console.log(`  - ${t.tablename}`);
            });
            console.log('');
        }

        // 3. Verificar dados nas tabelas críticas
        console.log('═'.repeat(60));
        console.log('  3. ANÁLISE DE DADOS NAS TABELAS CRÍTICAS');
        console.log('═'.repeat(60));

        const dataResult = await client.query(`
            SELECT 'organizations' as table_name, COUNT(*) as row_count
            FROM organizations
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

        console.log('\n  ' + 'Tabela'.padEnd(30) + ' | ' + 'Linhas' + ' | ' + 'Status');
        console.log('  ' + '-'.repeat(28) + '-+------+-+----------');

        dataResult.rows.forEach(r => {
            const hasRows = r.row_count > 0;
            const status = hasRows ? '⚠️  DADOS REAIS' : '✅ VAZIA';
            const riskIcon = hasRows ? '🔴' : '🟢';
            console.log(`  ${r.table_name.padEnd(28)} | ${String(r.row_count).padEnd(7)} | ${status}`);
        });
        console.log('');

        // 4. Verificar migrations 025-029
        console.log('═'.repeat(60));
        console.log('  4. STATUS MIGRATIONS 025-029');
        console.log('═'.repeat(60));

        const migrationsResult = await client.query(`
            SELECT version, name
            FROM supabase_migrations.schema_migrations
            WHERE version IN ('025', '026', '027', '028', '029')
            ORDER BY version
        `);

        const appliedMigrations = migrationsResult.rows.map(r => r.version);
        const migrationStatus = {};

        ['025', '026', '027', '028', '029'].forEach(v => {
            const status = appliedMigrations.includes(v);
            migrationStatus[v] = status;
        });

        console.log('');
        console.log('  ' + 'Migration'.padEnd(15) + ' | ' + 'Status');
        console.log('  ' + '-'.repeat(13) + '-+---------');

        ['025', '026', '027', '028', '029'].forEach(v => {
            const status = migrationStatus[v] ? '✅ APLICADA' : '❌ PENDENTE';
            console.log(`  ${v.padEnd(13)} | ${status}`);
        });
        console.log('');

        // 5. Detalhes específicos de integration_events
        console.log('═'.repeat(60));
        console.log('  5. DETALHES - integration_events (Migration 029)');
        console.log('═'.repeat(60));

        const ieRls = await client.query(`
            SELECT rowsecurity FROM pg_tables WHERE tablename = 'integration_events'
        `);

        const iePolicies = await client.query(`
            SELECT policyname, polusing FROM pg_policies WHERE tablename = 'integration_events'
        `);

        console.log('');
        console.log(`  RLS habilitado: ${ieRls.rows[0]?.rls_enabled ? '✅ SIM' : '❌ NÃO'}`);
        console.log(`  Políticas: ${iePolicies.rows.length}`);

        if (iePolicies.rows.length > 0) {
            iePolicies.rows.forEach(p => {
                console.log(`    - ${p.policyname}`);
            });
        }
        console.log('');

        // 6. Schema das tabelas críticas (colunas de tenant)
        console.log('═'.repeat(60));
        console.log('  6. COLUNAS DE TENANT (organization_id)');
        console.log('═'.repeat(60));

        const tenantTables = ['organizations', 'organization_members', 'subscriptions', 'billing_events', 'products', 'roles'];

        console.log('');
        for (const table of tenantTables) {
            try {
                const colResult = await client.query(`
                    SELECT column_name, data_type
                    FROM information_schema.columns
                    WHERE table_name = $1 AND table_schema = 'public'
                    AND (column_name ILIKE '%organization%' OR column_name ILIKE '%tenant%')
                    ORDER BY ordinal_position
                `, [table]);

                if (colResult.rows.length > 0) {
                    console.log(`  ${table}:`);
                    colResult.rows.forEach(c => {
                        console.log(`    - ${c.column_name} (${c.data_type})`);
                    });
                } else {
                    console.log(`  ${table}: ⚠️  SEM colunas de tenant`);
                }
            } catch (e) {
                console.log(`  ${table}: ❌ Erro - ${e.message}`);
            }
        }
        console.log('');

        // 7. Resumo final
        console.log('═'.repeat(60));
        console.log('  RESUMO E AÇÃO REQUERIDA');
        console.log('═'.repeat(60));

        const hasCriticalWithoutRLS = criticalWithoutRLS.length > 0;
        const hasMigrationGaps = !migrationStatus['029'];
        const hasRealData = dataResult.rows.some(r => r.row_count > 0);

        console.log('');

        if (!hasCriticalWithoutRLS && !hasMigrationGaps) {
            console.log('✅ Segurança multi-tenant: OK');
            console.log('✅ Migrations recentes: OK');
            console.log('ℹ️  Tabelas sem RLS críticas estão vazias');
        } else {
            console.log('⚠️  AÇÕES REQUERIDAS:');
            console.log('');

            if (hasCriticalWithoutRLS) {
                console.log('  1. HABILITAR RLS em tabelas críticas:');
                criticalWithoutRLS.forEach(t => {
                    console.log(`     - ${t.tablename}`);
                });
                console.log('     Script sugerido: scripts/apply-rls-fix-direct.js');
                console.log('');
            }

            if (!migrationStatus['029']) {
                console.log('  2. APLICAR Migration 029 (integration_events RLS):');
                console.log('     - Habilita RLS em integration_events');
                console.log('     - Cria políticas tenant isolation');
                console.log('     - Comando: supabase db push --file supabase/migrations/029_integration_events_rls_fix.sql');
                console.log('');
            }

            if (hasRealData) {
                console.log('  ⚠️  ATENÇÃO: Dados reais detectados!');
                console.log('     FAÇA BACKUP antes de aplicar RLS.');
                console.log('     Teste em staging primeiro.');
                console.log('');
            }
        }

        // 8. Script de rollback sugerido
        if (hasCriticalWithoutRLS) {
            console.log('═'.repeat(60));
            console.log('  8. SCRIPT RLS SUGERIDO (para tabelas sem RLS)');
            console.log('═'.repeat(60));
            console.log('');
            console.log('  Para habililitar RLS em tabelas críticas, execute:');
            console.log('');
            console.log('  ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;');
            console.log('  ALTER TABLE organizations FORCE ROW LEVEL SECURITY;');
            console.log('  CREATE POLICY org_tenant ON organizations');
            console.log('    FOR ALL USING (id = NULLIF(current_setting(\'app.current_org\', true), \'\')::uuid);');
            console.log('');
        }

        console.log('══════════════════════════════════════════════════════════════════');

    } catch (error) {
        console.error('\n❌ ERRO na auditoria:', error.message);
        console.error('   Verifique conexão com produção');
        process.exit(1);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

runAudit();