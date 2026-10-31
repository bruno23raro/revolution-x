-- Migration 021 — Integrações MANUAL (sem API) + separação por modo
-- ============================================================
-- A tabela `integrations` (018) já é multi-conta por usuário
-- (UNIQUE user_id/channel/meta_account_id). Esta migração apenas:
--   * adiciona `mode` ('OFFICIAL' | 'MANUAL') — OAuth existente vira OFFICIAL
--     via DEFAULT; conexões manuais (cookie/sessão/senha) gravam MANUAL.
--   * índice por usuário+modo para o filtro da UI ("API Oficial | Sem API").
-- RLS/concessões da 018 permanecem — nenhuma alteração aqui.
-- Idempotente (mesmas convenções 005–020).
-- ============================================================

ALTER TABLE integrations
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'OFFICIAL';

DO $$
BEGIN
  ALTER TABLE integrations
    ADD CONSTRAINT integrations_mode_check CHECK (mode IN ('OFFICIAL', 'MANUAL'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE INDEX IF NOT EXISTS idx_integrations_user_mode
  ON integrations(user_id, mode);

COMMENT ON COLUMN integrations.mode IS
  'OFFICIAL = credencial via OAuth da plataforma; MANUAL = sessão/cookie salvo pelo usuário (sem API). access_token guarda o payload da sessão cifrado (AES-256-GCM).';
