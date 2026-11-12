#!/usr/bin/env node
/**
 * Script para aplicar migration 029 em produção
 * Conecta diretamente ao PostgreSQL Supabase
 */

const pg = require('pg');

// Configurações - Requer DATABASE_URL via variável de ambiente
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error('❌ ERRO: DATABASE_URL environment variable is required');
    console.error('   Configure via:')
    console.error('   - .env file: DATABASE_URL="postgresql://..."')
    console.error('   - Or use your .env.local with Supabase credentials')
    process.exit(1);
}

console.log('='.repeat(70));
console.log('  MIGRATION 029 - CORREÇÃO RLS integration_events');
console.log('='.repeat(70));
console.log('');

const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 30000,
    acquireTimeoutMillis: 30000
});

const sqlMigration = `
BEGIN;

-- 1. Habilitar RLS se não estiver habilitado
DO $$
DECLARE rls_enabled BOOLEAN;
BEGIN
  SELECT rowsecurity INTO rls_enabled FROM pg_tables WHERE tablename = 'integration_events';
  IF NOT rls_enabled THEN
    ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- 2. Habilitar FORCE RLS
ALTER TABLE integration_events FORCE ROW LEVEL SECURITY;

-- 3. Política de tenant (idempotente)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'integration_events' AND policyname = 'integration_events_tenant')
  THEN
    CREATE POLICY integration_events_tenant ON integration_events
      FOR ALL TO PUBLIC
      USING (workspace_id = NULLIF(current_setting('app.current_org', true), '')::uuid)
      WITH CHECK (workspace_id = NULLIF(current_setting('app.current_org', true), '')::uuid);
  END IF;
END $$;

-- 4. Política para service_role (idempotente)
DO $$ BEGIN
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

COMMIT;
`;

const sqlVerify = `
SELECT
  (SELECT rowsecurity FROM pg_tables WHERE tablename = 'integration_events') as rls_enabled,
  (SELECT count(*) FROM pg_policies WHERE tablename = 'integration_events') as policy_count,
  (SELECT string_agg(policyname, ', ') FROM pg_policies WHERE tablename = 'integration_events') as policies;
`;

(async function main() {
    let client;

    try {
        console.log('🔌 Conectando ao Supabase...');
        client = await pool.connect();
        console.log('✅ Conexão estabelecida\n');

        // Verificar estado atual
        console.log('📊 Estado atual da tabela:');
        const checkResult = await client.query(`
            SELECT
                EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integration_events') as table_exists,
                (SELECT rowsecurity FROM pg_tables WHERE tablename = 'integration_events') as rls_enabled,
                (SELECT count(*) FROM pg_policies WHERE tablename = 'integration_events') as policy_count;
        `);

        const { table_exists, rls_enabled, policy_count } = checkResult.rows[0];

        console.log('   Tabela integration_events:', table_exists ? 'EXISTS' : 'NOT FOUND');
        console.log('   RLS habilitado:', rls_enabled || false);
        console.log('   Policies:', policy_count);
        console.log('');

        if (!table_exists) {
            console.error('❌ ERRO: Tabela integration_events não existe no banco');
            console.error('   Não é possível aplicar a migration.');
            process.exit(1);
        }

        if (rls_enabled && policy_count >= 1) {
            console.log('✅ RLS já está configurado - migration é idempotente');
            console.log('   Nenhuma ação necessária.');
            process.exit(0);
        }

        // Executar migration
        console.log('⚠️  APLICANDO MIGRATION 029 EM PRODUÇÃO');
        console.log('='.repeat(70) + '\n');

        await client.query(sqlMigration);
        console.log('✅ SQL da migration executado com sucesso\n');

        // Verificar resultado
        console.log('📊 Verificando resultado...\n');

        const verifyResult = await client.query(sqlVerify);
        const { rls_enabled: newRLS, policy_count: newCount, policies } = verifyResult.rows[0];

        console.log('   RLS habilitado:', newRLS);
        console.log('   Policies criadas:', newCount);
        console.log('   Nomes:', policies || 'Nenhuma');
        console.log('');

        if (newRLS && newCount === 2) {
            console.log('✅ CORREÇÃO RLS APLICADA COM SUCESSO!');
            console.log('');
            console.log('   - Tabela integration_events protegida por RLS');
            console.log('   - Política tenant: multi-tenant isolation ativa');
            console.log('   - Política service_role: admin bypass ativo');
            console.log('');
            console.log('   Próximos passos:');
            console.log('   1. Executar testes de integração multi-tenant');
            console.log('   2. Monitorar logs por 24h');
        } else {
            console.log('⚠️ Resultado inesperado. Verifique manualmente.');
            process.exit(1);
        }

    } catch (error) {
        console.error('\n❌ Erro durante a aplicação da migration:');
        console.error(error.message);
        if (error.position) {
            console.error('  Position:', error.position);
        }
        process.exit(1);
    } finally {
        if (client) {
            client.release();
        }
        await pool.end();
        console.log('\n🔌 Conexão encerrada');
    }
})();