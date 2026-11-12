-- Migration 026: Add unique index on openbsp_event_id (wamid) for OpenBSP webhook idempotency
-- ============================================================================
-- Contexto:
--   app/api/integrations/openbsp/incoming/route.ts usa ON CONFLICT (openbsp_event_id)
--   para garantir idempotência dos eventos recebidos do OpenBSP.
--
--   A coluna openbsp_event_id foi adicionada na migration 025_schema_parity.sql
--   (no ambiente prod via 025), mas o índice único para ON CONFLICT não existia
--   no ambiente local.
--
-- Escopo:
--   • LOCAL (supabase-docker): aplicar após migration 025
--   • PRODUÇÃO (ardpabjoepzhkpmkgwgu): já possui o índice via 025
--
-- Idempotente: CREATE UNIQUE INDEX IF NOT EXISTS
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.webhook_events') IS NULL THEN
    RAISE NOTICE 'webhook_events ausente neste ambiente — nada a fazer (026 no-op)';
    RETURN;
  END IF;
END
$$;

-- Índice único para openbsp_event_id (usado no route.ts para ON CONFLICT)
CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_events_openbsp_event_id
  ON public.webhook_events (openbsp_event_id)
  WHERE openbsp_event_id IS NOT NULL;

-- Comentário
COMMENT ON INDEX uq_webhook_events_openbsp_event_id IS 'Índice único para idempotência de webhooks OpenBSP (wamid)';

-- ============================================================================
-- ROLLBACK (manual)
-- ============================================================================
-- DROP INDEX IF EXISTS uq_webhook_events_openbsp_event_id;
-- DROP COLUMN IF EXISTS openbsp_event_id FROM public.webhook_events;