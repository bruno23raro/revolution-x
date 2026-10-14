-- ============================================================
-- 009 — B4 RLS CORRECTION: Session and BillingEvent
-- ============================================================
-- Problem (B4, identified in FINAL_FUNCTIONAL_VALIDATION Phase B):
--   Migration 007 created Session_tenant and BillingEvent_tenant with
--   a NULL-permissive predicate:
--
--     USING ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid
--            OR "organizationId" IS NULL)
--
--   The `OR "organizationId" IS NULL` clause makes ANY row whose
--   organizationId is NULL visible to EVERY tenant. That is a
--   cross-tenant data-leak vector:
--
--   * Session  — organizationId is nullable. A session created for a
--                global/system actor (org NULL) would be readable by all
--                tenants. Sessions belong to a USER, not an org.
--
--   * BillingEvent — organizationId is nullable (ON DELETE SET NULL in the
--                Prisma model). When an Organization is deleted its billing
--                events are orphaned to NULL and become visible to all tenants.
--
--   * Role — organizationId is nullable BY DESIGN: global system roles
--                (admin / member / viewer) carry a NULL organization. This
--                NULL-permissive visibility is intentional and is PRESERVED.
--
-- Fix:
--   * Session  -> re-scope to the authenticated USER (app.current_user_id).
--                A user can only read/write their own sessions. Fail-closed
--                when the user GUC is unset/empty (NULLIF -> NULL -> 0 rows).
--   * BillingEvent -> strict tenant scope (app.current_org). No NULL
--                exception: an org is only visible to that tenant; orphaned
--                (NULL) events are visible to nobody (fail-closed).
--   * Role -> unchanged (NULL-permissive, intentional).
--
-- Idempotency & safety:
--   * All policy drops are guarded (DROP POLICY IF EXISTS).
--   * Table existence guarded with to_regclass so the file is safe to run
--     against a partial schema (Prisma-migrated vs Supabase-migrated).
--   * FORCE ROW LEVEL SECURITY keeps the table owner subject to RLS.
--   * Grants are restricted to authenticated / service_role / revx_test.
--
-- This is a REVIEWABLE corrective migration. Do NOT apply it to production
-- without explicit authorization; apply to staging first and validate with
-- the B4 RLS test suite (src/tests/b4-rls.test.ts).
-- ============================================================

DO $$
BEGIN
  -- ----------------------------------------------------------
  -- SESSION: user-scoped (was tenant-scoped with NULL leak)
  -- ----------------------------------------------------------
  IF to_regclass('"Session"') IS NOT NULL THEN
    ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "Session" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Session_user"   ON "Session";
    DROP POLICY IF EXISTS "Session_tenant" ON "Session";

    CREATE POLICY "Session_user" ON "Session"
      FOR ALL
      USING ("userId" = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid)
      WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid);
  END IF;

  -- ----------------------------------------------------------
  -- BILLINGEVENT: strict tenant scope (was tenant + NULL leak)
  -- ----------------------------------------------------------
  IF to_regclass('"BillingEvent"') IS NOT NULL THEN
    ALTER TABLE "BillingEvent" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "BillingEvent" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "BillingEvent_tenant_strict" ON "BillingEvent";
    DROP POLICY IF EXISTS "BillingEvent_tenant"        ON "BillingEvent";

    CREATE POLICY "BillingEvent_tenant_strict" ON "BillingEvent"
      FOR ALL
      USING ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid)
      WITH CHECK ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid);
  END IF;

  -- ----------------------------------------------------------
  -- ROLE: intentionally NULL-permissive (global system roles)
  -- Re-asserted here for explicitness/idempotency; no semantic change.
  -- ----------------------------------------------------------
  IF to_regclass('"Role"') IS NOT NULL THEN
    ALTER TABLE "Role" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "Role" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Role_tenant" ON "Role";

    CREATE POLICY "Role_tenant" ON "Role"
      FOR ALL
      USING ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid
             OR "organizationId" IS NULL)
      WITH CHECK ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid
                  OR "organizationId" IS NULL);
  END IF;
END
$$;

-- ============================================================
-- Grants (restricted roles only)
-- ============================================================
DO $$
DECLARE
  _role TEXT;
BEGIN
  FOR _role IN SELECT unnest(ARRAY['authenticated','service_role']) LOOP
    BEGIN
      IF to_regclass('"Session"') IS NOT NULL THEN
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "Session" TO ' || quote_ident(_role);
      END IF;
      IF to_regclass('"BillingEvent"') IS NOT NULL THEN
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "BillingEvent" TO ' || quote_ident(_role);
      END IF;
      IF to_regclass('"Role"') IS NOT NULL THEN
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "Role" TO ' || quote_ident(_role);
      END IF;
    EXCEPTION WHEN undefined_object THEN
      NULL; -- role not present in this environment; skip
    END;
  END LOOP;

  -- Restricted RLS test role
  IF to_regclass('"Session"') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "Session" TO revx_test';
  END IF;
  IF to_regclass('"BillingEvent"') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "BillingEvent" TO revx_test';
  END IF;
  IF to_regclass('"Role"') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "Role" TO revx_test';
  END IF;
END
$$;
