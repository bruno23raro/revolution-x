-- ============================================================
-- 017 — CAMPANHAS E DISPARIOS + IMPORTAÇÃO CSV (FASE 17 / missão final)
-- ============================================================
-- Seções 8/9/10/11/12 da missão de finalização:
--   * Estende a tabela de contatos com os campos mapeáveis do CSV
--     (empresa, primeiro/último nome, origem, tags, campos
--     personalizados, preferências) + controle real de CONSENTIMENTO
--     marketing (LGPD): contato importado SEM consentimento comprovado
--     NÃO é elegível para disparo automático.
--   * Cria "Campaign" + "CampaignRecipient": área "Campanhas e
--     disparos" com fila persistente, idempotência
--     (unique campaignId+contactId), resultado POR DESTINATÁRIO e
--     máquina de estados (draft → … → completed/completed_partial/
--     failed/canceled; waiting_manual para o modo sem API).
--
-- DUAL-SCHEMA (regra §15: "Não presuma que os bancos são
-- intercambiáveis"): este arquivo é SHAPE-AWARE.
--   * Shape PascalCase (banco de aplicação local/Produção 006):
--     ALTER TABLE "Contact" (colunas camelCase com aspas).
--   * Shape snake_case (base dev 002a): ALTER TABLE contacts,
--     SOMENTE se existir — na base 002a a tabela de contatos não
--     existe; a ramada fica nula com segurança (NÃO cria tabela nova
--     em snake: o app Prisma roda no shape canônico).
--   * "Campaign"/"CampaignRecipient" são criados SEMPRE no shape
--     canônico PascalCase (mesma convenção da migration 014), porque
--     são consumidos pelo Prisma. Integridade referencial de
--     organizationId/contactId é garantida pela APLICAÇÃO
--     (withTenantContext + autorização server-side) e pelo RLS —
--     não há FK entre shapes, para não quebrar o shape snake.
--
-- Convenções (idênticas às migrations 005–016):
--   * Idempotente: ALTER … ADD COLUMN IF NOT EXISTS /
--     CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.
--   * RLS FORÇADO (FORCE) e fail-closed (tenant, GUC app.current_org;
--     NULLIF → NULL → 0 linhas quando o GUC não está definido).
--   * Grants restritos; nenhum BYPASSRLS.
--
-- ESCOPO DE APLICAÇÃO:
--   * LOCAL / STAGING (Docker `revolution-x-test-db`): aplicar com
--     segurança — DDL aditivo, reversível (017_rollback.sql).
--   * DEV Supabase: seguro (aditivo, sem perda de dados).
--   * PRODUÇÃO: PASSO HUMANO / NÃO APLICAR AUTOMATICAMENTE
--     (mesma porta das 015/016): inspecionar, backup recuperável,
--     janela de manutenção. Preserva dados existentes (só ADD
--     COLUMN com default e tabelas novas).
-- ============================================================

DO $$
BEGIN
  -- ----------------------------------------------------------
  -- Contatos: shape PascalCase (canônico Prisma / produção 006)
  -- ----------------------------------------------------------
  IF to_regclass('public."Contact"') IS NOT NULL THEN
    ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "firstName"       VARCHAR(255);
    ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "lastName"        VARCHAR(255);
    ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "company"         VARCHAR(255);
    ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "source"          VARCHAR(120);
    ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "tags"            JSONB NOT NULL DEFAULT '[]';
    ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "customFields"    JSONB NOT NULL DEFAULT '{}';
    ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "preferences"     JSONB NOT NULL DEFAULT '{}';
    ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "consentMarketing" BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "consentSource"   VARCHAR(200);
    ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "consentAt"       TIMESTAMPTZ(6);
    ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "optOut"          BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "updatedAt"       TIMESTAMPTZ(6) NOT NULL DEFAULT now();
    CREATE INDEX IF NOT EXISTS "Contact_org_email_idx" ON "Contact" ("organizationId", "email");
    CREATE INDEX IF NOT EXISTS "Contact_org_phone_idx" ON "Contact" ("organizationId", "phone");
    -- Colunas novas herdam o RLS FORCED da tabela (policia de tenant já
    -- cobre FOR ALL); WITH CHECK da política existente passa a incluir
    -- apenas o novo campo de tenant — nenhum campo novo expõe cross-tenant.
  END IF;

  -- ----------------------------------------------------------
  -- Contatos: shape snake_case (base dev 002a, se presente)
  -- ----------------------------------------------------------
  IF to_regclass('public.contacts') IS NOT NULL THEN
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS first_name      VARCHAR(255);
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_name       VARCHAR(255);
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company         VARCHAR(255);
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS source          VARCHAR(120);
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tags            JSONB NOT NULL DEFAULT '[]';
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS custom_fields   JSONB NOT NULL DEFAULT '{}';
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS preferences     JSONB NOT NULL DEFAULT '{}';
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS consent_marketing BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS consent_source  VARCHAR(200);
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS consent_at      TIMESTAMPTZ(6);
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS opt_out         BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ(6) NOT NULL DEFAULT now();
    CREATE INDEX IF NOT EXISTS "contacts_org_email_idx" ON contacts (organization_id, email);
    CREATE INDEX IF NOT EXISTS "contacts_org_phone_idx" ON contacts (organization_id, phone);
  END IF;
END
$$;

-- ============================================================
-- "Campaign" — raiz da área "Campanhas e disparos"
-- ============================================================
CREATE TABLE IF NOT EXISTS "Campaign" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "userId"       UUID NOT NULL,
  "title"        VARCHAR(300) NOT NULL,
  "channel"      VARCHAR(30) NOT NULL,
  "status"       VARCHAR(30) NOT NULL DEFAULT 'draft',
  "accountId"    VARCHAR(64),
  "message"      TEXT NOT NULL DEFAULT '',
  "variables"    JSONB NOT NULL DEFAULT '{}',
  "audienceJson" JSONB NOT NULL DEFAULT '{}',
  "batchJson"    JSONB NOT NULL DEFAULT '{}',
  "resultKind"   VARCHAR(20),
  "scheduledFor" TIMESTAMPTZ(6),
  "startedAt"    TIMESTAMPTZ(6),
  "completedAt"  TIMESTAMPTZ(6),
  "progress"     INTEGER NOT NULL DEFAULT 0,
  "totalCount"   INTEGER NOT NULL DEFAULT 0,
  "sentCount"    INTEGER NOT NULL DEFAULT 0,
  "failedCount"  INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "errorText"    TEXT,
  "manualNotes"  TEXT,
  "createdAt"    TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "Campaign_org_status_idx" ON "Campaign" ("organizationId", "status");
CREATE INDEX IF NOT EXISTS "Campaign_org_created_idx" ON "Campaign" ("organizationId", "createdAt");

ALTER TABLE "Campaign" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Campaign" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Campaign_tenant" ON "Campaign";
CREATE POLICY "Campaign_tenant" ON "Campaign"
  FOR ALL
  USING ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid);

-- ============================================================
-- "CampaignRecipient" — resultado POR DESTINATÁRIO (idempotência)
-- ============================================================
CREATE TABLE IF NOT EXISTS "CampaignRecipient" (
  "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "campaignId" UUID NOT NULL REFERENCES "Campaign"(id) ON DELETE CASCADE,
  "organizationId" UUID NOT NULL,
  "contactId" UUID NOT NULL,
  "status"    VARCHAR(20) NOT NULL DEFAULT 'pending',
  "attempts"  INTEGER NOT NULL DEFAULT 0,
  "externalMessageId" VARCHAR(200),
  "lastError" TEXT,
  "sentAt"    TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "CampaignRecipient_campaign_contact_key" UNIQUE ("campaignId", "contactId")
);

CREATE INDEX IF NOT EXISTS "CampaignRecipient_campaign_status_idx" ON "CampaignRecipient" ("campaignId", "status");
CREATE INDEX IF NOT EXISTS "CampaignRecipient_org_idx" ON "CampaignRecipient" ("organizationId");

ALTER TABLE "CampaignRecipient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CampaignRecipient" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "CampaignRecipient_tenant" ON "CampaignRecipient";
CREATE POLICY "CampaignRecipient_tenant" ON "CampaignRecipient"
  FOR ALL
  USING ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid);

-- ============================================================
-- Grants (restritos; idempotente; sem BYPASSRLS)
-- ============================================================
DO $$
DECLARE
  _role TEXT;
BEGIN
  FOR _role IN SELECT unnest(ARRAY['authenticated','service_role']) LOOP
    BEGIN
      EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "Campaign", "CampaignRecipient" TO ' || quote_ident(_role);
    EXCEPTION WHEN undefined_object THEN
      NULL; -- role ausente neste ambiente
    END;
  END LOOP;

  IF to_regrole('revx_test') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "Campaign", "CampaignRecipient" TO revx_test';
  END IF;
END
$$;
