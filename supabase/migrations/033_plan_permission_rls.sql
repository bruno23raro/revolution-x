-- Migration 033: RLS para Plan e Permission (tabelas globais de catálogo)
-- ============================================================
-- Estas tabelas são catálogos globais (não multi-tenant), mas ainda precisam
-- de RLS FORCE para evitar bypass por owner. Acesso é read-only para
-- authenticated, write apenas para service_role.
-- ============================================================

-- Plan: catálogo de planos (preço, features, limites)
ALTER TABLE "Plan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Plan" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Plan_read" ON "Plan";
CREATE POLICY "Plan_read" ON "Plan"
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Plan_write" ON "Plan";
CREATE POLICY "Plan_write" ON "Plan"
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Permission: definições de permissões RBAC globais
ALTER TABLE "Permission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Permission" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permission_read" ON "Permission";
CREATE POLICY "Permission_read" ON "Permission"
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Permission_write" ON "Permission";
CREATE POLICY "Permission_write" ON "Permission"
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Grants
DO $$
DECLARE
  _role TEXT;
BEGIN
  FOR _role IN SELECT unnest(ARRAY['authenticated','service_role']) LOOP
    BEGIN
      EXECUTE 'GRANT SELECT ON "Plan", "Permission" TO ' || quote_ident(_role);
      EXECUTE 'GRANT INSERT, UPDATE, DELETE ON "Plan", "Permission" TO ' || quote_ident(_role);
    EXCEPTION WHEN undefined_object THEN NULL; END;
  END LOOP;
  IF to_regrole('revx_test') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "Plan", "Permission" TO revx_test';
  END IF;
END $$;
