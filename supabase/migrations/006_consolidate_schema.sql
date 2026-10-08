-- ============================================================
-- Migration 006 — Consolidation Schema (Fases 5I/5K)
-- ============================================================
-- Purpose: Versionar o estado consolidado do banco após a
--   remoção das tabelas snake_case residuais e correções
--   da Fase 5.
--
-- Regras:
--   - NÃO recria tabelas snake_case (organizations, plans, etc.)
--   - NÃO apaga dados existentes
--   - Totalmente idempotente: seguro rodar múltiplas vezes
--   - Preserva "Organization", "User", meta_integrations, webhook_events
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. ADD MISSING COLUMNS (safe, no-op if already present)
-- ============================================================

DO $$
BEGIN
  -- Deal: missing contactId (FASE 12 enhancement)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Deal' AND column_name='contactId') THEN
    ALTER TABLE "Deal" ADD COLUMN "contactId" UUID;
  END IF;

  -- Message: missing externalId, direction, status, updatedAt (FASE 12)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Message' AND column_name='externalId') THEN
    ALTER TABLE "Message" ADD COLUMN "externalId" VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Message' AND column_name='direction') THEN
    ALTER TABLE "Message" ADD COLUMN "direction" VARCHAR(20) NOT NULL DEFAULT 'inbound';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Message' AND column_name='status') THEN
    ALTER TABLE "Message" ADD COLUMN "status" VARCHAR(50) NOT NULL DEFAULT 'received';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Message' AND column_name='updatedAt') THEN
    ALTER TABLE "Message" ADD COLUMN "updatedAt" TIMESTAMP(6);
  END IF;

  -- Product: missing category (FASE 4)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Product' AND column_name='category') THEN
    ALTER TABLE "Product" ADD COLUMN "category" VARCHAR(100);
  END IF;

  -- Contact: missing waId, externalId (FASE 12)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Contact' AND column_name='waId') THEN
    ALTER TABLE "Contact" ADD COLUMN "waId" VARCHAR(50);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Contact' AND column_name='externalId') THEN
    ALTER TABLE "Contact" ADD COLUMN "externalId" VARCHAR(255);
  END IF;
END $$;

-- ============================================================
-- 2. ADD MISSING UNIQUE CONSTRAINTS
-- ============================================================

DO $$
BEGIN
  -- Product.sku unique
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_sku_key') THEN
    ALTER TABLE "Product" ADD CONSTRAINT "Product_sku_key" UNIQUE (sku);
  END IF;

  -- Role.organizationId + name unique
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Role_organizationId_name_key') THEN
    ALTER TABLE "Role" ADD CONSTRAINT "Role_organizationId_name_key" UNIQUE (organizationId, name);
  END IF;
END $$;

-- ============================================================
-- 3. ADD MISSING FOREIGN KEYS
-- ============================================================

DO $$
BEGIN
  -- Deal.contactId FK
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Deal_contactId_fkey') THEN
    ALTER TABLE "Deal" ADD CONSTRAINT "Deal_contactId_fkey"
      FOREIGN KEY ("contactId") REFERENCES "Contact"(id) ON DELETE SET NULL;
  END IF;

  -- OrganizationMember
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrganizationMember_organizationId_fkey') THEN
    ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrganizationMember_userId_fkey') THEN
    ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE;
  END IF;

  -- Role
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Role_organizationId_fkey') THEN
    ALTER TABLE "Role" ADD CONSTRAINT "Role_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE;
  END IF;

  -- Session
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Session_userId_fkey') THEN
    ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Session_organizationId_fkey') THEN
    ALTER TABLE "Session" ADD CONSTRAINT "Session_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE;
  END IF;

  -- PasswordResetToken
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PasswordResetToken_userId_fkey') THEN
    ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE;
  END IF;

  -- EmailVerificationToken
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmailVerificationToken_userId_fkey') THEN
    ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE;
  END IF;

  -- Subscription
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Subscription_organizationId_fkey') THEN
    ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Subscription_planId_fkey') THEN
    ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey"
      FOREIGN KEY ("planId") REFERENCES "Plan"(id) ON DELETE SET NULL;
  END IF;

  -- Usage
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Usage_organizationId_fkey') THEN
    ALTER TABLE "Usage" ADD CONSTRAINT "Usage_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE;
  END IF;

  -- BillingEvent
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BillingEvent_organizationId_fkey') THEN
    ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE SET NULL;
  END IF;

  -- Contact
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Contact_organizationId_fkey') THEN
    ALTER TABLE "Contact" ADD CONSTRAINT "Contact_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE;
  END IF;

  -- Lead
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Lead_organizationId_fkey') THEN
    ALTER TABLE "Lead" ADD CONSTRAINT "Lead_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Lead_contactId_fkey') THEN
    ALTER TABLE "Lead" ADD CONSTRAINT "Lead_contactId_fkey"
      FOREIGN KEY ("contactId") REFERENCES "Contact"(id) ON DELETE SET NULL;
  END IF;

  -- Deal
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Deal_organizationId_fkey') THEN
    ALTER TABLE "Deal" ADD CONSTRAINT "Deal_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Deal_leadId_fkey') THEN
    ALTER TABLE "Deal" ADD CONSTRAINT "Deal_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES "Lead"(id) ON DELETE SET NULL;
  END IF;

  -- Pipeline
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Pipeline_organizationId_fkey') THEN
    ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE;
  END IF;

  -- Product
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_organizationId_fkey') THEN
    ALTER TABLE "Product" ADD CONSTRAINT "Product_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE;
  END IF;

  -- Media
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Media_organizationId_fkey') THEN
    ALTER TABLE "Media" ADD CONSTRAINT "Media_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE;
  END IF;

  -- Post
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Post_organizationId_fkey') THEN
    ALTER TABLE "Post" ADD CONSTRAINT "Post_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE;
  END IF;

  -- CalendarEvent
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarEvent_organizationId_fkey') THEN
    ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE;
  END IF;

  -- Video
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Video_organizationId_fkey') THEN
    ALTER TABLE "Video" ADD CONSTRAINT "Video_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE;
  END IF;

  -- Message
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Message_organizationId_fkey') THEN
    ALTER TABLE "Message" ADD CONSTRAINT "Message_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Message_contactId_fkey') THEN
    ALTER TABLE "Message" ADD CONSTRAINT "Message_contactId_fkey"
      FOREIGN KEY ("contactId") REFERENCES "Contact"(id) ON DELETE SET NULL;
  END IF;

  -- Report
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Report_organizationId_fkey') THEN
    ALTER TABLE "Report" ADD CONSTRAINT "Report_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE;
  END IF;

  -- Organization.planId FK
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Organization_planId_fkey') THEN
    ALTER TABLE "Organization" ADD CONSTRAINT "Organization_planId_fkey"
      FOREIGN KEY ("planId") REFERENCES "Plan"(id) ON DELETE SET NULL;
  END IF;

  -- meta_integrations FK
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'meta_integrations_organization_id_fkey') THEN
    ALTER TABLE meta_integrations ADD CONSTRAINT "meta_integrations_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "Organization"(id) ON DELETE CASCADE;
  END IF;

  -- webhook_events FK
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webhook_events_integration_id_fkey') THEN
    ALTER TABLE webhook_events ADD CONSTRAINT "webhook_events_integration_id_fkey"
      FOREIGN KEY ("integration_id") REFERENCES meta_integrations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 4. CREATE MISSING INDICES
-- ============================================================

DO $$
BEGIN
  -- Contact: organizationId + waId composite index
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Contact_organizationId_waId_idx') THEN
    CREATE INDEX "Contact_organizationId_waId_idx" ON "Contact"("organizationId", "waId");
  END IF;

  -- Message: contactId, externalId indexes
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Message_contactId_idx') THEN
    CREATE INDEX "Message_contactId_idx" ON "Message"("contactId");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Message_externalId_idx') THEN
    CREATE INDEX "Message_externalId_idx" ON "Message"("externalId");
  END IF;
END $$;

-- ============================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================

DO $$
BEGIN
  -- Habilitar RLS em todas as tabelas canônicas
  EXECUTE 'ALTER TABLE "Plan"               ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "User"               ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "Organization"       ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "OrganizationMember" ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "Role"               ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "Permission"         ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "Session"            ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "PasswordResetToken" ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "EmailVerificationToken" ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "Subscription"       ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "Usage"              ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "BillingEvent"       ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "Contact"            ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "Lead"               ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "Deal"               ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "Pipeline"           ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "Product"            ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "Media"              ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "Post"               ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "CalendarEvent"      ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "Video"              ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "Message"            ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "Report"             ENABLE ROW LEVEL SECURITY';

  -- Helper function para criar política condicional
  -- Organization
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = '"Organization"'::regclass AND polname = 'Organization_tenant') THEN
    EXECUTE 'CREATE POLICY "Organization_tenant" ON "Organization"
      FOR ALL USING ("id" = current_setting(''app.current_org'', TRUE)::UUID)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = '"OrganizationMember"'::regclass AND polname = 'OrganizationMember_tenant') THEN
    EXECUTE 'CREATE POLICY "OrganizationMember_tenant" ON "OrganizationMember"
      FOR ALL USING ("organizationId" = current_setting(''app.current_org'', TRUE)::UUID)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = '"Contact"'::regclass AND polname = 'Contact_tenant') THEN
    EXECUTE 'CREATE POLICY "Contact_tenant" ON "Contact"
      FOR ALL USING ("organizationId" = current_setting(''app.current_org'', TRUE)::UUID)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = '"Lead"'::regclass AND polname = 'Lead_tenant') THEN
    EXECUTE 'CREATE POLICY "Lead_tenant" ON "Lead"
      FOR ALL USING ("organizationId" = current_setting(''app.current_org'', TRUE)::UUID)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = '"Deal"'::regclass AND polname = 'Deal_tenant') THEN
    EXECUTE 'CREATE POLICY "Deal_tenant" ON "Deal"
      FOR ALL USING ("organizationId" = current_setting(''app.current_org'', TRUE)::UUID)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = '"Pipeline"'::regclass AND polname = 'Pipeline_tenant') THEN
    EXECUTE 'CREATE POLICY "Pipeline_tenant" ON "Pipeline"
      FOR ALL USING ("organizationId" = current_setting(''app.current_org'', TRUE)::UUID)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = '"Product"'::regclass AND polname = 'Product_tenant') THEN
    EXECUTE 'CREATE POLICY "Product_tenant" ON "Product"
      FOR ALL USING ("organizationId" = current_setting(''app.current_org'', TRUE)::UUID)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = '"Media"'::regclass AND polname = 'Media_tenant') THEN
    EXECUTE 'CREATE POLICY "Media_tenant" ON "Media"
      FOR ALL USING ("organizationId" = current_setting(''app.current_org'', TRUE)::UUID)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = '"Post"'::regclass AND polname = 'Post_tenant') THEN
    EXECUTE 'CREATE POLICY "Post_tenant" ON "Post"
      FOR ALL USING ("organizationId" = current_setting(''app.current_org'', TRUE)::UUID)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = '"CalendarEvent"'::regclass AND polname = 'CalendarEvent_tenant') THEN
    EXECUTE 'CREATE POLICY "CalendarEvent_tenant" ON "CalendarEvent"
      FOR ALL USING ("organizationId" = current_setting(''app.current_org'', TRUE)::UUID)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = '"Video"'::regclass AND polname = 'Video_tenant') THEN
    EXECUTE 'CREATE POLICY "Video_tenant" ON "Video"
      FOR ALL USING ("organizationId" = current_setting(''app.current_org'', TRUE)::UUID)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = '"Message"'::regclass AND polname = 'Message_tenant') THEN
    EXECUTE 'CREATE POLICY "Message_tenant" ON "Message"
      FOR ALL USING ("organizationId" = current_setting(''app.current_org'', TRUE)::UUID)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = '"Report"'::regclass AND polname = 'Report_tenant') THEN
    EXECUTE 'CREATE POLICY "Report_tenant" ON "Report"
      FOR ALL USING ("organizationId" = current_setting(''app.current_org'', TRUE)::UUID)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = '"Subscription"'::regclass AND polname = 'Subscription_tenant') THEN
    EXECUTE 'CREATE POLICY "Subscription_tenant" ON "Subscription"
      FOR ALL USING ("organizationId" = current_setting(''app.current_org'', TRUE)::UUID)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = '"Usage"'::regclass AND polname = 'Usage_tenant') THEN
    EXECUTE 'CREATE POLICY "Usage_tenant" ON "Usage"
      FOR ALL USING ("organizationId" = current_setting(''app.current_org'', TRUE)::UUID)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = '"BillingEvent"'::regclass AND polname = 'BillingEvent_tenant') THEN
    EXECUTE 'CREATE POLICY "BillingEvent_tenant" ON "BillingEvent"
      FOR ALL USING ("organizationId" = current_setting(''app.current_org'', TRUE)::UUID OR "organizationId" IS NULL)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = '"Session"'::regclass AND polname = 'Session_tenant') THEN
    EXECUTE 'CREATE POLICY "Session_tenant" ON "Session"
      FOR ALL USING ("organizationId" = current_setting(''app.current_org'', TRUE)::UUID OR "organizationId" IS NULL)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = '"Role"'::regclass AND polname = 'Role_tenant') THEN
    EXECUTE 'CREATE POLICY "Role_tenant" ON "Role"
      FOR ALL USING ("organizationId" = current_setting(''app.current_org'', TRUE)::UUID OR "organizationId" IS NULL)';
  END IF;

  -- Tabelas globais (sem isolation por tenant)
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = '"Plan"'::regclass AND polname = 'Plan_tenant') THEN
    EXECUTE 'CREATE POLICY "Plan_tenant" ON "Plan" FOR ALL USING (true)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = '"Permission"'::regclass AND polname = 'Permission_tenant') THEN
    EXECUTE 'CREATE POLICY "Permission_tenant" ON "Permission" FOR ALL USING (true)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = '"PasswordResetToken"'::regclass AND polname = 'PasswordResetToken_tenant') THEN
    EXECUTE 'CREATE POLICY "PasswordResetToken_tenant" ON "PasswordResetToken" FOR ALL USING (true)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = '"EmailVerificationToken"'::regclass AND polname = 'EmailVerificationToken_tenant') THEN
    EXECUTE 'CREATE POLICY "EmailVerificationToken_tenant" ON "EmailVerificationToken" FOR ALL USING (true)';
  END IF;

  -- RLS e políticas de meta_integrations já criadas na migration 005
  EXECUTE 'ALTER TABLE meta_integrations ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY';
END $$;

-- ============================================================
-- 6. GRANTS
-- ============================================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- ============================================================
-- FIM DA MIGRAÇÃO 006
-- ============================================================
