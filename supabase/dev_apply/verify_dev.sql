-- ============================================================================
-- verify_dev.sql — VERIFICACAO (READ-ONLY) apos aplicar a cadeia DEV:
--   002a_supabase_base + 005 + 015 + 016
-- Projeto DEV: urdmpzjycwywsjzhpntc. NUNCA executar rotinas de escrita aqui.
-- Executar com o mesmo host que usou para aplicar (psql/service_role).
-- ============================================================================
\set ON_ERROR_STOP 1

SELECT '--- 1) tabelas snake presentes ---' AS check;
SELECT to_regclass('public.organizations')     IS NOT NULL AS organizations,
       to_regclass('public.meta_integrations') IS NOT NULL AS meta_integrations,
       to_regclass('public.webhook_events')    IS NOT NULL AS webhook_events;

SELECT '--- 2) colunas de meta_integrations (snake) ---' AS check;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'meta_integrations'
ORDER BY ordinal_position;

SELECT '--- 3) indices unicos (016 + 015) ---' AS check;
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN ('uq_meta_integrations_account','uq_meta_integrations_page','uq_webhook_events_meta_event_id')
ORDER BY indexname;

SELECT '--- 4) UNIQUE legado (org,provider) deve estar ausente ---' AS check;
SELECT EXISTS (SELECT 1 FROM pg_constraint
               WHERE conname = 'meta_integrations_organization_id_provider_key') AS legacy_unique_present;

SELECT '--- 5) RLS em meta_integrations / webhook_events ---' AS check;
SELECT relname, relrowsecurity AS rls_enabled
FROM pg_class WHERE relname IN ('meta_integrations','webhook_events') ORDER BY relname;
SELECT polname, qual FROM pg_policy
WHERE polname LIKE 'meta\_%' OR polname LIKE '%tenant%' ORDER BY polname;

SELECT '--- 6) contagens (DEV limpo => auth.users e meta_integrations vazias) ---' AS check;
SELECT (SELECT count(*) FROM auth.users) AS auth_users,
       (SELECT count(*) FROM public.meta_integrations) AS meta_rows;
