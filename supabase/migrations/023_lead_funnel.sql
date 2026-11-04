-- Migration 023 — Growth Lead Funnel & Analytics
-- ============================================================
-- Adds funnel status tracking and analytics fields to growth_leads,
-- creates analytics helper function, and updates RLS policies.
-- ============================================================

BEGIN;

-- ----------------------------------------------------------
-- Add new columns to growth_leads for funnel tracking
-- ----------------------------------------------------------
ALTER TABLE "growth_leads"
  ADD COLUMN IF NOT EXISTS "funnelStatus" TEXT NOT NULL DEFAULT 'pending'
    CHECK ("funnelStatus" IN ('pending', 'first_contact', 'interested', 'scheduled', 'customer')),
  ADD COLUMN IF NOT EXISTS "lastContactAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "responseCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "costPerLead" NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "assignedTo" UUID REFERENCES "User"(id);

-- Add indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_growth_leads_funnel_status
  ON "growth_leads"("organizationId", "funnelStatus");

CREATE INDEX IF NOT EXISTS idx_growth_leads_assigned_to
  ON "growth_leads"("organizationId", "assignedTo");

CREATE INDEX IF NOT EXISTS idx_growth_leads_last_contact
  ON "growth_leads"("organizationId", "lastContactAt");

-- ----------------------------------------------------------
-- Analytics view (PostgREST-compatible function)
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION get_growth_analytics(org_id UUID, start_date TIMESTAMPTZ, end_date TIMESTAMPTZ)
RETURNS TABLE (
  total_leads BIGINT,
  leads_by_status JSONB,
  messages_sent BIGINT,
  messages_received BIGINT,
  conversion_rate NUMERIC(5, 2),
  cost_per_lead NUMERIC(10, 2),
  avg_response_time INTERVAL
) AS $$
BEGIN
  RETURN QUERY
  WITH lead_stats AS (
    SELECT
      COUNT(*) as total,
      jsonb_object_agg(
        "funnelStatus",
        COUNT(*)
      ) as by_status
    FROM "growth_leads"
    WHERE "organizationId" = org_id
      AND "createdAt" BETWEEN start_date AND end_date
  ),
  message_stats AS (
    SELECT
      COUNT(CASE WHEN "direction" = 'outbound' THEN 1 END) as sent,
      COUNT(CASE WHEN "direction" = 'inbound' THEN 1 END) as received,
      AVG(
        CASE WHEN "direction" = 'inbound' THEN
          ("updatedAt" - "createdAt")
        END
      ) as avg_response
    FROM "messages" m
    JOIN "growth_leads" gl ON gl."contact" = m."toContact"
    WHERE gl."organizationId" = org_id
      AND m."createdAt" BETWEEN start_date AND end_date
  ),
  cost_stats AS (
    SELECT AVG("costPerLead") as avg_cost
    FROM "growth_leads"
    WHERE "organizationId" = org_id
      AND "costPerLead" IS NOT NULL
  )
  SELECT
    COALESCE(ls.total, 0),
    COALESCE(ls.by_status, '{"pending": 0}'),
    COALESCE(ms.sent, 0),
    COALESCE(ms.received, 0),
    CASE WHEN ls.total > 0 THEN
      ROUND(
        (COALESCE(ms.received, 0)::numeric / NULLIF(ls.total, 0)) * 100,
        2
      )
    ELSE 0 END,
    COALESCE(cs.avg_cost, 0),
    ms.avg_response
  FROM lead_stats ls
  CROSS JOIN message_stats ms
  LEFT JOIN cost_stats cs ON true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_growth_analytics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ----------------------------------------------------------
-- Update RLS policies
-- ----------------------------------------------------------
ALTER TABLE "growth_leads" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "growth_leads_org" ON "growth_leads";
CREATE POLICY "growth_leads_org" ON "growth_leads"
  FOR ALL
  USING ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid);

-- ----------------------------------------------------------
-- Comments
-- ----------------------------------------------------------
COMMENT ON COLUMN "growth_leads"."funnelStatus" IS 'Status no funil de vendas: pending → first_contact → interested → scheduled → customer';
COMMENT ON COLUMN "growth_leads"."lastContactAt" IS 'Data do último contato com o lead';
COMMENT ON COLUMN "growth_leads"."responseCount" IS 'Quantidade de respostas recebidas do lead';
COMMENT ON COLUMN "growth_leads"."costPerLead" IS 'Custo estimado por lead (em reais)';
COMMENT ON COLUMN "growth_leads"."notes" IS 'Notas sobre o lead';
COMMENT ON COLUMN "growth_leads"."assignedTo" IS 'Usuário responsável pelo lead';

COMMIT;
