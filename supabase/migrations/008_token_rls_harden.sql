-- ============================================================
-- 008 — TOKEN TABLES + USER TABLE: USER-SCOPED RLS HARDENING
-- ============================================================
-- Motivation:
 -- 006 created policies for PasswordResetToken and EmailVerificationToken
 -- as `FOR ALL USING (true)`, which allows ANY authenticated user to read
 -- and modify ALL tokens in the system — a cross-tenant (cross-user) leak.
 --
 -- These tables are scoped by "userId" (FK → "User"(id)), NOT by
 -- organizationId, because they belong to an individual account, not a
 -- tenant. The policy must therefore isolate by the requesting user, not
 -- by the requesting organization.
 --
 -- Correct policy (fail-closed when app.current_user_id is absent):
 --   USING  ("userId" = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid)
 --   WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid)
 --
 -- The application must set app.current_user_id before querying these
 -- tables. See src/lib/prisma.ts:withUserContextOn().
 --
 -- Additionally, the "User" table (PascalCase canonical) has RLS ENABLED
 -- but NO policies and NO FORCE — any query against it via a restricted
 -- role would fail. We add a self-read policy so that authenticated users
 -- can fetch their own row (used by auth.ts:getAuthenticatedUser and the
 -- meta-callback route for membership lookup). The policy uses the same
 -- app.current_user_id GUC pattern and also grants SELECT to revx_test
 -- so the test suite can verify the policy works correctly.
 --
 -- This migration is idempotent (DROP POLICY IF EXISTS + CREATE) and guarded
 -- with to_regclass so it runs safely even if the tables are absent.
 -- It does NOT rewrite 006.
-- ============================================================

DO $$
BEGIN
  -- User table: self-read policy (fail-closed when context is absent)
  IF to_regclass('"User"') IS NOT NULL THEN
    ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "User_self" ON "User";
    CREATE POLICY "User_self" ON "User"
      FOR SELECT
      USING ("id" = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid);
    -- Allow INSERT/UPDATE for self-registration and profile updates
    DROP POLICY IF EXISTS "User_self_write" ON "User";
    CREATE POLICY "User_self_write" ON "User"
      FOR ALL
      USING ("id" = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid)
      WITH CHECK ("id" = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid);
  END IF;

  -- PasswordResetToken: user-scoped policy
  IF to_regclass('"PasswordResetToken"') IS NOT NULL THEN
    ALTER TABLE "PasswordResetToken" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "PasswordResetToken_tenant" ON "PasswordResetToken";
    CREATE POLICY "PasswordResetToken_tenant" ON "PasswordResetToken"
      FOR ALL
      USING  ("userId" = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid)
      WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid);
  END IF;

  -- EmailVerificationToken: user-scoped policy
  IF to_regclass('"EmailVerificationToken"') IS NOT NULL THEN
    ALTER TABLE "EmailVerificationToken" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "EmailVerificationToken_tenant" ON "EmailVerificationToken";
    CREATE POLICY "EmailVerificationToken_tenant" ON "EmailVerificationToken"
      FOR ALL
      USING  ("userId" = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid)
      WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid);
  END IF;
END
$$;

-- ============================================================
-- Grants for the new hardened policies (idempotent re-statement).
-- ============================================================
DO $$
DECLARE
  _role TEXT;
BEGIN
  -- Grant to standard Supabase roles (may not exist in bare PostgreSQL)
  FOR _role IN SELECT unnest(ARRAY['authenticated','service_role']) LOOP
    BEGIN
      IF to_regclass('"PasswordResetToken"') IS NOT NULL THEN
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "PasswordResetToken" TO ' || quote_ident(_role);
      END IF;
      IF to_regclass('"EmailVerificationToken"') IS NOT NULL THEN
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "EmailVerificationToken" TO ' || quote_ident(_role);
      END IF;
      IF to_regclass('"User"') IS NOT NULL THEN
        EXECUTE 'GRANT SELECT ON "User" TO ' || quote_ident(_role);
      END IF;
    EXCEPTION WHEN undefined_object THEN NULL;
    END;
  END LOOP;
  -- Always grant to revx_test for local test validation
  IF to_regclass('"PasswordResetToken"') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "PasswordResetToken" TO revx_test';
  END IF;
  IF to_regclass('"EmailVerificationToken"') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "EmailVerificationToken" TO revx_test';
  END IF;
  IF to_regclass('"User"') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON "User" TO revx_test';
  END IF;
END
$$;
