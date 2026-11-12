#!/usr/bin/env node
/**
 * Script de verificação pós-migration 029
 */

const pg = require('pg');

// Requer DATABASE_URL via variável de ambiente (segurança)
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error('❌ ERRO: DATABASE_URL environment variable is required');
    console.error('   Configure via:')
    console.error('   - .env file: DATABASE_URL="postgresql://..."')
    console.error('   - Or use your .env.local with Supabase credentials')
    process.exit(1);
}

const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: true }
});

const sqlVerify = `
SELECT
  (SELECT rowsecurity FROM pg_tables WHERE tablename = 'integration_events') as rls_enabled,
  (SELECT count(*) FROM pg_policies WHERE tablename = 'integration_events') as policy_count,
  (SELECT string_agg(policyname, ', ') FROM pg_policies WHERE tablename = 'integration_events') as policies;
`;

(async () => {
    let client;
    try {
        client = await pool.connect();
        const result = await client.query(sqlVerify);
        const { rls_enabled, policy_count, policies } = result.rows[0];

        console.log('═══════════════════════════════════════════════════════════════════');
        console.log('  VERIFICAÇÃO MIGRATION 029 - STATUS FINAL');
        console.log('═══════════════════════════════════════════════════════════════════');
        console.log('');
        console.log('  RLS habilitado:', rls_enabled);
        console.log('  Policies criadas:', policy_count);
        console.log('  Nomes:', policies);
        console.log('');

        const success = rls_enabled === true && policy_count >= 2;
        if (success) {
            console.log('✅ MIGRATION 029 APLICADA COM SUCESSO!');
            console.log('');
            console.log('   - Tabela integration_events protegida por RLS');
            console.log('   - Política tenant: multi-tenant isolation ativa');
            console.log('   - Política service_role: admin bypass ativo');
            console.log('');
            console.log('   Próximos passos recomendados:');
            console.log('   1. Testar isolamento multi-tenant com apps diferentes');
            console.log('   2. Verificar logs de eventos de integração');
            console.log('   3. Monitorar por 24h após deploy');
        } else {
            console.log('❌ VERIFICAÇÃO FALHOU - Verifique manualmente');
            process.exit(1);
        }
    } catch (error) {
        console.error('Erro:', error.message);
        process.exit(1);
    } finally {
        if (client) client.release();
        await pool.end();
    }
})();