-- Migration 005: Meta integrations table
-- Executar manualmente após META_TOKEN_ENCRYPTION_KEY configurado

CREATE TABLE IF NOT EXISTS meta_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('facebook', 'instagram', 'whatsapp')),
  meta_page_id TEXT,
  instagram_account_id TEXT,
  whatsapp_business_account_id TEXT,
  phone_number_id TEXT,
  meta_app_id TEXT,
  encrypted_access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disconnected_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'AUTHENTICATED', 'CONNECTED', 'DISCONNECTED', 'ERROR', 'EXPIRED', 'REVOKED', 'PENDING_WHATSAPP')),
  last_error TEXT,
  webhook_secret TEXT,
  UNIQUE(organization_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_meta_integrations_org ON meta_integrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_meta_integrations_status ON meta_integrations(status);
CREATE INDEX IF NOT EXISTS idx_meta_integrations_expires ON meta_integrations(token_expires_at) WHERE token_expires_at IS NOT NULL;

ALTER TABLE meta_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY meta_integrations_tenant ON meta_integrations
  FOR ALL USING (organization_id = current_setting('app.current_org', TRUE)::UUID);

COMMENT ON TABLE meta_integrations IS 'Meta integrations per tenant, tokens encrypted with AES-256-GCM';
COMMENT ON COLUMN meta_integrations.encrypted_access_token IS 'AES-256-GCM ciphertext';
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_event_id TEXT NOT NULL,
  integration_id UUID REFERENCES meta_integrations(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(meta_event_id, integration_id)
);
CREATE INDEX IF NOT EXISTS idx_webhook_events_meta ON webhook_events(meta_event_id);
