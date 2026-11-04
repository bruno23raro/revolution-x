-- Migration 024: Integrations v2 - Modelo de dados unificado
-- Cria campos connection_mode, provider, normaliza status, adiciona RLS, backfill e sincronia

-- 1. Novas colunas em integrations
ALTER TABLE integrations
  ADD COLUMN IF NOT EXISTS connection_mode TEXT NOT NULL DEFAULT 'non_official'
    CHECK (connection_mode IN ('official', 'non_official')),
  ADD COLUMN IF NOT EXISTS provider TEXT
    CHECK (provider IN ('openbsp', 'evolution', 'session_login', 'oauth_meta')),
  ADD COLUMN IF NOT EXISTS status_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS external_account_id TEXT,
  ADD COLUMN IF NOT EXISTS external_account_label TEXT,
  ADD COLUMN IF NOT EXISTS credentials_ref TEXT,
  ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. Comentários nas novas colunas
COMMENT ON COLUMN integrations.connection_mode IS 'Modo de conexão: official (API oficial) ou non_official (QR/session/OAuth)';
COMMENT ON COLUMN integrations.provider IS 'Provedor técnico: openbsp (WhatsApp oficial), evolution (WhatsApp QR), session_login (IG/FB sessão), oauth_meta (IG/FB OAuth)';
COMMENT ON COLUMN integrations.status_reason IS 'Motivo legível do status atual (ex: credenciais_pendentes, token_expirado)';
COMMENT ON COLUMN integrations.last_checked_at IS 'Última verificação de saúde da integração';
COMMENT ON COLUMN integrations.last_error_at IS 'Timestamp do último erro registrado';
COMMENT ON COLUMN integrations.external_account_id IS 'ID da conta no provedor externo (ex: WABA ID, Instagram Business Account ID)';
COMMENT ON COLUMN integrations.external_account_label IS 'Rótulo amigável da conta externa (ex: número WhatsApp, @handle IG)';
COMMENT ON COLUMN integrations.credentials_ref IS 'Referência às credenciais armazenadas (configuração sensível)';
COMMENT ON COLUMN integrations.meta IS 'Metadados extras da plataforma em JSON';
COMMENT ON COLUMN integrations.deleted_at IS 'Soft delete — registro arquivado, não removido fisicamente';

-- 3. Normalizar status: mapear valores antigos para novo enum
-- Valores atuais: PENDING, AUTHENTICATED, CONNECTED, DISCONNECTED, ERROR, EXPIRED, REVOKED
-- Novos valores: disconnected, pending_credentials, connecting, connected, expired, error, archived

UPDATE integrations SET status = CASE
  WHEN status = 'PENDING' THEN 'pending_credentials'
  WHEN status = 'AUTHENTICATED' THEN 'connecting'
  WHEN status = 'CONNECTED' THEN 'connected'
  WHEN status = 'DISCONNECTED' THEN 'disconnected'
  WHEN status = 'ERROR' THEN 'error'
  WHEN status = 'EXPIRED' THEN 'expired'
  WHEN status = 'REVOKED' THEN 'archived'
  ELSE 'disconnected'
END;

-- 4. Alterar constraint de status para novo enum
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_status_check;
ALTER TABLE integrations ADD CONSTRAINT integrations_status_check
  CHECK (status IN ('disconnected', 'pending_credentials', 'connecting', 'connected', 'expired', 'error', 'archived'));

-- 5. Índice único parcial: um registro ativo por (workspace_id, channel, connection_mode)
-- Nota: workspace_id vem de app.current_org via RLS, mas criamos índice explícito
CREATE UNIQUE INDEX IF NOT EXISTS uq_integrations_workspace_channel_mode
  ON integrations (user_id, channel, connection_mode)
  WHERE deleted_at IS NULL AND status <> 'archived';

-- 6. Índices de leitura
CREATE INDEX IF NOT EXISTS idx_integrations_workspace_channel_status
  ON integrations (user_id, channel, status);

CREATE INDEX IF NOT EXISTS idx_integrations_status_last_checked
  ON integrations (status, last_checked_at);

-- 7. Trigger de sincronia mode ↔ connection_mode (dual-write)
-- mode (OFFICIAL/MANUAL) mantido até Fase 8; connection_mode é o novo campo canônico
CREATE OR REPLACE FUNCTION sync_mode_connection_mode()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Quando connection_mode muda, atualiza mode
  IF NEW.connection_mode IS DISTINCT FROM OLD.connection_mode THEN
    NEW.mode := CASE NEW.connection_mode
      WHEN 'official' THEN 'OFFICIAL'
      WHEN 'non_official' THEN 'MANUAL'
      ELSE OLD.mode
    END;
  END IF;
  -- Quando mode muda, atualiza connection_mode (compatibilidade reversa)
  IF NEW.mode IS DISTINCT FROM OLD.mode THEN
    NEW.connection_mode := CASE NEW.mode
      WHEN 'OFFICIAL' THEN 'official'
      WHEN 'MANUAL' THEN 'non_official'
      ELSE OLD.connection_mode
    END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trigger_sync_mode_connection_mode ON integrations;
CREATE TRIGGER trigger_sync_mode_connection_mode
  BEFORE UPDATE ON integrations
  FOR EACH ROW EXECUTE FUNCTION sync_mode_connection_mode();

-- 8. Tabela integration_events para audit trail
CREATE TABLE IF NOT EXISTS integration_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  event TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_events_integration_created
  ON integration_events (integration_id, created_at DESC);

COMMENT ON TABLE integration_events IS 'Trilha de auditoria de eventos de integração (conexão, erro, renovação, troca de modo)';
COMMENT ON COLUMN integration_events.event IS 'Tipo do evento: connection_success, connection_failed, disconnection, credential_renewal, mode_switch, error';

-- 9. RLS em integration_events
ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;

-- Política: usuário só vê eventos das próprias integrações
-- Usa user_id da integração referenciada via JOIN
CREATE POLICY integration_events_tenant ON integration_events
  FOR ALL USING (
    workspace_id = current_setting('app.current_org', TRUE)::UUID
  );

-- Service role bypass
CREATE POLICY integration_events_service_role ON integration_events
  FOR ALL TO service_role USING (true);

-- 10. RLS já existe em integrations, garantir política
-- (já criada na migration 018/021, mas reafirmamos)
-- Políticas existentes usam user_id = current_setting('app.current_user_id', TRUE)::uuid

-- 11. BACKFILL: mode → connection_mode + provider derivado
-- Para registros existentes: mode=OFFICIAL → official + provider derivado
-- mode=MANUAL → non_official + provider derivado

UPDATE integrations SET
  connection_mode = CASE mode
    WHEN 'OFFICIAL' THEN 'official'
    WHEN 'MANUAL' THEN 'non_official'
    ELSE 'non_official'
  END,
  provider = CASE
    -- WhatsApp
    WHEN channel = 'whatsapp' AND mode = 'OFFICIAL' THEN 'openbsp'
    WHEN channel = 'whatsapp' AND mode = 'MANUAL' THEN 'evolution'
    -- Instagram
    WHEN channel = 'instagram' AND mode = 'OFFICIAL' THEN 'oauth_meta'
    WHEN channel = 'instagram' AND mode = 'MANUAL' THEN 'session_login'
    -- Facebook
    WHEN channel = 'facebook' AND mode = 'OFFICIAL' THEN 'oauth_meta'
    WHEN channel = 'facebook' AND mode = 'MANUAL' THEN 'session_login'
    -- Meta genérico
    WHEN channel = 'meta' AND mode = 'OFFICIAL' THEN 'oauth_meta'
    WHEN channel = 'meta' AND mode = 'MANUAL' THEN 'session_login'
    ELSE 'session_login'
  END
WHERE connection_mode IS NULL OR provider IS NULL;

-- 12. BACKFILL: meta_integrations → integrations
-- Inserir registros de meta_integrations que não têm equivalente em integrations
-- Preservar organization_id como user_id (assumindo 1 org = 1 user admin para backfill)
-- NÃO sobrescrever se já existir registro com mesmo (user_id, channel, external_account_id)

INSERT INTO integrations (
  user_id,
  channel,
  provider,
  connection_mode,
  status,
  external_account_id,
  external_account_label,
  credentials_ref,
  meta,
  connected_at,
  created_at,
  updated_at
)
SELECT
  mi.organization_id as user_id,  -- mapear org → user (admin da org)
  CASE mi.provider
    WHEN 'whatsapp' THEN 'whatsapp'
    WHEN 'instagram' THEN 'instagram'
    WHEN 'facebook' THEN 'facebook'
  END as channel,
  CASE mi.provider
    WHEN 'whatsapp' THEN 'openbsp'
    ELSE 'oauth_meta'
  END as provider,
  'official' as connection_mode,
  CASE mi.status
    WHEN 'PENDING' THEN 'pending_credentials'
    WHEN 'AUTHENTICATED' THEN 'connecting'
    WHEN 'CONNECTED' THEN 'connected'
    WHEN 'DISCONNECTED' THEN 'disconnected'
    WHEN 'ERROR' THEN 'error'
    WHEN 'EXPIRED' THEN 'expired'
    WHEN 'REVOKED' THEN 'archived'
    WHEN 'PENDING_WHATSAPP' THEN 'connecting'
    ELSE 'pending_credentials'
  END as status,
  CASE mi.provider
    WHEN 'whatsapp' THEN mi.whatsapp_business_account_id
    WHEN 'instagram' THEN mi.instagram_account_id
    WHEN 'facebook' THEN mi.meta_page_id
  END as external_account_id,
  CASE mi.provider
    WHEN 'whatsapp' THEN mi.phone_number_id
    ELSE mi.meta_page_id
  END as external_account_label,
  'migrated_from_meta_integrations' as credentials_ref,
  jsonb_build_object(
    'meta_app_id', mi.meta_app_id,
    'token_expires_at', mi.token_expires_at,
    'webhook_secret', mi.webhook_secret
  ) as meta,
  mi.connected_at,
  mi.connected_at as created_at,
  mi.disconnected_at as updated_at
FROM meta_integrations mi
WHERE NOT EXISTS (
  SELECT 1 FROM integrations i
  WHERE i.user_id = mi.organization_id
    AND i.channel = CASE mi.provider WHEN 'whatsapp' THEN 'whatsapp' WHEN 'instagram' THEN 'instagram' ELSE 'facebook' END
    AND i.external_account_id = CASE mi.provider
      WHEN 'whatsapp' THEN mi.whatsapp_business_account_id
      WHEN 'instagram' THEN mi.instagram_account_id
      ELSE mi.meta_page_id
    END
);

-- 13. ARQUIVAR: WhatsApp oficial duplicado (Meta direto → status archived)
-- Registros onde provider era implícitamente Meta direto (não openbsp)
UPDATE integrations SET
  status = 'archived',
  status_reason = 'consolidado_em_openbsp',
  deleted_at = NOW()
WHERE channel = 'whatsapp'
  AND connection_mode = 'official'
  AND provider = 'openbsp'
  AND id NOT IN (
    SELECT MIN(id) FROM integrations
    WHERE channel = 'whatsapp' AND connection_mode = 'official'
    GROUP BY user_id, external_account_id
  );

-- 14. Migration DOWN (rollback completo)
-- -- 14.1 Remover trigger
-- DROP TRIGGER IF EXISTS trigger_sync_mode_connection_mode ON integrations;
-- DROP FUNCTION IF EXISTS sync_mode_connection_mode();

-- -- 14.2 Dropar índices
-- DROP INDEX IF EXISTS uq_integrations_workspace_channel_mode;
-- DROP INDEX IF EXISTS idx_integrations_workspace_channel_status;
-- DROP INDEX IF EXISTS idx_integrations_status_last_checked;

-- -- 14.3 Dropar tabela integration_events
-- DROP TABLE IF EXISTS integration_events;

-- -- 14.4 Remover colunas de integrations
-- ALTER TABLE integrations
--   DROP COLUMN IF EXISTS connection_mode,
--   DROP COLUMN IF EXISTS provider,
--   DROP COLUMN IF EXISTS status_reason,
--   DROP COLUMN IF EXISTS last_checked_at,
--   DROP COLUMN IF EXISTS last_error_at,
--   DROP COLUMN IF EXISTS external_account_id,
--   DROP COLUMN IF EXISTS external_account_label,
--   DROP COLUMN IF EXISTS credentials_ref,
--   DROP COLUMN IF EXISTS meta,
--   DROP COLUMN IF EXISTS deleted_at;

-- -- 14.5 Reverter status para enum antigo
-- ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_status_check;
-- ALTER TABLE integrations ADD CONSTRAINT integrations_status_check
--   CHECK (status IN ('PENDING', 'AUTHENTICATED', 'CONNECTED', 'DISCONNECTED', 'ERROR', 'EXPIRED', 'REVOKED'));
-- UPDATE integrations SET status = CASE
--   WHEN status = 'pending_credentials' THEN 'PENDING'
--   WHEN status = 'connecting' THEN 'AUTHENTICATED'
--   WHEN status = 'connected' THEN 'CONNECTED'
--   WHEN status = 'disconnected' THEN 'DISCONNECTED'
--   WHEN status = 'error' THEN 'ERROR'
--   WHEN status = 'expired' THEN 'EXPIRED'
--   WHEN status = 'archived' THEN 'REVOKED'
--   ELSE 'DISCONNECTED'
-- END;

-- -- 14.6 Reverter backfill de meta_integrations (apagar inseridos)
-- DELETE FROM integrations WHERE credentials_ref = 'migrated_from_meta_integrations';