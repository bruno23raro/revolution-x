-- ============================================================
-- MIGRATION 029 - CORREÇÃO RLS RÁPIDA PARA PRODUÇÃO
-- ============================================================
-- Data: 2026-11-12
-- Estado: Tabela integration_events JÁ EXISTE com RLS DESATIVADO
--
-- Instruções:
-- 1. Backup do banco de produção antes de executar
-- 2. Executar via psql:
--    psql -h db.ardpabjoepzhkpmkgwgu.supabase.co -U postgres -d postgres -f scripts/apply-rls-quick.sql
-- 3. Ou via Supabase CLI:
--    npx supabase db push --db-url $DATABASE_URL
--
-- Credenciais (configurar via variáveis de ambiente):
--   Host: db.ardpabjoepzhkpmkgwgu.supabase.co
--   Port: 5432
--   DB: postgres
--   User: postgres
--   Password: definir via SUPABASE_DB_PASSWORD ou PGPASSWORD
-- ============================================================

BEGIN;

-- 1. Habilitar RLS se não estiver habilitado
DO $$
DECLARE rls_enabled BOOLEAN;
BEGIN
  SELECT rowsecurity INTO rls_enabled FROM pg_tables WHERE tablename = 'integration_events';
  IF NOT rls_enabled THEN
    ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS habilitado';
  END IF;
END $$;

-- 2. Habilitar FORCE RLS (crucial para multi-tenant)
ALTER TABLE integration_events FORCE ROW LEVEL SECURITY;

-- 3. Política de tenant (multi-tenant isolation)
-- Idempotent: só cria se não existir
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'integration_events' AND policyname = 'integration_events_tenant')
  THEN
    CREATE POLICY integration_events_tenant ON integration_events
      FOR ALL TO PUBLIC
      USING (workspace_id = NULLIF(current_setting('app.current_org', true), '')::uuid)
      WITH CHECK (workspace_id = NULLIF(current_setting('app.current_org', true), '')::uuid);
  END IF;
END $$;

-- 4. Política para service_role (administradora)
-- Necessária para webhooks, onboarding e operações admin
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'integration_events' AND policyname = 'integration_events_service_role')
  THEN
    CREATE POLICY integration_events_service_role ON integration_events
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

COMMIT;

-- ============================================================
-- VERIFICAÇÃO PÓS-APLICAÇÃO
-- Execute estas queries para confirmar:
-- ============================================================

-- SELECT 1 FROM pg_tables WHERE tablename = 'integration_events' AND rowsecurity = true;
-- SELECT policyname FROM pg_policies WHERE tablename = 'integration_events';

-- Teste de isolamento multi-tenant (deve retornar 0 ou apenas eventos do tenant):
-- SET LOCAL app.current_org = 'org-test-uuid';
-- SELECT COUNT(*) FROM integration_events;

-- Teste de INSERT com workspace errado (deve falhar com policy violation):
-- SET LOCAL app.current_org = 'org-valido-uuid';
-- INSERT INTO integration_events (workspace_id, integration_id, event_type, payload)
-- VALUES ('other-org-uuid', 'int-uuid', 'connection_success', '{}');
-- ============================================================