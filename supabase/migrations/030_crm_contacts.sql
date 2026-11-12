-- ============================================================
-- 030 — CRM CONTACTS (contatos sincronizados do OpenBSP)
-- ============================================================
-- Esta migration cria a tabela `crm_contacts` para armazenar
-- contatos recebidos via webhook do OpenBSP WhatsApp.
--
-- Estrutura:
--   - id: UUID primary key
--   - phone_number: WhatsApp ID (waId) - identificador único
--   - name: nome do contato (do perfil)
--   - email: email (opcional, do perfil)
--   - organization_id: tenant multi-tenant (FAIL-CLOSED RLS)
--   - external_id: ID do contato no OpenBSP (para sync)
--   - profile_picture_url: URL da foto do perfil
--   - metadata: dados brutos do OpenBSP
--   - last_synced_at: timestamp do último sync
--   - created_at/updated_at: timestamps
--
-- RLS (fail-closed): NULLIF -> NULL -> 0 linhas quando GUC nao definido
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_contacts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number       VARCHAR(64) NOT NULL,
  name               VARCHAR(255) NOT NULL DEFAULT '',
  email              VARCHAR(255),
  organization_id    UUID,
  external_id        VARCHAR(100),
  profile_picture_url VARCHAR,
  metadata           JSONB NOT NULL DEFAULT '{}',
  last_synced_at     TIMESTAMPTZ(6),
  created_at         TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_crm_contacts_org_external UNIQUE (organization_id, external_id)
);

-- Indices para consultas eficientes
CREATE INDEX IF NOT EXISTS crm_contacts_phone_idx ON crm_contacts (phone_number);
CREATE INDEX IF NOT EXISTS crm_contacts_org_idx ON crm_contacts (organization_id);
CREATE INDEX IF NOT EXISTS crm_contacts_org_phone_idx ON crm_contacts (organization_id, phone_number);
CREATE INDEX IF NOT EXISTS crm_contacts_external_idx ON crm_contacts (external_id);

-- Row Level Security
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contacts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_contacts_tenant ON crm_contacts;
CREATE POLICY crm_contacts_tenant ON crm_contacts
  FOR ALL
  USING (organization_id = NULLIF(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', TRUE), '')::uuid);

-- Triggers para atualizacao automatica
CREATE OR REPLACE FUNCTION crm_contacts_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON crm_contacts;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON crm_contacts
  FOR EACH ROW
  EXECUTE FUNCTION crm_contacts_set_updated_at();

-- ============================================================
-- Grants (restritos; sem BYPASSRLS)
-- ============================================================
DO $$
DECLARE
  _role TEXT;
BEGIN
  FOR _role IN SELECT unnest(ARRAY['authenticated', 'service_role']) LOOP
    BEGIN
      EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON crm_contacts TO ' || quote_ident(_role);
    EXCEPTION WHEN undefined_object THEN
      NULL;
    END;
  END LOOP;
END;
$$;