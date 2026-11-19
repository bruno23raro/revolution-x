-- Migration 032: Corrigir integrations para usar organizationId + app.current_org
-- ============================================================
-- PROBLEMA: tabela integrations (snake_case) usa user_id referenciando auth.users
-- mas o resto do app usa organizationId + app.current_org para isolamento multi-tenant.
-- CORREÇÃO: adicionar organizationId, backfill via OrganizationMember, nova policy.
-- ============================================================

-- 1. Adicionar organizationId (nullable durante backfill, NOT NULL depois)
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS "organizationId" UUID;

-- 2. Backfill: para cada integração, buscar a organizationId do usuário via OrganizationMember
-- Assumindo 1 membership ativo por usuário (papel owner/admin/member)
UPDATE integrations i
SET "organizationId" = om."organizationId"
FROM "OrganizationMember" om
WHERE i.user_id = om."userId"
  AND i."organizationId" IS NULL
  AND om."organizationId" IS NOT NULL;

-- 3. Para integrações sem membership (usuários órfãos), arquivar
UPDATE integrations
SET status = 'archived',
    status_reason = 'usuario_sem_organizacao',
    deleted_at = NOW()
WHERE "organizationId" IS NULL;

-- 4. Tornar NOT NULL e adicionar FK (opcional: RLS já isola)
ALTER TABLE integrations ALTER COLUMN "organizationId" SET NOT NULL;

-- 5. Índice para lookup por tenant
CREATE INDEX IF NOT EXISTS idx_integrations_org_id ON integrations("organizationId");
CREATE INDEX IF NOT EXISTS idx_integrations_org_channel ON integrations("organizationId", channel);

-- 6. Substituir policy: de user_id (app.current_user_id) para organizationId (app.current_org)
DROP POLICY IF EXISTS integrations_user ON integrations;
CREATE POLICY integrations_tenant ON integrations
  FOR ALL
  USING ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid);

-- 7. Policy service_role bypass (mantém operações admin)
DROP POLICY IF EXISTS integrations_service_role ON integrations;
CREATE POLICY integrations_service_role ON integrations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 8. Comment
COMMENT ON COLUMN integrations."organizationId" IS 'Tenant da integração (backfill de OrganizationMember.userId). RLS via app.current_org.';
