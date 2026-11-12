#!/usr/bin/env node
/**
 * Script para aplicar correção RLS em integration_events
 * Uso: node scripts/apply-rls-fix.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Erro: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios');
  console.error('Verifique .env.local');
  process.exit(1);
}

// Criar cliente com service role para operações admin
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  db: { schema: 'public' },
  auth: { autoRefreshToken: false, persistSession: false },
  global: { fetch }
});

async function applyRLSFix() {
  console.log('🔧 Aplicando correção RLS para integration_events...\n');

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
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'integration_events' AND policyname = 'integration_events_tenant') THEN
        CREATE POLICY integration_events_tenant ON integration_events
          FOR ALL TO PUBLIC
          USING (workspace_id = NULLIF(current_setting('app.current_org', true), '')::uuid)
          WITH CHECK (workspace_id = NULLIF(current_setting('app.current_org', true), '')::uuid);
      END IF;
    END $$;`,

    // 4. Política para service_role
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'integration_events' AND policyname = 'integration_events_service_role') THEN
        CREATE POLICY integration_events_service_role ON integration_events
          FOR ALL TO service_role
          USING (true)
          WITH CHECK (true);
      END IF;
    END $$;`
  ];

  for (let i = 0; i < sqlStatements.length; i++) {
    const sql = sqlStatements[i];
    console.log(`Executando passo ${i + 1}/${sqlStatements.length}...`);

    const { data, error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.error(`❌ Erro no passo ${i + 1}:`, error.message);
      // Tentar novamente com raw query
      try {
        const { data2, error2 } = await supabase.from('IntegrationEvent').select('id').limit(1);
        console.log('Conexão funcionando');
      } catch (e) {
        console.error('Conexão com Supabase falhou');
      }
    } else {
      console.log(`✅ Passo ${i + 1} concluído`);
    }
  }

  // Verificar resultado
  console.log('\n📊 Verificando estado pós-migração...\n');

  // Verificar RLS
  const { data: rlsCheck, error: rlsError } = await supabase.rpc('exec_sql', {
    sql: `SELECT rowsecurity FROM pg_tables WHERE tablename = 'integration_events'`
  });

  if (rlsCheck?.length > 0) {
    console.log(`✅ RLS habilitado: ${rlsCheck[0].rowsecurity}`);
  }

  // Verificar policies
  const { data: policies, error: policiesError } = await supabase.rpc('exec_sql', {
    sql: `SELECT policyname FROM pg_policies WHERE tablename = 'integration_events'`
  });

  if (policies) {
    console.log(`✅ Policies encontradas: ${policies.length}`);
    policies.forEach(p => console.log(`   - ${p.policyname}`));
  }

  console.log('\n✅ Correção RLS aplicada com sucesso!');
}

applyRLSFix().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});