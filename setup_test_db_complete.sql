-- ============================================================
-- setup_test_db_complete.sql — INIT SCRIPT FOR TEST CONTAINER
-- ============================================================
-- Runs automatically at container startup via /docker-entrypoint-initdb.d
-- Runs as POSTGRES_USER (revx) which is a superuser
-- ============================================================

-- 1) Restricted role for RLS tests (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'revx_test') THEN
    CREATE ROLE revx_test LOGIN NOSUPERUSER NOCREATEDB NOINHERIT;
  END IF;
  ALTER ROLE revx_test NOSUPERUSER NOBYPASSRLS;
END
$$;

GRANT USAGE ON SCHEMA public TO revx_test;

-- 2) Core tables from setup_test_db.sql
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

-- Upgrade pre-existing minimal tables
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "planId"    UUID;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "status"    VARCHAR(50) NOT NULL DEFAULT 'active';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(6) NOT NULL DEFAULT now();
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT now();
ALTER TABLE "Contact"      ADD COLUMN IF NOT EXISTS "phone"      VARCHAR(50);
ALTER TABLE "Contact"      ADD COLUMN IF NOT EXISTS "waId"       VARCHAR(50);
ALTER TABLE "Contact"      ADD COLUMN IF NOT EXISTS "externalId" VARCHAR(255);
ALTER TABLE "Contact"      ADD COLUMN IF NOT EXISTS "createdAt"  TIMESTAMP(6) NOT NULL DEFAULT now();

-- 3) RLS on Organization/Contact
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

GRANT SELECT, INSERT, UPDATE, DELETE ON "Organization", "Contact" TO revx_test;

-- 3) Migration 008: Token tables (User, PasswordResetToken, EmailVerificationToken)
CREATE TABLE IF NOT EXISTS "User" (
  "id"          UUID         PRIMARY KEY,
  "email"       VARCHAR(255) NOT NULL UNIQUE,
  "name"        VARCHAR(255),
  "password_hash" VARCHAR(255),
  "email_verified" BOOLEAN   NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(6) NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMP(6) NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
  "id"         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"     UUID         NOT NULL,
  "tokenHash"  VARCHAR(255) NOT NULL UNIQUE,
  "expiresAt"  TIMESTAMPTZ  NOT NULL,
  "usedAt"     TIMESTAMPTZ,
  "createdAt"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT "PasswordResetToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "EmailVerificationToken" (
  "id"         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"     UUID         NOT NULL,
  "tokenHash"  VARCHAR(255) NOT NULL UNIQUE,
  "expiresAt"  TIMESTAMPTZ  NOT NULL,
  "usedAt"     TIMESTAMPTZ,
  "createdAt"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT "EmailVerificationToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

-- RLS on token tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PasswordResetToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailVerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PasswordResetToken" FORCE ROW LEVEL SECURITY;
ALTER TABLE "EmailVerificationToken" FORCE ROW LEVEL SECURITY;

-- User policies
DROP POLICY IF EXISTS "User_self" ON "User";
CREATE POLICY "User_self" ON "User"
  FOR SELECT
  USING ("id" = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid);

DROP POLICY IF EXISTS "User_self_write" ON "User";
CREATE POLICY "User_self_write" ON "User"
  FOR ALL
  USING ("id" = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid)
  WITH CHECK ("id" = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid);

-- Token policies
DROP POLICY IF EXISTS "PasswordResetToken_user" ON "PasswordResetToken";
CREATE POLICY "PasswordResetToken_user" ON "PasswordResetToken"
  FOR ALL
  USING ("userId" = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid)
  WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid);

DROP POLICY IF EXISTS "EmailVerificationToken_user" ON "EmailVerificationToken";
CREATE POLICY "EmailVerificationToken_user" ON "EmailVerificationToken"
  FOR ALL
  USING ("userId" = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid)
  WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "User" TO revx_test;
GRANT SELECT, INSERT, UPDATE, DELETE ON "PasswordResetToken" TO revx_test;
GRANT SELECT, INSERT, UPDATE, DELETE ON "EmailVerificationToken" TO revx_test;

-- 4) Migration 014: Task queue tables
CREATE TABLE IF NOT EXISTS "Task" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
  "userId"         UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "title"          VARCHAR(300) NOT NULL,
  "status"         VARCHAR(30) NOT NULL DEFAULT 'queued',
  "progress"       INTEGER NOT NULL DEFAULT 0,
  "inputJson"      JSONB NOT NULL DEFAULT '{}',
  "resultJson"     JSONB,
  "errorText"      TEXT,
  "modelUsed"      VARCHAR(100),
  "usageJson"      JSONB,
  "waitingReason"  VARCHAR(300),
  "createdAt"      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "completedAt"    TIMESTAMPTZ(6)
);

CREATE INDEX IF NOT EXISTS "Task_org_status_idx" ON "Task" ("organizationId", "status");
CREATE INDEX IF NOT EXISTS "Task_user_idx" ON "Task" ("userId");

ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Task_tenant" ON "Task";
CREATE POLICY "Task_tenant" ON "Task"
  FOR ALL
  USING ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid);

CREATE TABLE IF NOT EXISTS "TaskStep" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "taskId"         UUID NOT NULL REFERENCES "Task"(id) ON DELETE CASCADE,
  "organizationId" UUID NOT NULL,
  "seq"            INTEGER NOT NULL,
  "name"           VARCHAR(200) NOT NULL,
  "status"         VARCHAR(30) NOT NULL DEFAULT 'pending',
  "detailJson"     JSONB,
  "startedAt"      TIMESTAMPTZ(6),
  "finishedAt"     TIMESTAMPTZ(6),
  "createdAt"      TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "TaskStep_task_seq_idx" ON "TaskStep" ("taskId", "seq");
CREATE INDEX IF NOT EXISTS "TaskStep_org_idx" ON "TaskStep" ("organizationId");

ALTER TABLE "TaskStep" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskStep" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "TaskStep_tenant" ON "TaskStep";
CREATE POLICY "TaskStep_tenant" ON "TaskStep"
  FOR ALL
  USING ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid);

CREATE TABLE IF NOT EXISTS "TaskEvent" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "taskId"         UUID NOT NULL REFERENCES "Task"(id) ON DELETE CASCADE,
  "organizationId" UUID NOT NULL,
  "type"           VARCHAR(60) NOT NULL,
  "payloadJson"    JSONB NOT NULL DEFAULT '{}',
  "createdAt"      TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "TaskEvent_task_idx" ON "TaskEvent" ("taskId");
CREATE INDEX IF NOT EXISTS "TaskEvent_org_idx" ON "TaskEvent" ("organizationId");

ALTER TABLE "TaskEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskEvent" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "TaskEvent_tenant" ON "TaskEvent";
CREATE POLICY "TaskEvent_tenant" ON "TaskEvent"
  FOR ALL
  USING ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid);

CREATE TABLE IF NOT EXISTS "AgentMemory" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
  "userId"         UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "kind"           VARCHAR(40) NOT NULL,
  "memoryKey"      VARCHAR(200) NOT NULL,
  "valueJson"      JSONB NOT NULL,
  "supersededAt"   TIMESTAMPTZ(6),
  "createdAt"      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "AgentMemory_org_user_kind_key_key"
    UNIQUE ("organizationId", "userId", "kind", "memoryKey")
);

CREATE INDEX IF NOT EXISTS "AgentMemory_org_user_idx" ON "AgentMemory" ("organizationId", "userId");

ALTER TABLE "AgentMemory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AgentMemory" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AgentMemory_user" ON "AgentMemory";
CREATE POLICY "AgentMemory_user" ON "AgentMemory"
  FOR ALL
  USING ("userId" = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid)
  WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid);

-- 5) Grants for revx_test
GRANT SELECT, INSERT, UPDATE, DELETE ON "Task", "TaskStep", "TaskEvent" TO revx_test;
GRANT SELECT, INSERT, UPDATE ON "AgentMemory" TO revx_test;
GRANT SELECT, INSERT, UPDATE, DELETE ON "User" TO revx_test;
GRANT SELECT, INSERT, UPDATE, DELETE ON "PasswordResetToken" TO revx_test;
GRANT SELECT, INSERT, UPDATE, DELETE ON "EmailVerificationToken" TO revx_test;
GRANT SELECT, INSERT, UPDATE, DELETE ON "Organization", "Contact" TO revx_test;

-- 6) Integration tables (if missing)
CREATE TABLE IF NOT EXISTS "integrations" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
  "provider"        TEXT NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'disconnected',
  "connection_mode" TEXT,
  "access_token"    TEXT,
  "refresh_token"   TEXT,
  "expires_at"      TIMESTAMPTZ,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "integration_events" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "integration_id" UUID NOT NULL REFERENCES "integrations"(id) ON DELETE CASCADE,
  "workspace_id"   UUID NOT NULL,
  "event_type"     TEXT NOT NULL,
  "payload"        JSONB NOT NULL DEFAULT '{}',
  "user_id"        UUID,
  "created_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "event_id"       UUID,
  "meta_event_id"  TEXT,
  "payload_hash"   TEXT,
  "processed_at"   TIMESTAMPTZ
);

ALTER TABLE "integrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integration_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integrations" FORCE ROW LEVEL SECURITY;
ALTER TABLE "integration_events" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "integration_events_tenant" ON "integration_events";
CREATE POLICY "integration_events_tenant" ON "integration_events"
  FOR ALL
  USING ("workspace_id" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("workspace_id" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "integrations", "integration_events" TO revx_test;