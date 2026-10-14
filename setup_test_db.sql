-- ============================================================
-- setup_test_db.sql — LOCAL, IDEMPOTENT, NON-DESTRUCTIVE RLS scaffold
-- ============================================================
-- Run ONLY against the isolated local test database
-- (localhost:5432/revolution_x_rls_test), NEVER against production.
-- Run as the ADMIN role (postgres/BYPASSRLS) via scripts/apply-rls-setup.mjs.
--
-- What it does:
--   * Ensures "Organization"/"Contact" exist with the FULL Prisma column set
--     (creates them if absent; only adds missing columns if they exist).
--   * Enables + FORCES Row Level Security on both.
--   * Installs hardened fail-closed tenant policies (USING + WITH CHECK,
--     guarded with NULLIF so an absent/empty context yields no access).
--   * Creates the restricted role revx_test (NOSUPERUSER NOBYPASSRLS) and
--     grants it least-privilege DML. revx_test is NOT the owner of these
--     tables, so it is subject to RLS (FORCE makes the owner subject too).
--
-- It does NOT drop tables or delete rows: re-running is safe.
-- ============================================================

-- 1) Restricted role. No superuser, no BYPASSRLS, no table ownership.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'revx_test') THEN
    CREATE ROLE revx_test LOGIN NOSUPERUSER NOCREATEDB NOINHERIT;
  END IF;
  -- Idempotent re-assertion that the role can never bypass RLS.
  ALTER ROLE revx_test NOSUPERUSER NOBYPASSRLS;
END
$$;

GRANT USAGE ON SCHEMA public TO revx_test;

-- 2) Tables aligned to the Prisma schema (full column set).
CREATE TABLE IF NOT EXISTS "Organization" (
  "id"        UUID         PRIMARY KEY,
  "name"      VARCHAR(255) NOT NULL,
  "slug"      VARCHAR(100) NOT NULL,
  "planId"    UUID,
  "status"    VARCHAR(50)  NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT now(),
  CONSTRAINT "Organization_slug_key" UNIQUE ("slug")
);

CREATE TABLE IF NOT EXISTS "Contact" (
  "id"             UUID         PRIMARY KEY,
  "organizationId" UUID         NOT NULL,
  "name"           VARCHAR(255) NOT NULL,
  "email"          VARCHAR(255),
  "phone"          VARCHAR(50),
  "waId"           VARCHAR(50),
  "externalId"     VARCHAR(255),
  "createdAt"      TIMESTAMP(6) NOT NULL DEFAULT now(),
  CONSTRAINT "Contact_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
);

-- Upgrade pre-existing minimal tables in place (no data loss).
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "planId"    UUID;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "status"    VARCHAR(50) NOT NULL DEFAULT 'active';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(6) NOT NULL DEFAULT now();
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT now();
ALTER TABLE "Contact"      ADD COLUMN IF NOT EXISTS "phone"      VARCHAR(50);
ALTER TABLE "Contact"      ADD COLUMN IF NOT EXISTS "waId"       VARCHAR(50);
ALTER TABLE "Contact"      ADD COLUMN IF NOT EXISTS "externalId" VARCHAR(255);
ALTER TABLE "Contact"      ADD COLUMN IF NOT EXISTS "createdAt"  TIMESTAMP(6) NOT NULL DEFAULT now();

-- 3) RLS: enable + force, then hardened fail-closed policies.
ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Contact"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Organization" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Contact"      FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organization_tenant" ON "Organization";
CREATE POLICY "Organization_tenant" ON "Organization"
  FOR ALL
  USING ("id" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("id" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid);

DROP POLICY IF EXISTS "Contact_tenant" ON "Contact";
CREATE POLICY "Contact_tenant" ON "Contact"
  FOR ALL
  USING ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid);

-- 4) Least-privilege DML for the restricted assertion role.
--    Grants table-level access; RLS still restricts it to its own tenant.
GRANT SELECT, INSERT, UPDATE, DELETE ON "Organization", "Contact" TO revx_test;
