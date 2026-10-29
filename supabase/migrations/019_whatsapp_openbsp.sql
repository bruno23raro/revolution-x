-- Migration 019 — WhatsApp oficial via OpenBSP (canal por tenant + templates)
-- ============================================================
-- Aditiva: nenhuma tabela existente é alterada. Campanhas e destinatários
-- reutilizam Campaign/CampaignRecipient (017) com channel='whatsapp_api';
-- idempotência de inbound reutiliza webhook_events (015).
--
--  whatsapp_channels  : 1 canal OpenBSP/conectado por organização
--                       (waba_id, phone_number_id, token AES-GCM da casa)
--  whatsapp_templates : espelho local dos message_templates do Meta
--                       (status PENDING/APPROVED/REJECTED via poll)
--
-- Convenções (mesmas de 014/017): colunas PascalCase sem @@map, RLS FORÇADO
-- fail-closed via GUC app.current_org, grants restritos, idempotente.
-- ============================================================

-- ----------------------------------------------------------
-- whatsapp_channels
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "whatsapp_channels" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- FK omitida de propósito: convenção da 014/017 (drift dual-schema PascalCase
  -- vs snake_case no DEV; isção é garantida por RLS, não por FK)
  "organizationId"   UUID NOT NULL,
  -- 'openbsp' agora; 'meta_direct' quando o App Review aprovar (factory env)
  "provider"         TEXT NOT NULL DEFAULT 'openbsp' CHECK ("provider" IN ('openbsp','meta_direct')),
  "status"           TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','CONNECTED','DISCONNECTED','ERROR')),
  -- onboarding
  "onboardingTokenId" TEXT,
  "callbackUrl"      TEXT,
  "verifyToken"      TEXT NOT NULL,           -- único por tenant (correlação do webhook)
  -- credenciais do plano OpenBSP (organizations_addresses.extra)
  "wabaId"           TEXT,
  "phoneNumberId"    TEXT,                    -- = organizations_addresses.address
  "phoneNumber"      TEXT,
  "verifiedName"     TEXT,
  "accessTokenEnc"   TEXT,                    -- AES-GCM (token-encryption da casa); nunca expor
  "tierLimitPer24h"  INTEGER NOT NULL DEFAULT 250,  -- messaging_limit_tier starter
  "sentWindow24h"    INTEGER NOT NULL DEFAULT 0,
  "windowStartedAt"  TIMESTAMPTZ,
  "lastError"        TEXT,
  "createdAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT uq_whatsapp_channels_org UNIQUE ("organizationId")
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_channels_phone
  ON "whatsapp_channels"("phoneNumberId") WHERE "phoneNumberId" IS NOT NULL;

-- ----------------------------------------------------------
-- whatsapp_templates
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "whatsapp_templates" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId"  UUID NOT NULL,
  "metaTemplateId"  TEXT,
  "name"            TEXT NOT NULL,
  "language"        TEXT NOT NULL DEFAULT 'pt_BR',
  "category"        TEXT NOT NULL CHECK ("category" IN ('MARKETING','UTILITY','AUTHENTICATION')),
  "status"          TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','APPROVED','REJECTED','PAUSED','DISABLED')),
  "componentsJson"  JSONB NOT NULL DEFAULT '[]',
  "rejectionReason" TEXT,
  "lastCheckedAt"   TIMESTAMPTZ,
  "createdAt"       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt"       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT uq_whatsapp_templates_org_name_lang UNIQUE ("organizationId","name","language")
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_status
  ON "whatsapp_templates"("organizationId","status");

-- ----------------------------------------------------------
-- RLS — FORÇADO, fail-closed (tenant)
-- ----------------------------------------------------------
ALTER TABLE "whatsapp_channels"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "whatsapp_channels"  FORCE  ROW LEVEL SECURITY;
ALTER TABLE "whatsapp_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "whatsapp_templates" FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_channels_org ON "whatsapp_channels";
CREATE POLICY whatsapp_channels_org ON "whatsapp_channels"
  FOR ALL
  USING ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid);

DROP POLICY IF EXISTS whatsapp_templates_org ON "whatsapp_templates";
CREATE POLICY whatsapp_templates_org ON "whatsapp_templates"
  FOR ALL
  USING ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid);

-- ----------------------------------------------------------
-- Comments
-- ----------------------------------------------------------
COMMENT ON TABLE "whatsapp_channels" IS 'Canal WhatsApp oficial por tenant (OpenBSP agora, meta_direct depois); tokens criptografados na aplicação';
COMMENT ON COLUMN "whatsapp_channels"."verifyToken" IS 'Segredo por tenant: correlaciona callbacks Meta/OpenBSP ao tenant; nunca exposto na UI';
COMMENT ON COLUMN "whatsapp_channels"."accessTokenEnc" IS 'access_token do WABA via OpenBSP, AES-GCM (lib/token-encryption)';

-- ----------------------------------------------------------
-- Grants (restritos; idempotente; sem BYPASSRLS)
-- ----------------------------------------------------------
DO $$
DECLARE
  _role TEXT;
  _tbl  TEXT;
BEGIN
  FOREACH _tbl IN ARRAY ARRAY['whatsapp_channels','whatsapp_templates'] LOOP
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
