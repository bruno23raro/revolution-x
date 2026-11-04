-- Migration 020 — Growth Tools (WhatsApp Non-Official + Instagram/Facebook Leads)
-- ============================================================
-- Novas tabelas para suportar a "Área Growth" (Evolution API + scraping)
--
-- Convenções (mesmas de 019): colunas PascalCase sem @@map, RLS FORÇADO
-- idempotente. nova convenção: organizationId FK opcional via RLS, não FK hard.
-- ============================================================

-- ----------------------------------------------------------
-- whatsapp_instances: Sessões da Evolution API por tenant
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "whatsapp_instances" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "instanceName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DISCONNECTED' CHECK ("status" IN ('DISCONNECTED','CONNECTED','ERROR')),
  "qrCode" TEXT, -- base64 QR code image (temporary, expires quickly)
  "accessToken" TEXT, -- token da Evolution API (não cifrado aqui; app responsibility)
  "lastHeartbeat" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT uq_whatsapp_instances_org_name UNIQUE ("organizationId","instanceName")
);

-- Index para busca por organization + status
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_org_status
  ON "whatsapp_instances"("organizationId","status");

-- ----------------------------------------------------------
-- growth_leads: Contatos extraídos do Instagram/Facebook
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "growth_leads" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'instagram' CHECK ("source" IN ('instagram','facebook')),
  "contact" TEXT NOT NULL, -- telefone em formato E.164 (ex: 5511987654321)
  "metadata" JSONB DEFAULT '{}', -- filtros: cidade, gênero, perfil, etc.
  "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending','sent','failed')),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT uq_growth_leads_org_contact UNIQUE ("organizationId","contact")
);

-- Index para busca por organization + status + source
CREATE INDEX IF NOT EXISTS idx_growth_leads_org_status_source
  ON "growth_leads"("organizationId","status","source");

-- ----------------------------------------------------------
-- RLS — FORÇADO, fail-closed (tenant)
-- ----------------------------------------------------------
ALTER TABLE "whatsapp_instances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "whatsapp_instances" FORCE ROW LEVEL SECURITY;

ALTER TABLE "growth_leads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "growth_leads" FORCE ROW LEVEL SECURITY;

-- Policy por organizationId (mesmo padrão 019)
DROP POLICY IF EXISTS whatsapp_instances_org ON "whatsapp_instances";
CREATE POLICY whatsapp_instances_org ON "whatsapp_instances"
  FOR ALL
  USING ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid);

DROP POLICY IF EXISTS growth_leads_org ON "growth_leads";
CREATE POLICY growth_leads_org ON "growth_leads"
  FOR ALL
  USING ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid);

-- ----------------------------------------------------------
-- Comments
-- ----------------------------------------------------------
COMMENT ON TABLE "whatsapp_instances" IS 'Sessões da Evolution API (não-oficial) por tenant; QR code temporário, token de conexão';
COMMENT ON COLUMN "whatsapp_instances"."instanceName" IS 'Nome da instância no painel Evolution API';
COMMENT ON COLUMN "whatsapp_instances"."qrCode" IS 'Base64 image do QR code para conexão via WhatsApp';
COMMENT ON COLUMN "whatsapp_instances"."accessToken" IS 'Token da Evolution API (gerenciado pelo app; não exposto na UI)';
COMMENT ON TABLE "growth_leads" IS 'Contatos extraídos do Instagram/Facebook antes do disparo em massa';
COMMENT ON COLUMN "growth_leads"."source" IS 'Origem dos leads: instagram ou facebook';
COMMENT ON COLUMN "growth_leads"."contact" IS 'Número de WhatsApp em formato E.164 (ex: 5511987654321)';
COMMENT ON COLUMN "growth_leads"."metadata" IS 'Metadados adicionais (cidade, gênero, perfil alvo, etc.) em JSONB';
COMMENT ON COLUMN "growth_leads"."status" IS 'Status do lead: pending (aguardando envio), sent (enviado), failed (erro)';

-- ----------------------------------------------------------
-- Grants (restritos; idempotente)
-- ----------------------------------------------------------
DO $$
DECLARE
  _role TEXT;
  _tbl  TEXT;
BEGIN
  FOREACH _tbl IN ARRAY ARRAY['whatsapp_instances','growth_leads'] LOOP
    FOREACH _role IN ARRAY ARRAY['authenticated','service_role'] LOOP
      BEGIN
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "' || _tbl || '" TO ' || quote_ident(_role);
      EXCEPTION WHEN undefined_object THEN
        NULL;
      END;
    END LOOP;
    IF to_regrole('revx_test') IS NOT NULL THEN
      EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "' || _tbl || '" TO revx_test';
    END IF;
  END LOOP;
END
$$;