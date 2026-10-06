-- Migration 012: WhatsApp CRM enhancement
-- Add wa_id, external_id to Contact
-- Add contact_id, external_id, direction, status to Message
-- These fields are required by whatsappProcessor.ts

BEGIN;

-- ============================================================
-- 1. Contact: add wa_id and external_id
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Contact'
      AND column_name = 'waId'
  ) THEN
    ALTER TABLE public."Contact" ADD COLUMN "waId" VARCHAR(50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Contact'
      AND column_name = 'externalId'
  ) THEN
    ALTER TABLE public."Contact" ADD COLUMN "externalId" VARCHAR(255);
  END IF;

  -- Make email nullable (WhatsApp contacts may not have email)
  ALTER TABLE public."Contact" ALTER COLUMN "email" DROP NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_contact_org_waid ON public."Contact"(organizationId, "waId");
END $$;

-- ============================================================
-- 2. Message: add contact_id, external_id, direction, status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Message'
      AND column_name = 'contactId'
  ) THEN
    ALTER TABLE public."Message" ADD COLUMN "contactId" UUID
      REFERENCES public."Contact"(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Message'
      AND column_name = 'externalId'
  ) THEN
    ALTER TABLE public."Message" ADD COLUMN "externalId" VARCHAR(255);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Message'
      AND column_name = 'direction'
  ) THEN
    ALTER TABLE public."Message" ADD COLUMN "direction" VARCHAR(20) NOT NULL DEFAULT 'inbound';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Message'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public."Message" ADD COLUMN "status" VARCHAR(50) NOT NULL DEFAULT 'received';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Message'
      AND column_name = 'updatedAt'
  ) THEN
    ALTER TABLE public."Message" ADD COLUMN "updatedAt" TIMESTAMP(6);
  END IF;

  CREATE INDEX IF NOT EXISTS idx_message_contact ON public."Message"(contactId);
  CREATE INDEX IF NOT EXISTS idx_message_external ON public."Message"(externalId);
END $$;

COMMIT;
