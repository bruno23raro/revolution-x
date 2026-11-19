-- Migration 034: Tabelas faltantes do schema Prisma
-- Cria as 9 tabelas que estão no schema Prisma mas não existem no banco

-- 1. media
CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url VARCHAR(500),
  type VARCHAR(50) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP(6) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_media_org ON media(organization_id);

-- 2. tasks
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(300) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'queued',
  progress INT NOT NULL DEFAULT 0,
  input_json JSONB NOT NULL DEFAULT '{}',
  result_json JSONB,
  error_text TEXT,
  model_used VARCHAR(100),
  usage_json JSONB,
  waiting_reason VARCHAR(300),
  created_at TIMESTAMP(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT now(),
  completed_at TIMESTAMP(6)
);
CREATE INDEX IF NOT EXISTS idx_tasks_org_status ON tasks(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);

-- 3. task_steps
CREATE TABLE IF NOT EXISTS task_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  seq INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  detail_json JSONB,
  started_at TIMESTAMP(6),
  finished_at TIMESTAMP(6),
  created_at TIMESTAMP(6) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_steps_task ON task_steps(task_id, seq);
CREATE INDEX IF NOT EXISTS idx_task_steps_org ON task_steps(organization_id);

-- 5. task_events
CREATE TABLE IF NOT EXISTS task_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  type VARCHAR(60) NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP(6) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_events_task ON task_events(task_id);
CREATE INDEX IF NOT EXISTS idx_task_events_org ON task_events(organization_id);

-- 5. agent_memories
CREATE TABLE IF NOT EXISTS agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind VARCHAR(40) NOT NULL,
  memory_key VARCHAR(200) NOT NULL,
  value_json JSONB NOT NULL,
  superseded_at TIMESTAMP(6),
  created_at TIMESTAMP(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT now(),
  CONSTRAINT uq_agent_memory UNIQUE (organization_id, user_id, kind, memory_key)
);
CREATE INDEX IF NOT EXISTS idx_agent_memories_org_user ON agent_memories(organization_id, user_id);

-- 6. admin_alerts
CREATE TABLE IF NOT EXISTS admin_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'warning',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  status_code INT,
  route VARCHAR(255),
  timestamp TIMESTAMP(6) NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_org ON admin_alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_ts ON admin_alerts(timestamp);

-- 6. campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title VARCHAR(300) NOT NULL,
  channel VARCHAR(30) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  account_id VARCHAR(64),
  message TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '{}',
  audience_json JSONB NOT NULL DEFAULT '{}',
  batch_json JSONB NOT NULL DEFAULT '{}',
  result_kind VARCHAR(20),
  scheduled_for TIMESTAMP(6),
  started_at TIMESTAMP(6),
  completed_at TIMESTAMP(6),
  progress INT NOT NULL DEFAULT 0,
  total_count INT NOT NULL DEFAULT 0,
  sent_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  skipped_count INT NOT NULL DEFAULT 0,
  error_text TEXT,
  manual_notes TEXT,
  created_at TIMESTAMP(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaigns_org_status ON campaigns(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_org_created ON campaigns(organization_id, created_at);

-- 7. campaign_recipients
CREATE TABLE IF NOT EXISTS campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  external_message_id VARCHAR(200),
  last_error TEXT,
  sent_at TIMESTAMP(6),
  created_at TIMESTAMP(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT now(),
  CONSTRAINT uq_campaign_contact UNIQUE (campaign_id, contact_id)
);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status ON campaign_recipients(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_org ON campaign_recipients(organization_id);

-- 7. integration_events
CREATE TABLE IF NOT EXISTS integration_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  user_id UUID,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  event_id UUID,
  meta_event_id TEXT,
  payload_hash TEXT,
  processed_at TIMESTAMPTZ(6)
);
CREATE INDEX IF NOT EXISTS idx_integration_events_ws ON integration_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_integration_events_int_ws ON integration_events(integration_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_integration_events_type ON integration_events(event_type);

-- Enable RLS and create policies for all new tables
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['media','tasks','task_steps','task_events','agent_memories','admin_alerts','campaigns','campaign_recipients','integration_events']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($f$CREATE POLICY %I ON %I FOR ALL TO PUBLIC
      USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid)
      WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid)$f$,
      t || '_tenant', t);
  END LOOP;
END $$;