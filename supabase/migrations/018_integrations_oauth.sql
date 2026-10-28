-- Migration 018 — Integrations OAuth (contas por usuário)
-- ============================================================
-- Tabela `integrations` para armazenar credenciais OAuth de plataformas
-- vinculadas a USUÁRIO (não organização), suportando multi-contas por
-- mesmo usuário (ex.: várias contas Meta).
--
-- Colunas solicitadas:
--  id (uuid pk), user_id (uuid fk auth.users), channel (text check),
--  status (text check), access_token, refresh_token, expires_at,
--  meta_account_id, meta_account_name, phone_number, waba_id,
--  metadata (jsonb), created_at, updated_at
--
-- RLS: usuários só veem/modificam suas próprias integrações.
-- FORCE ROW LEVEL SECURITY. Sem BYPASSRLS.
--
-- Convenções (mesmas das migrações 005–017):
--   * Idempotente: CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.
--   * FK para auth.users com ON DELETE CASCADE.
--   * Grants restritos (authenticated, service_role).
-- ============================================================

-- ----------------------------------------------------------
-- Tabela integrations
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('facebook', 'instagram', 'whatsapp', 'meta')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING',
    'AUTHENTICATED',
    'CONNECTED',
    'DISCONNECTED',
    'ERROR',
    'EXPIRED',
    'REVOKED'
  )),
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  meta_account_id TEXT,
  meta_account_name TEXT,
  phone_number TEXT,
  waba_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  last_error TEXT,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  -- Alvo do upsert(..., onConflict: 'user_id,channel,meta_account_id') dos
  -- callbacks OAuth. Sem esta constraint o upsert falha (PGRST/P1014).
  -- NULLs são distintos: duas contas sem meta_account_id não colidem.
  CONSTRAINT uq_integrations_user_channel_account
    UNIQUE (user_id, channel, meta_account_id)
);

-- ----------------------------------------------------------
-- Índices
-- ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_channel ON integrations(channel);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON integrations(status);
-- Índice composto para lookup frequente por usuário + canal
CREATE INDEX IF NOT EXISTS idx_integrations_user_channel ON integrations(user_id, channel);
-- Índice para busca por waba_id (caso necessário para lookup reverso)
CREATE INDEX IF NOT EXISTS idx_integrations_waba ON integrations(waba_id) WHERE waba_id IS NOT NULL;

-- ----------------------------------------------------------
-- RLS — FORçado; fail-closed
-- ----------------------------------------------------------
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations FORCE ROW LEVEL SECURITY;

-- GUC: `app.current_user_id` é o nome usado por todo o resto do app
-- (src/lib/prisma.ts withUserContext + políticas das migrações 007/008).
-- O nome antigo ('app.current_user') nunca é definido → política sempre falsa.
DROP POLICY IF EXISTS integrations_user ON integrations;
CREATE POLICY integrations_user ON integrations
  FOR ALL
  USING (user_id = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid);

-- ----------------------------------------------------------
-- Comments
-- ----------------------------------------------------------
COMMENT ON TABLE integrations IS 'OAuth integrations per user; tokens stored encrypted in application layer';
COMMENT ON COLUMN integrations.access_token IS 'Bearer token (encryptrado em tempo de uso pelo app)';
COMMENT ON COLUMN integrations.refresh_token IS 'Refresh token (encryptrado em tempo de uso pelo app)';
COMMENT ON COLUMN integrations.metadata IS 'Campos extras da plataforma (JSON livre)';

-- ----------------------------------------------------------
-- Grants (restritos; idempotente; sem BYPASSRLS)
-- ----------------------------------------------------------
DO $$
DECLARE
  _role TEXT;
BEGIN
  FOR _role IN SELECT unnest(ARRAY['authenticated','service_role']) LOOP
    BEGIN
      EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON integrations TO ' || quote_ident(_role);
    EXCEPTION WHEN undefined_object THEN
      NULL; -- role ausente neste ambiente
    END;
  END LOOP;

  IF to_regrole('revx_test') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON integrations TO revx_test';
  END IF;
END
$$;
