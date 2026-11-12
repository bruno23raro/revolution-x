-- Migration 029: Correção RLS para integration_events
--
-- PROBLEMA IDENTIFICADO:
-- - A tabela integration_events em produção JÁ EXISTE com schema drift
-- - Possui colunas adicionais: event_id (PK), meta_event_id, payload_hash, processed_at
-- - RLS está DESATIVADO ou POLICIES não aplicadas
--
-- ESTRATÉGIA:
-- - NÃO recriar tabela (CREATE TABLE IF NOT EXISTS não funciona se tabela existe com PK diferente)
-- - Adicionar colunas ausentes via ADD COLUMN IF NOT EXISTS
-- - Habilitar RLS somente se não estiver habilitado
-- - Criar policies de forma idempotente

-- 1. Verificar se a tabela existe e tem a estrutura correta
-- Se a tabela já existe com event_id como PK (produção), não criar novamente
DO $$
BEGIN
  -- Verificar se a PK é 'event_id' (produção antiga) ou 'id' (nova estrutura)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'integration_events'
    AND constraint_type = 'PRIMARY KEY'
  ) THEN
    -- Tabela não existe ou não tem PK - criar estrutura mínima
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
  END IF;
END $$;

-- 2. Adicionar colunas ausentes (schema drift resolution)
-- These are safe because ADD COLUMN IF NOT EXISTS won't fail if column exists
ALTER TABLE integration_events ADD COLUMN IF NOT EXISTS event_id UUID;
ALTER TABLE integration_events ADD COLUMN IF NOT EXISTS meta_event_id TEXT;
ALTER TABLE integration_events ADD COLUMN IF NOT EXISTS payload_hash TEXT;
ALTER TABLE integration_events ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
ALTER TABLE integration_events ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE integration_events ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}';
ALTER TABLE integration_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Garantir NOT NULL em event_type (compatibilidade com código)
ALTER TABLE integration_events ALTER COLUMN event_type SET NOT NULL;
ALTER TABLE integration_events ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE integration_events ALTER COLUMN integration_id SET NOT NULL;

-- 4. Criar índices se não existirem (para performance RLS)
CREATE INDEX IF NOT EXISTS idx_integration_events_workspace_id ON integration_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_integration_events_integration_id ON integration_events(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_events_created_at_desc ON integration_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_events_event_type ON integration_events(event_type);
CREATE INDEX IF NOT EXISTS idx_integration_events_integration_created ON integration_events(integration_id, created_at DESC);

-- 5. Habilitar RLS se não estiver habilitado
-- Usar uma coluna computed para verificar
DO $$
DECLARE
  rls_enabled BOOLEAN;
BEGIN
  SELECT rowsecurity INTO rls_enabled FROM pg_tables WHERE tablename = 'integration_events';
  IF NOT rls_enabled THEN
    ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- 6. Habilitar FORCE RLS (necessário para segurança multi-tenant)
ALTER TABLE integration_events FORCE ROW LEVEL SECURITY;

-- 7. Criar política de tenant (idempotente)
-- Para todas as roles (PUBLIC) - segurança via GUC app.current_org
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'integration_events' AND policyname = 'integration_events_tenant'
  ) THEN
    CREATE POLICY integration_events_tenant ON integration_events
      FOR ALL TO PUBLIC
      USING (workspace_id = NULLIF(current_setting('app.current_org', true), '')::uuid)
      WITH CHECK (workspace_id = NULLIF(current_setting('app.current_org', true), '')::uuid);
  END IF;
END $$;

-- 8. Criar política para service_role (idempotente)
-- Necessária para webhooks, onboardings, operações admin
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'integration_events' AND policyname = 'integration_events_service_role'
  ) THEN
    CREATE POLICY integration_events_service_role ON integration_events
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 9. Comentários para documentação
COMMENT ON TABLE integration_events IS 'Trilha de auditoria de eventos de integração (conexão, erro, renovação, troca de modo)';
COMMENT ON COLUMN integration_events.event_type IS 'Tipo do evento: connection_success, connection_failed, disconnection, credential_renewal, mode_switch, error';
COMMENT ON POLICY integration_events_tenant IS 'Multi-tenant isolation: only events belonging to current tenant accessible via app.current_org GUC';
COMMENT ON POLICY integration_events_service_role IS 'Service role bypass for admin operations (webhooks, onboarding, admin tasks)';