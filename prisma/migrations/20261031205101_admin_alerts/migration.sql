-- Migration 022 — AdminAlert ("AdminAlert", convenção camelCase cotado, como 014)
-- ============================================================
-- Cria tabela "AdminAlert" para alertas de sistema/admin.
-- Referenciada por: /api/admin/alerts (POST/GET), WF-02, WF-04, WF-05
-- Idempotente: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.
-- ============================================================

BEGIN;

  CREATE TABLE IF NOT EXISTS "AdminAlert" (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organizationId" UUID REFERENCES "Organization"(id) ON DELETE SET NULL,
    "userId"         UUID REFERENCES "User"(id) ON DELETE SET NULL,
    "type"           VARCHAR(50)  NOT NULL,
    "severity"       VARCHAR(20)  NOT NULL DEFAULT 'warning',
    "title"          VARCHAR(255) NOT NULL,
    "message"        TEXT         NOT NULL,
    "statusCode"     INTEGER,
    "route"          VARCHAR(255),
    "metadata"       JSONB        NOT NULL DEFAULT '{}'::jsonb,
    "timestamp"      TIMESTAMPTZ  NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS "AdminAlert_org_idx"      ON "AdminAlert" ("organizationId");
  CREATE INDEX IF NOT EXISTS "AdminAlert_timestamp_idx" ON "AdminAlert" ("timestamp");
  CREATE INDEX IF NOT EXISTS "AdminAlert_severity_idx" ON "AdminAlert" ("severity");

  ALTER TABLE "AdminAlert" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "AdminAlert" FORCE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "AdminAlert_tenant" ON "AdminAlert";
  CREATE POLICY "AdminAlert_tenant" ON "AdminAlert"
    USING (
      "organizationId" IS NULL
      OR "organizationId" = current_setting('app.current_org_id', true)::uuid
    );

  COMMENT ON TABLE "AdminAlert" IS 'Alertas de sistema/admin via /api/admin/alerts (n8n WF-02/04/05)';
  COMMENT ON COLUMN "AdminAlert"."severity" IS 'warning | critical';
  COMMENT ON COLUMN "AdminAlert"."type" IS 'schema_drift, 5xx_error, integration_status, etc';

COMMIT;