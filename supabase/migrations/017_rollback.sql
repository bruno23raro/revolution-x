-- ============================================================
-- 017 ROLLBACK — remove apenas o que a 017 criou (forma reversa).
--
-- AVISO DE DADOS: se campanhas/contatos já foram usados, este
-- rollback APAGA dados dos clientes (colunas de consentimento,
-- campanhas e resultados por destinatário). Em produção, só
-- execute após backup recuperável e autorização explícita.
-- Idempotente: DROP … IF EXISTS em todos os objetos.
-- ============================================================

-- Tabela de resultados (dependente) primeiro, depois a raiz.
DROP TABLE IF EXISTS "CampaignRecipient";
DROP TABLE IF EXISTS "Campaign";

DO $$
BEGIN
  IF to_regclass('public."Contact"') IS NOT NULL THEN
    DROP INDEX IF EXISTS "Contact_org_email_idx";
    DROP INDEX IF EXISTS "Contact_org_phone_idx";
    ALTER TABLE "Contact" DROP COLUMN IF EXISTS "firstName";
    ALTER TABLE "Contact" DROP COLUMN IF EXISTS "lastName";
    ALTER TABLE "Contact" DROP COLUMN IF EXISTS "company";
    ALTER TABLE "Contact" DROP COLUMN IF EXISTS "source";
    ALTER TABLE "Contact" DROP COLUMN IF EXISTS "tags";
    ALTER TABLE "Contact" DROP COLUMN IF EXISTS "customFields";
    ALTER TABLE "Contact" DROP COLUMN IF EXISTS "preferences";
    ALTER TABLE "Contact" DROP COLUMN IF EXISTS "consentMarketing";
    ALTER TABLE "Contact" DROP COLUMN IF EXISTS "consentSource";
    ALTER TABLE "Contact" DROP COLUMN IF EXISTS "consentAt";
    ALTER TABLE "Contact" DROP COLUMN IF EXISTS "optOut";
    ALTER TABLE "Contact" DROP COLUMN IF EXISTS "updatedAt";
  END IF;

  IF to_regclass('public.contacts') IS NOT NULL THEN
    DROP INDEX IF EXISTS "contacts_org_email_idx";
    DROP INDEX IF EXISTS "contacts_org_phone_idx";
    ALTER TABLE contacts DROP COLUMN IF EXISTS first_name;
    ALTER TABLE contacts DROP COLUMN IF EXISTS last_name;
    ALTER TABLE contacts DROP COLUMN IF EXISTS company;
    ALTER TABLE contacts DROP COLUMN IF EXISTS source;
    ALTER TABLE contacts DROP COLUMN IF EXISTS tags;
    ALTER TABLE contacts DROP COLUMN IF EXISTS custom_fields;
    ALTER TABLE contacts DROP COLUMN IF EXISTS preferences;
    ALTER TABLE contacts DROP COLUMN IF EXISTS consent_marketing;
    ALTER TABLE contacts DROP COLUMN IF EXISTS consent_source;
    ALTER TABLE contacts DROP COLUMN IF EXISTS consent_at;
    ALTER TABLE contacts DROP COLUMN IF EXISTS opt_out;
    ALTER TABLE contacts DROP COLUMN IF EXISTS updated_at;
  END IF;
END
$$;
