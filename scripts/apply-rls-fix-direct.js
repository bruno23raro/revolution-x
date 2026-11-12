#!/usr/bin/env node
/**
 * Script Direct para aplicar migration 029
 * Usa apenas dependências já instaladas no projeto
 */

// Carregar pg client diretamente do node_modules
const path = require('path');
const fs = require('fs');

// Tentar carregar pg
let pg;
try {
    pg = require('pg');
} catch (e) {
    console.error('pg não encontrado. Instale com: npm install pg');
    process.exit(1);
}

// Configurações - Requer DATABASE_URL via variável de ambiente (segurança)
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error('❌ ERRO: DATABASE_URL environment variable is required');
    console.error('   Configure via:');
    console.error('   - .env file: DATABASE_URL="postgresql://..."');
    console.error('   - Or use your .env.local with Supabase credentials');
    process.exit(1);
}

console.log('='.repeat(70));
console.log('  MIGRATION 029 - CORREÇÃO RLS integration_events');
console.log('='.repeat(70));
console.log('');

// SQL da migration (forward-only, idempotente)
const sqlStatements = [
    `BEGIN;

    -- 1. Habilitar RLS se não estiver habilitado
    DO \$\$
    DECLARE rls_enabled BOOLEAN;
    BEGIN
      SELECT rowsecurity INTO rls_enabled FROM pg_tables WHERE tablename = 'integration_events';
      IF NOT rls_enabled THEN
        ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS habilitado';
      END IF;
    END $$;

    -- 2. Habilitar FORCE RLS
    ALTER TABLE integration_events FORCE ROW LEVEL SECURITY;

    -- 3. Política de tenant (idempotente)
    DO \$\$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'integration_events' AND policyname = 'integration_events_tenant')
      THEN
        CREATE POLICY integration_events_tenant ON integration_events
          FOR ALL TO PUBLIC
          USING (workspace_id = NULLIF(current_setting('app.current_org', true), '')::uuid)
          WITH CHECK (workspace_id = NULLIF(current_setting('app.current_org', true), '')::uuid);
      END IF;
    END $$;

    -- 4. Política para service_role (idempotente)
    DO \$\$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'integration_events' AND policyname = 'integration_events_service_role')
      THEN
        CREATE POLICY integration_events_service_role ON integration_events
          FOR ALL TO service_role
          USING (true)
          WITH CHECK (true);
      END IF;
    END $$;

    -- Comentários
    COMMENT ON TABLE integration_events IS 'Trilha de auditoria de eventos de integração';

    COMMIT;`
];

const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: true }
});

async function main() {
    let client;

    try {
        console.log('🔌 Conectando ao Supabase...');
        client = await pool.connect();
        console.log('✅ Conexão estabelecida\n');

        // Verificar se a tabela existe
        console.log('📊 Verificando tabela integration_events...');
        const check = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_name = 'integration_events'
            ) as exists,
            (SELECT rowsecurity FROM pg_tables WHERE tablename = 'integration_events') as rls_enabled,
            (SELECT count(*) FROM pg_policies WHERE tablename = 'integration_events') as policy_count;
        `);

        const { exists, rls_enabled, policy_count } = check.rows[0];

        if (!exists) {
            console.error('❌ Tabela integration_events não existe');
            process.exit(1);
        }

        console.log(`   Tabela existe: ${exists}`);
        console.log(`   RLS atual: ${rls_enabled}`);
        console.log(`   Policies atuais: ${policy_count}\n`);

        if (rls_enabled && policy_count > 0) {
            console.log('✅ RLS já configurado - migration é idempotente');
            process.exit(0);
        }

        // Executar migration
        console.log('⚠️  APLICANDO MIGRATION 029');
        console.log('='.repeat(70) + '\n');

        for (let i = 0; i < sqlStatements.length; i++) {
            console.log(`📝 Executando ${i + 1}/${sqlStatements.length}...`);
            await client.query(sqlStatements[i]);
            console.log(`   ✅ Concluído\n`);
        }

        // Verificar resultado
        console.log('📊 Verificando resultado final...\n');
        const result = await client.query(`
            SELECT
                (SELECT rowsecurity FROM pg_tables WHERE tablename = 'integration_events') as rls_enabled,
                (SELECT count(*) FROM pg_policies WHERE tablename = 'integration_events') as policy_count,
                (SELECT string_agg(policyname, ', ') FROM pg_policies WHERE tablename = 'integration_events') as policies;
        `);

        const { rls_enabled: newRLS, policy_count: newCount, policies } = result.rows[0];

        console.log(`   RLS habilitado: ${newRLS}`);
        console.log(`   Policies: ${newCount}`);
        console.log(`   Lista: ${policies || 'Nenhuma'}\n`);

        if (newRLS && newCount === 2) {
            console.log('✅ CORREÇÃO RLS APLICADA COM SUCESSO!\n');
            console.log('   - Tabela integration_events protegida por RLS');
            console.log('   - Política tenant: multi-tenant isolation ativa');
            console.log('   - Política service_role: admin bypass ativo');
        } else {
            console.log('⚠️ Resultado inesperado. Verifique manualmente.\n');
        }

    } catch (error) {
        console.error('\n❌ Erro:', error.message);
        process.exit(1);
    } finally {
        if (client) client.release();
        await pool.end();
        console.log('\n🔌 Conexão encerrada');
    }
}

main();