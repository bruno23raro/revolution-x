-- Migration 020 — Scrapers de risco (auditoria SSRF + compliance)
-- ============================================================
-- Tabelas: risk_logs, scraper_configs
-- RLS FORÇADO, fail-closed via GUC app.current_org (mesma convenção 005–017/019).
-- ============================================================

-- ----------------------------------------------------------
-- risk_logs
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "risk_logs" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"           UUID NOT NULL,
  "action"           TEXT NOT NULL,
  "platform"         TEXT NOT NULL CHECK ("platform" IN ('instagram', 'facebook', 'whatsapp', 'google')),
  "target"           TEXT NOT NULL,
  "riskLevel"        TEXT NOT NULL CHECK ("riskLevel" IN ('low', 'medium', 'high', 'critical')),
  "context"          JSONB NOT NULL DEFAULT '{}',
  "result"           TEXT NOT NULL CHECK ("result" IN ('success', 'failed', 'blocked')),
  "timestamp"        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "organizationId"   UUID NOT NULL
);

-- Índices para performance de queries de auditoria
CREATE INDEX IF NOT EXISTS idx_risklogs_org ON "risk_logs"("organizationId");
CREATE INDEX IF NOT EXISTS idx_risklogs_user ON "risk_logs"("userId");
CREATE INDEX IF NOT EXISTS idx_risklogs_platform ON "risk_logs"("platform");
CREATE INDEX IF NOT EXISTS idx_risklogs_risk ON "risk_logs"("riskLevel");
CREATE INDEX IF NOT EXISTS idx_risklogs_result ON "risk_logs"("result");

-- RLS — fail-closed por tenant (exige app.current_org definido)
ALTER TABLE "risk_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "risk_logs" FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS risk_logs_org ON "risk_logs";
CREATE POLICY risk_logs_org ON "risk_logs"
  FOR ALL
  USING ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid);

-- Grants restritos (sem BYPASSRLS)
DO $$
DECLARE
  _role TEXT;
  _tbl  TEXT;
BEGIN
  FOREACH _tbl IN ARRAY ARRAY['risk_logs'] LOOP
    FOREACH _role IN ARRAY ARRAY['authenticated','service_role'] LOOP
      BEGIN
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "' || _tbl || '" TO ' || quote_ident(_role);
      EXCEPTION WHEN undefined_object THEN
        NULL;
      END;
    END LOOP;
  END LOOP;
END
$$;

-- ----------------------------------------------------------
-- scraper_configs
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "scraper_configs" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId"   UUID NOT NULL,
  "platform"         TEXT NOT NULL CHECK ("platform" IN ('instagram', 'facebook', 'whatsapp', 'google')),
  "maxResults"       INTEGER,
  "rateLimitMs"      INTEGER,
  "proxyUrl"         TEXT,
  "timeoutMs"        INTEGER,
  "createdAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT uq_scraperconfig_org_platform UNIQUE ("organizationId", "platform")
);

CREATE INDEX IF NOT EXISTS idx_scraperconfigs_org ON "scraper_configs"("organizationId");
CREATE INDEX IF NOT EXISTS idx_scraperconfigs_platform ON "scraper_configs"("platform");

-- RLS — fail-closed por tenant
ALTER TABLE "scraper_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scraper_configs" FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scraperconfigs_org ON "scraper_configs";
CREATE POLICY scraperconfigs_org ON "scraper_configs"
  FOR ALL
  USING ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid);

DO $$
DECLARE
  _role TEXT;
  _tbl  TEXT;
BEGIN
  FOREACH _tbl IN ARRAY ARRAY['scraper_configs'] LOOP
    FOREACH _role IN ARRAY ARRAY['authenticated','service_role'] LOOP
      BEGIN
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "' || _tbl || '" TO ' || quote_ident(_role);
      EXCEPTION WHEN undefined_object THEN
        NULL;
      END;
    END LOOP;
  END LOOP;
END
$$;