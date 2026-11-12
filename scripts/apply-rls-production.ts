/**
 * Script para aplicar migration 029 em produção
 * Aplica correção RLS na tabela integration_events
 *
 * USO: npx tsx scripts/apply-rls-production.ts
 *
 * Pré-requisitos: ter o .env.production configurado com SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import dotenv from 'dotenv';

// Carregar .env.production
dotenv.config({ path: '.env.production' });
dotenv.config({ path: '.env.local' }); // fallback

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL || process.env.DIRECT_URL;

console.log('='.repeat(70));
console.log('  APLICAÇÃO MIGRATION 029 - CORREÇÃO RLS INTEGRATION_EVENTS');
console.log('='.repeat(70));

// SQL da migration 029
const sqlStatements = [
  // 1. Habilitar RLS se não estiver habilitado
  `DO $$
  DECLARE rls_enabled BOOLEAN;
  BEGIN
    SELECT rowsecurity INTO rls_enabled FROM pg_tables WHERE tablename = 'integration_events';
    IF NOT rls_enabled THEN
      ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;
      RAISE NOTICE 'RLS habilitado';
    END IF;
  END $$;`,

  // 2. Habilitar FORCE RLS
  `ALTER TABLE integration_events FORCE ROW LEVEL SECURITY;`,

  // 3. Política de tenant (idempotente)
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'integration_events' AND policyname = 'integration_events_tenant')
    THEN
      CREATE POLICY integration_events_tenant ON integration_events
        FOR ALL TO PUBLIC
        USING (workspace_id = NULLIF(current_setting('app.current_org', true), '')::uuid)
        WITH CHECK (workspace_id = NULLIF(current_setting('app.current_org', true), '')::uuid);
    END IF;
  END $$;`,

  // 4. Política para service_role (idempotente)
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'integration_events' AND policyname = 'integration_events_service_role')
    THEN
      CREATE POLICY integration_events_service_role ON integration_events
        FOR ALL TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;
  END $$;`
];

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('\n❌ Erro: Variáveis de ambiente não encontradas');
    console.error('   Precisa de SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY\n');
    process.exit(1);
  }

  console.log(`\n📍 Supabase URL: ${SUPABASE_URL}`);
  console.log(`🔐 Service Role: ${SERVICE_ROLE_KEY.substring(0, 30)}...\n`);

  // Conectar via PostgreSQL diretamente
  // Requer DATABASE_URL completo via variável de ambiente
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL é obrigatório via variável de ambiente');
    console.error('   Configure em .env.production\n');
    process.exit(1);
  }

  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: true } // TLS padrão
  });

  let client: pg.Client | null = null;

  try {
    console.log('🔌 Conectando ao banco de produção...\n');

    client = await pool.connect();
    console.log('✅ Conexão estabelecida com sucesso\n');

    // Verificar estado atual
    console.log('📊 Verificando estado atual da tabela...');
    const checkResult = await client.query(`
      SELECT
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integration_events') as table_exists,
        (SELECT rowsecurity FROM pg_tables WHERE tablename = 'integration_events') as rls_enabled,
        (SELECT count(*) FROM pg_policies WHERE tablename = 'integration_events') as policy_count
    `);

    const { table_exists, rls_enabled, policy_count } = checkResult.rows[0];

    console.log(`   Tabela existe: ${table_exists}`);
    console.log(`   RLS habilitado: ${rls_enabled}`);
    console.log(`   Policies: ${policy_count}\n`);

    if (!table_exists) {
      console.error('❌ Tabela integration_events não existe no banco de produção');
      console.error('   Não é possível aplicar a migration.\n');
      process.exit(1);
    }

    if (rls_enabled && policy_count > 0) {
      console.log('✅ RLS já está configurado. Migration pode ser ignorada (idempotente).\n');
      process.exit(0);
    }

    // Confirmar com o usuário (já temos autorização)
    console.log('⚠️  APLICAÇÃO EM PRODUÇÃO DETECTADA');
    console.log('   Migration 029 será executada para corrigir RLS em integration_events\n');

    // Executar cada statement
    for (let i = 0; i < sqlStatements.length; i++) {
      const sql = sqlStatements[i];

      console.log(`📝 Passo ${i + 1}/${sqlStatements.length}:`);

      // Extrair descrição do SQL
      const desc = sql.substring(0, 100).replace(/\n/g, ' ').trim() + '...';
      console.log(`   ${desc}\n`);

      try {
        await client.query(sql);
        console.log(`   ✅ Passo ${i + 1} concluído\n`);
      } catch (err: any) {
        console.error(`   ❌ Erro no passo ${i + 1}:`);
        console.error(`   ${err.message}\n`);
        throw err;
      }
    }

    // Verificar resultado
    console.log('📊 Verificando resultado...\n');

    const result = await client.query(`
      SELECT
        (SELECT rowsecurity FROM pg_tables WHERE tablename = 'integration_events') as rls_enabled,
        (SELECT count(*) FROM pg_policies WHERE tablename = 'integration_events') as policy_count
    `);

    const { rls_enabled: newRLS, policy_count: newCount } = result.rows[0];

    console.log(`   RLS habilitado: ${newRLS}`);
    console.log(`   Policies: ${newCount}`);

    if (newRLS && newCount === 2) {
      console.log('\n✅ Correção RLS aplicada com SUCESSO na produção!\n');
      console.log('   - Tabela integration_events agora protegida por RLS');
      console.log('   - Política de tenant ativa (multi-tenant isolation)');
      console.log('   - Política de service_role ativa (admin bypass)');
    } else {
      console.log('\n⚠️ Resultado inesperado. Verifique manualmente.\n');
    }

  } catch (err: any) {
    console.error('\n❌ Erro durante a aplicação da migration:');
    console.error(err.message);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
    console.log('🔌 Conexão encerrada\n');
  }
}

main();