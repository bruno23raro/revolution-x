#!/usr/bin/env node
/**
 * Script para aplicar migration 029 em produção
 * Usa as credenciais do CREDENCIAIS.md
 */

const sql = require('pg');

// Credenciais de produção (do CREDENCIAIS.md)
// SUPABASE_SERVICE_ROLE_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
// DB password: MWf4HWz66Vx1EMMw (b23b23v1814* revogada)

const client = new sql.Client({
    host: 'db.ardpabjoepzhkpmkgwgu.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: process.env.SUPABASE_DB_PASSWORD, // Requerido - sem fallback seguro
    ssl: {
        rejectUnauthorized: true // TLS padrão
    }
});

const migrationSQL = `
-- Migration 029: Correção RLS para integration_events
-- Data: 2026-11-12

-- 1. Habilitar RLS se não estiver habilitado
DO $$
DECLARE rls_enabled BOOLEAN;
BEGIN
  SELECT rowsecurity INTO rls_enabled FROM pg_tables WHERE tablename = 'integration_events';
  IF NOT rls_enabled THEN
    ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS habilitado com sucesso';
  END IF;
END $$;

-- 2. Habilitar FORCE RLS (necessário para multi-tenant)
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

-- 5. Comentários
COMMENT ON TABLE integration_events IS 'Trilha de auditoria de eventos de integração (conexão, erro, renovação, troca de modo)';
COMMENT ON COLUMN integration_events.event_type IS 'Tipo do evento: connection_success, connection_failed, disconnection, credential_renewal, mode_switch, error';
COMMENT ON POLICY integration_events_tenant IS 'Multi-tenant isolation: only events belonging to current tenant accessible via app.current_org GUC';
COMMENT ON POLICY integration_events_service_role IS 'Service role bypass for admin operations (webhooks, onboarding, admin tasks)';

SELECT 'Migration 029 aplicada com sucesso' as result;
`;

async function applyMigration() {
    console.log('='.repeat(70));
    console.log('  APLICAÇÃO MIGRATION 029 - CORREÇÃO RLS INTEGRATION_EVENTS');
    console.log('='.repeat(70));
    console.log('');

    try {
        console.log('🔌 Conectando ao Supabase produção...');
        await client.connect();
        console.log('✅ Conexão estabelecida\n');

        // Verificar estado atual
        console.log('📊 Verificando estado atual da tabela...');
        const checkResult = await client.query(`
            SELECT
                EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integration_events') as table_exists,
                (SELECT rowsecurity FROM pg_tables WHERE tablename = 'integration_events') as rls_enabled,
                (SELECT count(*) FROM pg_policies WHERE tablename = 'integration_events') as policy_count
        `);

        const { table_exists, rls_enabled, policy_count } = checkResult.rows[0];

        console.log(`   Tabela integration_events existe: ${table_exists}`);
        console.log(`   RLS habilitado: ${rls_enabled}`);
        console.log(`   Policies existentes: ${policy_count}`);
        console.log('');

        if (!table_exists) {
            console.error('❌ Tabela integration_events não existe na produção');
            process.exit(1);
        }

        if (rls_enabled === true && policy_count > 0) {
            console.log('✅ RLS já configurado - migration é idempotente, nada a fazer');
            process.exit(0);
        }

        console.log('⚠️  APLICANDO MIGRATION 029 EM PRODUÇÃO');
        console.log('='.repeat(70) + '\n');

        // Executar migration
        await client.query(migrationSQL);
        console.log('✅ SQL executado com sucesso\n');

        // Verificar resultado
        const result = await client.query(`
            SELECT
                (SELECT rowsecurity FROM pg_tables WHERE tablename = 'integration_events') as rls_enabled,
                (SELECT count(*) FROM pg_policies WHERE tablename = 'integration_events') as policy_count
        `);

        const { rls_enabled: newRLS, policy_count: newCount } = result.rows[0];

        console.log('📊 Estado pós-migração:');
        console.log(`   RLS habilitado: ${newRLS}`);
        console.log(`   Policies: ${newCount}`);
        console.log('');

        await client.end();

        if (newRLS === true && newCount === 2) {
            console.log('✅ Migration 029 aplicada com SUCESSO!');
            console.log('');
            console.log('   - Tabela integration_events protegida por RLS');
            console.log('   - Política de tenant ativa (multi-tenant isolation)');
            console.log('   - Política de service_role ativa (admin bypass)');
            process.exit(0);
        } else {
            console.error('❌ Resultado inesperado. Verifique manualmente.');
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Erro:', error.message);
        if (client) {
            await client.end().catch(() => {});
        }
        process.exit(1);
    }
}

// Aviso de segurança
console.log('');
console.log('⚠️  ATENÇÃO: Este script conecta diretamente ao banco de PRODUÇÃO');
console.log('⚠️  A migration é FORWARD-ONLY e IDEMPOTENTE (pode ser executada múltiplas vezes)');
console.log('');

const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('Digite "SIM" para confirmar aplicação em produção: ', (answer) => {
    rl.close();
    if (answer === 'SIM') {
        applyMigration();
    } else {
        console.log('Operações canceladas.');
        process.exit(0);
    }
});