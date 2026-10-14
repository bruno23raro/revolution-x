-- ============================================================
-- 007 — RLS HARDENING (additive corrective migration)
-- ============================================================
-- Motivation:
--   006 created the tenant policies as `FOR ALL USING (...)` only:
--     * no explicit WITH CHECK (write path fell back to the USING expr),
--     * no fail-closed guard: `current_setting('app.current_org', TRUE)::uuid`
--       raises a cast error if the context is set to the empty string, and
--     * no FORCE ROW LEVEL SECURITY (table owners remain exempt).
--
-- This migration hardens every tenant-scoped policy to:
--     USING  (<key> = NULLIF(current_setting('app.current_org', TRUE), '')::uuid)
--     WITH CHECK (same expression)
--   where an absent/empty context yields NULL -> no rows (fail-closed), and
--   enables FORCE so even the table owner is subject to the policies.
--
-- It is intentionally idempotent (DROP POLICY IF EXISTS + CREATE) and guarded
-- with to_regclass so it runs safely even where some tenant tables are absent
-- (e.g. a partial test database). It does NOT rewrite 006.
--
-- Apply ONLY to environments you have validated. Never to production without
-- explicit authorization.
-- ============================================================

DO $$
DECLARE
  -- Tenant key column = "id"
  t TEXT;
  org_tables      TEXT[] := ARRAY['Organization'];
  orgid_tables    TEXT[] := ARRAY[
    'OrganizationMember','Contact','Lead','Deal','Pipeline','Product',
    'Media','Post','CalendarEvent','Video','Message','Report',
    'Subscription','Usage'
  ];
  orgid_nullable  TEXT[] := ARRAY['BillingEvent','Session','Role'];
BEGIN
  -- Organization: tenant key is "id"
  IF to_regclass('"Organization"') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "Organization" FORCE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Organization_tenant" ON "Organization"';
    EXECUTE 'CREATE POLICY "Organization_tenant" ON "Organization"
      FOR ALL
      USING ("id" = NULLIF(current_setting(''app.current_org'', TRUE), '')::uuid)
      WITH CHECK ("id" = NULLIF(current_setting(''app.current_org'', TRUE), '')::uuid)';
  END IF;

  -- Standard tenant tables: key = "organizationId" (NOT NULL in schema)
  FOR t IN SELECT unnest(orgid_tables) LOOP
    IF to_regclass(t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS %I_tenant ON %I', t, t);
      EXECUTE format(
        'CREATE POLICY %I_tenant ON %I
          FOR ALL
          USING ("organizationId" = NULLIF(current_setting(''app.current_org'', TRUE), '')::uuid)
          WITH CHECK ("organizationId" = NULLIF(current_setting(''app.current_org'', TRUE), '')::uuid)',
        t, t
      );
    END IF;
  END LOOP;

  -- Tables whose "organizationId" may be NULL (global-ish rows stay visible)
  FOR t IN SELECT unnest(orgid_nullable) LOOP
    IF to_regclass(t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS %I_tenant ON %I', t, t);
      EXECUTE format(
        'CREATE POLICY %I_tenant ON %I
          FOR ALL
          USING ("organizationId" = NULLIF(current_setting(''app.current_org'', TRUE), '')::uuid OR "organizationId" IS NULL)
          WITH CHECK ("organizationId" = NULLIF(current_setting(''app.current_org'', TRUE), '')::uuid OR "organizationId" IS NULL)',
        t, t
      );
    END IF;
  END LOOP;
END
$$;

-- ============================================================
-- 007b — Meta integrations & webhook events tenant policies
-- ============================================================
-- meta_integrations uses snake_case columns (legacy from 005).
-- webhook_events has NO organization_id column — it must be referenced
-- via integration_id → meta_integrations.organization_id.
--
-- Both tables have RLS ENABLED but lack hardened policies.
-- ============================================================

DO $$
BEGIN
  -- meta_integrations: hardened policy (snake_case column)
  IF to_regclass('meta_integrations') IS NOT NULL THEN
    ALTER TABLE meta_integrations FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS meta_integrations_tenant ON meta_integrations;
    CREATE POLICY meta_integrations_tenant ON meta_integrations
      FOR ALL
      USING (organization_id = NULLIF(current_setting('app.current_org', TRUE), '')::uuid)
      WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', TRUE), '')::uuid);
  END IF;

  -- webhook_events: policy via integration_id subquery
  -- The organization is resolved by joining through meta_integrations.
  -- Note: this requires meta_integrations_tenant to be active first.
  IF to_regclass('webhook_events') IS NOT NULL THEN
    ALTER TABLE webhook_events FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS webhook_events_tenant ON webhook_events;
    CREATE POLICY webhook_events_tenant ON webhook_events
      FOR ALL
      USING (
        integration_id IS NULL
        OR integration_id IN (
          SELECT mi.id FROM meta_integrations mi
          WHERE mi.organization_id = NULLIF(current_setting('app.current_org', TRUE), '')::uuid
        )
      )
      WITH CHECK (
        integration_id IS NULL
        OR integration_id IN (
          SELECT mi.id FROM meta_integrations mi
          WHERE mi.organization_id = NULLIF(current_setting('app.current_org', TRUE), '')::uuid
        )
      );
  END IF;
END
$$;

-- ============================================================
-- Grant the standard application roles the DML they need on the
-- tenant tables (idempotent; 006 already granted these, this is a
-- safety re-statement so the corrective path is self-sufficient).
-- Least privilege: no BYPASSRLS is granted anywhere in this migration.
-- ============================================================
DO $$
DECLARE
  t TEXT;
  grant_tables TEXT[] := ARRAY['Organization','Contact','meta_integrations','webhook_events'];
BEGIN
  FOR t IN SELECT unnest(grant_tables) LOOP
    IF to_regclass(t) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO authenticated, service_role', t);
    END IF;
  END LOOP;
END
$$;
