-- ============================================================
-- 031 — Inbound Messages (table for OpenBSP message storage)
-- ============================================================
-- Cria as tabelas necessárias para armazenar mensagens recebidas
-- via webhook do OpenBSP WhatsApp. Estas tabelas são usadas pelo
-- webhook em app/api/webhooks/openbsp/shared.ts
--
-- Estrutura:
--   - inbound_messages: mensagens recebidas
--   - message_status: status de entrega das mensagens
--
-- RLS (fail-closed): NULLIF -> NULL -> 0 linhas quando GUC nao definido
-- ============================================================

-- ----------------------------------------------------------
-- inbound_messages
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS inbound_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      TEXT NOT NULL UNIQUE,
  from_number     TEXT NOT NULL,
  to_number       TEXT,
  type            TEXT NOT NULL DEFAULT 'unknown',
  payload         JSONB NOT NULL DEFAULT '{}',
  received_at     TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  organization_id UUID,
  processed       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

-- Índices para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_inbound_messages_from_number ON inbound_messages (from_number);
CREATE INDEX IF NOT EXISTS idx_inbound_messages_organization ON inbound_messages (organization_id);
CREATE INDEX IF NOT EXISTS idx_inbound_messages_received_at ON inbound_messages (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbound_messages_message_id ON inbound_messages (message_id);

-- Row Level Security
ALTER TABLE inbound_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_messages FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inbound_messages_tenant ON inbound_messages;
CREATE POLICY inbound_messages_tenant ON inbound_messages
  FOR ALL
  USING (organization_id = NULLIF(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', TRUE), '')::uuid);

-- ----------------------------------------------------------
-- message_status
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_status (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'unknown',
  timestamp       TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  error_code      TEXT,
  error_message   TEXT,
  payload         JSONB NOT NULL DEFAULT '{}',
  organization_id UUID,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

-- Índices para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_message_status_message_id ON message_status (message_id);
CREATE INDEX IF NOT EXISTS idx_message_status_status ON message_status (status);
CREATE INDEX IF NOT EXISTS idx_message_status_organization ON message_status (organization_id);

-- Row Level Security
ALTER TABLE message_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_status FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS message_status_tenant ON message_status;
CREATE POLICY message_status_tenant ON message_status
  FOR ALL
  USING (organization_id = NULLIF(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', TRUE), '')::uuid);

-- ============================================================
-- Grants (restritos; sem BYPASSRLS)
-- ============================================================
DO $$
DECLARE
  _role TEXT;
BEGIN
  FOR _role IN SELECT unnest(ARRAY['authenticated', 'service_role']) LOOP
    BEGIN
      EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON inbound_messages TO ' || quote_ident(_role);
      EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON message_status TO ' || quote_ident(_role);
    EXCEPTION WHEN undefined_object THEN
      NULL;
    END;
  END LOOP;
END
$$;