/**
 * Script para aplicar correção RLS em integration_events
 * Usa o Supabase Database API via service role
 * Execute com: npx tsx scripts/apply-rls-fix.ts
 */

import { createClient } from '@supabase/supabase-js';

// Configurações - ler do .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Erro: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios');
  console.error('Verifique .env.local');
  process.exit(1);
}

// Criar cliente com service role para operações admin
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  db: { schema: 'public' },
  auth: { autoRefreshToken: false, persistSession: false },
  global: { fetch },
});

async function applyRLSCorrection() {
  console.log('🔧 Aplicando correção RLS em integration_events...\n');
  console.log('Conectando ao banco de dados de produção via Supabase...\n');

  // SQL da migration 029 - correção RLS
  const sqlStatements = [
    // 1. Habilitar RLS se não estiver habilitado
    `DO $$ DECLARE rls_enabled BOOLEAN; BEGIN SELECT rowsecurity INTO rls_enabled FROM pg_tables WHERE tablename = 'integration_events'; IF NOT rls_enabled THEN ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY; END IF; END $$;`,

    // 2. Habilitar FORCE RLS
    `ALTER TABLE integration_events FORCE ROW LEVEL SECURITY;`,

    // 3. Política de tenant (idempotente)
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'integration_events' AND policyname = 'integration_events_tenant') THEN CREATE POLICY integration_events_tenant ON integration_events FOR ALL TO PUBLIC USING (workspace_id = NULLIF(current_setting('app.current_org', true), '')::uuid) WITH CHECK (workspace_id = NULLIF(current_setting('app.current_org', true), '')::uuid); END IF; END $$;`,

    // 4. Política para service_role (idempotente)
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'integration_events' AND policyname = 'integration_events_service_role') THEN CREATE POLICY integration_events_service_role ON integration_events FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;`
  ];

  // Verificar estado atual via SQL direto
  console.log('📊 Verificando estado atual da tabela...');

  // Verificar se a tabela existe e tem dados
  const { data: countResult, error: countError } = await supabase
    .from('integration_events')
    .select('id', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Erro ao acessar tabela integration_events:', countError.message);
    console.error('O banco de produção pode não ter a tabela ou não está acessível.');
    return;
  }

  console.log(`✅ Tabela acessível - existem registros`);

  // Aplicar migration usando RPC (não suportado, usar abordagem alternativa)
  console.log('\n⚠️ O RPC supabase não expõe exec_sql. Usando abordagem alternativa...\n');

  // Como alternativa, vamos usar a API REST via supabase-js com funcionalidades específicas
  // ou usar uma ferramenta de linha de comando

  console.log('💡 Recomendação: Aplicar migration manualmente via');
  console.log('   npx supabase db push --db-url $DATABASE_URL');
  console.log('   ou');
  console.log('   psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f supabase/migrations/029_integration_events_rls_fix.sql\n');
}

// Alternativa: usar PostgreSQL diretamente se tivermos a string de conexão
async function applyViaPostgres() {
  console.log('🔧 Tentando conexão direta via PostgreSQL...\n');

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL não configurada em .env.local');
    console.log('Configure a string de conexão e tente novamente.\n');
    return false;
  }

  // Verificar se pg está disponível
  let pg;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    pg = require('pg');
  } catch {
    console.error('❌ PostgreSQL client (pg) não está instalado ou não é acessível');
    return false;
  }

  const pool = new pg.Pool({ connectionString: DATABASE_URL });

  try {
    const client = await pool.connect();
    console.log('✅ Conexão PostgreSQL estabelecida\n');

    // Verificar estado atual
    const res = await client.query(
      "SELECT rowsecurity FROM pg_tables WHERE tablename = 'integration_events'"
    );
    const currentRLS = res.rows[0]?.rowsecurity;
    console.log(`Estado atual - RLS habilitado: ${currentRLS}\n`);

    client.release();
    return true;
  } catch (err: any) {
    console.error('❌ Erro de conexão:', err.message);
    return false;
  } finally {
    await pool.end();
  }
}

// Verificar se temos acesso ao MCP Supabase
async function checkSupabaseMCP() {
  console.log('🔍 Verificando migração 029...\n');

  // Ler a migration
  const fs = await import('fs');
  const path = await import('path');

  const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '029_integration_events_rls_fix.sql');

  if (fs.existsSync(migrationPath)) {
    console.log('✅ Migration 029 encontrada em:');
    console.log('   supabase/migrations/029_integration_events_rls_fix.sql\n');
  } else {
    console.log('⚠️ Migration 029 não encontrada no caminho esperado\n');
  }
}

// Main
async function main() {
  console.log('='.repeat(60));
  console.log('  APLICAÇÃO MIGRATION 029 - RLS CORREÇÃO');
  console.log('='.repeat(60) + '\n');

  // Verificar migração
  await checkSupabaseMCP();

  // Mostrar instruções
  console.log('📋 INSTRUÇÕES PARA APLICAÇÃO EM PRODUÇÃO:\n');

  console.log('Opção 1: Via Supabase CLI (recomendado)');
  console.log('   npx supabase db push supabase/migrations/029_integration_events_rls_fix.sql\n');

  console.log('Opção 2: Via psql diretamente');
  console.log('   psql -h db.ardpabjoepzhkpmkgwgu.supabase.co -U postgres -d postgres -f scripts/apply-rls-quick.sql\n');
  console.log('   Ou usando variável de ambiente:');
  console.log('   $env:PGPASSWORD="[senha]"; psql -h db.ardpabjoepzhkpmkgwgu.supabase.co -U postgres -d postgres -f scripts/apply-rls-quick.sql\n');

  console.log('\n⚠️  ANTES DE APLICAR:');
  console.log('   1. Faça backup do banco de produção');
  console.log('   2. Verifique o conteúdo da migration');
  console.log('   3. Teste em staging primeiro\n');

  console.log('📄 Conteúdo da migration:');
  console.log('-'.repeat(60) + '\n');

  const fs = require('fs');
  const migrationPath = './supabase/migrations/029_integration_events_rls_fix.sql';

  if (fs.existsSync(migrationPath)) {
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    console.log(migrationSQL);
  } else {
    console.log('Arquivo não encontrado');
  }

  console.log('\n' + '-'.repeat(60));
  console.log('\n✅ Script pronto para aplicação manual.\n');
}

main().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});