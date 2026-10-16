-- ============================================================
-- 015 — WEBHOOK META: IDIEMPOTÊNCIA ATÔMICA (corretiva)
-- ============================================================
-- Correção do fluxo /api/webhooks/meta:
--
-- O claim de idempotência do webhook usa:
--   INSERT INTO webhook_events (...) ... ON CONFLICT (meta_event_id) DO NOTHING
--
-- `ON CONFLICT (meta_event_id)` exige uma constraint/index ÚNICO na
-- coluna `meta_event_id` isoladamente. A migration 005 criou apenas a
-- UNIQUE COMPOSTA (meta_event_id, integration_id) — que NÃO satisfaz o
-- ON CONFLICT → SQLSTATE 42703 em cada evento → transação volta → TODAS
-- as entregas Meta eram descartadas silenciosamente (webhook_events com
-- 0 linhas em produção confirma).
--
-- Esta migration adiciona o índice único que faltava:
--   * DDL puramente aditivo e idempotente (CREATE UNIQUE INDEX IF NOT EXISTS).
--   * Zero perda de dados (o índice não duplica nem apaga nada;
--     em produção a tabela tem 0 linhas → criação não conflita).
--   * `meta_event_id` é NOT NULL (005) → sem ambiguidade de UNIQUE em NULLs.
--   * IDs Meta (wamid, entry.id) são globalmente únicos — um índice único
--     simples é a chave de idempotência correta.
--
-- ROLLBACK (não destrutivo): DROP INDEX IF EXISTS uq_webhook_events_meta_event_id;
--
-- ESCOPO DE APLICAÇÃO:
--   * LOCAL / STAGING: seguro (tabela ausente → no-op via guard).
--   * PRODUÇÃO: aplicar antes (ou junto) do deploy que traz o código
--     do claim; verificação de destino e pré-requisitos registradas em
--     docs/EXECUTION_LOG.md / STAGING_ROLLOUT_PLAN.md.
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.webhook_events') IS NULL THEN
    RAISE NOTICE 'webhook_events ausente neste ambiente — nada a fazer (015 no-op)';
    RETURN;
  END IF;

  CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_events_meta_event_id
    ON public.webhook_events (meta_event_id);
END
$$;
