CREATE INDEX IF NOT EXISTS idx_growth_leads_funnel_status ON growth_leads ("organizationId", funnel_status);
CREATE INDEX IF NOT EXISTS idx_growth_leads_assigned_to ON growth_leads ("organizationId", assigned_to);
CREATE INDEX IF NOT EXISTS idx_growth_leads_last_contact ON growth_leads ("organizationId", last_contact_at);