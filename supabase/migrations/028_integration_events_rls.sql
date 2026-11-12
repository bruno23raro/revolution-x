-- Migration 028: Habilitar RLS em integration_events
-- Correção de segurança: a tabela não possui políticas de isolamento multi-tenant
-- Correção de coluna: renomear 'event' para 'event_type' para correspondência com o código
-- Correção de schema drift: adicionar colunas ausentes (user_id, payload, created_at)
--
-- Este é uma correção aditiva - NÃO remove políticas existentes
--
-- Baseado em migration 024 que criou a tabela com RLS, mas as policies estavam ausentes
-- Baseado em produção que já usa event_type (não event)
-- Tabela em produção tem schema diferente (colunas adicionais)

-- 1. Garantir que a tabela integration_events existe
CREATE TABLE IF NOT EXISTS integration_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_id UUID,
  meta_event_id TEXT,
  payload_hash TEXT,
  processed_at TIMESTAMPTZ
);

COMMENT ON TABLE integration_events IS 'Trilha de auditoria de eventos de integração (conexão, erro, renovação, troca de modo)';
COMMENT ON COLUMN integration_events.event_type IS 'Tipo do evento: connection_success, connection_failed, disconnection, credential_renewal, mode_switch, error';

-- 2. Renomear coluna de 'event' para 'event_type' (compatibilidade com código)
-- Apenas executa se a coluna ainda for 'event' (não se já foi renomeada)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'integration_events' AND column_name = 'event') THEN
    ALTER TABLE integration_events RENAME COLUMN event TO event_type;
  END IF;
END $$;

-- 3. Garantir colunas adicionais existam (schema drift)
ALTER TABLE integration_events ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE integration_events ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}';
ALTER TABLE integration_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE integration_events ADD COLUMN IF NOT EXISTS event_id UUID;
ALTER TABLE integration_events ADD COLUMN IF NOT EXISTS meta_event_id TEXT;
ALTER TABLE integration_events ADD COLUMN IF NOT EXISTS payload_hash TEXT;
ALTER TABLE integration_events ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- 4. Verificar se RLS está habilitado
ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;

-- Ativar FORCE RLS (necessário para multi-tenant seguro)
ALTER TABLE integration_events FORCE ROW LEVEL SECURITY;

-- 5. Política de tenant: usuário só vê eventos das próprias integrações
-- workspace_id = app.current_org (tenant context via GUC)
-- Usa NULLIF para tratar caso current_setting retorne string vazia
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'integration_events_tenant') THEN
    CREATE POLICY integration_events_tenant ON integration_events
      FOR ALL TO PUBLIC
      USING (workspace_id = (NULLIF(current_setting('app.current_org'::text, true), ''::text))::uuid)
      WITH CHECK (workspace_id = (NULLIF(current_setting('app.current_org'::text, true), ''::text))::uuid);
  END IF;
END $$;

-- 6. Política para service_role - bypass necessário para operações admin
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'integration_events_service_role') THEN
    CREATE POLICY integration_events_service_role ON integration_events
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 7. Índices para performance de consultas com RLS
CREATE INDEX IF NOT EXISTS idx_integration_events_workspace_id
  ON integration_events(workspace_id);

CREATE INDEX IF NOT EXISTS idx_integration_events_integration_id_workspace
  ON integration_events(integration_id, workspace_id);

CREATE INDEX IF NOT EXISTS idx_integration_events_created_at_desc
  ON integration_events(created_at DESC);
  -- Índice para lookups por event_type
CREATE INDEX IF NOT EXISTS idx_integration_events_event_type
  ON integration_events(event_type);

-- Índice para queries de audit trail
CREATE INDEX IF NOT EXISTS idx_integration_events_integration_created
  ON integration_events(integration_id, created_at DESC);

COMMENT ON POLICY integration_events_tenant IS 'Multi-tenant isolation: only events belonging to current tenant accessible';
COMMENT ON POLICY integration_events_service_role IS 'Service role bypass for admin operations';