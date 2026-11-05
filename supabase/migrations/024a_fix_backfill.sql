-- Migration 024a: Fix 024 backfill issues
-- 1. Add connected_at and disconnected_at columns to integrations (needed for backfill from meta_integrations)
-- 2. Fix MIN(id) cast issue in backfill
-- 3. Skip meta_integrations backfill since table is empty and has wrong schema (PascalCase, missing provider column)

-- 1. Add connected_at and disconnected_at columns
ALTER TABLE integrations
  ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disconnected_at TIMESTAMPTZ;

COMMENT ON COLUMN integrations.connected_at IS 'Timestamp when integration was connected';
COMMENT ON COLUMN integrations.disconnected_at IS 'Timestamp when integration was disconnected';

-- 2. Fix ARCHIVE query: MIN(id) on uuid needs workaround
-- Use MIN with ORDER BY and LIMIT instead
UPDATE integrations SET
  status = 'archived',
  status_reason = 'consolidado_em_openbsp',
  deleted_at = NOW()
WHERE channel = 'whatsapp'
  AND connection_mode = 'official'
  AND provider = 'openbsp'
  AND id NOT IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id, external_account_id ORDER BY id) as rn
      FROM integrations
      WHERE channel = 'whatsapp' AND connection_mode = 'official'
    ) t WHERE rn = 1
  );

-- 3. Skip meta_integrations backfill - table is empty and has wrong schema (PascalCase columns)
-- The proper meta_integrations table should be created by migration 005 with correct columns
-- When migration 005 is properly applied, a separate backfill can be done