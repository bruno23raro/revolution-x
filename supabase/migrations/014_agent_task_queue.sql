-- ============================================================
-- 014 — AGENT TASK QUEUE + PROJECT MEMORY (FASE AGENT / Phase 2)
-- ============================================================
-- Cria a fila persistente do centro administrativo inteligente:
--   "Task", "TaskStep", "TaskEvent", "AgentMemory"
--
-- Convenções (idênticas às migrations 005–009):
--   * Tabelas PascalCase (schema canônico do Prisma).
--   * Idempotente: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.
--   * RLS FORÇADO (FORCE) e fail-closed:
--       - Task / TaskStep / TaskEvent  → escopo de TENANT (app.current_org)
--       - AgentMemory                  → escopo de USUÁRIO (app.current_user_id),
--         como os tokens em 008 (pertence ao indivíduo, não ao org).
--     Quando o GUC não está definido/é vazio, NULLIF → NULL → 0 linhas.
--   * Grants restritos: authenticated / service_role / revx_test (local).
--     Nenhum BYPASSRLS é concedido aqui.
--
-- A aplicação conecta como `postgres` (BYPASSRLS), portanto a fila funciona
-- normalmente; o RLS restringe apenas o caminho da API Supabase
-- (authenticated/anon), o mesmo padrão das migrations 007–009.
--
-- ESCOPO DE APLICAÇÃO:
--   * LOCAL / STAGING: aplicar com segurança
--     (ex.: `psql -f 014_agent_task_queue.sql` contra TEST_ADMIN_DATABASE_URL).
--   * PRODUÇÃO (Supabase linked): NÃO aplicar sem autorização explícita.
--     É um DDL aditivo e reversível (DROP TABLEs), mas exige janela de
--     manutenção e registro no plano de rollout.
-- ============================================================

DO $$
BEGIN
  -- ----------------------------------------------------------
  -- "Task" — raiz da fila
  -- ----------------------------------------------------------
  CREATE TABLE IF NOT EXISTS "Task" (
    "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
    "userId"         UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "title"          VARCHAR(300) NOT NULL,
    "status"         VARCHAR(30) NOT NULL DEFAULT 'queued',
    "progress"       INTEGER NOT NULL DEFAULT 0,
    "inputJson"      JSONB NOT NULL DEFAULT '{}',
    "resultJson"     JSONB,
    "errorText"      TEXT,
    "modelUsed"      VARCHAR(100),
    "usageJson"      JSONB,
    "waitingReason"  VARCHAR(300),
    "createdAt"      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updatedAt"      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "completedAt"    TIMESTAMPTZ(6)
  );

  CREATE INDEX IF NOT EXISTS "Task_org_status_idx" ON "Task" ("organizationId", "status");
  CREATE INDEX IF NOT EXISTS "Task_user_idx" ON "Task" ("userId");

  ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "Task" FORCE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Task_tenant" ON "Task";
  CREATE POLICY "Task_tenant" ON "Task"
    FOR ALL
    USING ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid)
    WITH CHECK ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid);

  -- ----------------------------------------------------------
  -- "TaskStep" — etapas ordenadas (progresso real)
  -- ----------------------------------------------------------
  CREATE TABLE IF NOT EXISTS "TaskStep" (
    "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "taskId"         UUID NOT NULL REFERENCES "Task"(id) ON DELETE CASCADE,
    "organizationId" UUID NOT NULL,
    "seq"            INTEGER NOT NULL,
    "name"           VARCHAR(200) NOT NULL,
    "status"         VARCHAR(30) NOT NULL DEFAULT 'pending',
    "detailJson"     JSONB,
    "startedAt"      TIMESTAMPTZ(6),
    "finishedAt"     TIMESTAMPTZ(6),
    "createdAt"      TIMESTAMPTZ(6) NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS "TaskStep_task_seq_idx" ON "TaskStep" ("taskId", "seq");
  CREATE INDEX IF NOT EXISTS "TaskStep_org_idx" ON "TaskStep" ("organizationId");

  ALTER TABLE "TaskStep" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "TaskStep" FORCE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "TaskStep_tenant" ON "TaskStep";
  CREATE POLICY "TaskStep_tenant" ON "TaskStep"
    FOR ALL
    USING ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid)
    WITH CHECK ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid);

  -- ----------------------------------------------------------
  -- "TaskEvent" — log append-only
  -- ----------------------------------------------------------
  CREATE TABLE IF NOT EXISTS "TaskEvent" (
    "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "taskId"         UUID NOT NULL REFERENCES "Task"(id) ON DELETE CASCADE,
    "organizationId" UUID NOT NULL,
    "type"           VARCHAR(60) NOT NULL,
    "payloadJson"    JSONB NOT NULL DEFAULT '{}',
    "createdAt"      TIMESTAMPTZ(6) NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS "TaskEvent_task_idx" ON "TaskEvent" ("taskId");
  CREATE INDEX IF NOT EXISTS "TaskEvent_org_idx" ON "TaskEvent" ("organizationId");

  ALTER TABLE "TaskEvent" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "TaskEvent" FORCE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "TaskEvent_tenant" ON "TaskEvent";
  CREATE POLICY "TaskEvent_tenant" ON "TaskEvent"
    FOR ALL
    USING ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid)
    WITH CHECK ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid);

  -- ----------------------------------------------------------
  -- "AgentMemory" — memória persistente (escopo de USUÁRIO, cf. 008)
  -- ----------------------------------------------------------
  CREATE TABLE IF NOT EXISTS "AgentMemory" (
    "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
    "userId"         UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "kind"           VARCHAR(40) NOT NULL,
    "memoryKey"      VARCHAR(200) NOT NULL,
    "valueJson"      JSONB NOT NULL,
    "supersededAt"   TIMESTAMPTZ(6),
    "createdAt"      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updatedAt"      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "AgentMemory_org_user_kind_key_key"
      UNIQUE ("organizationId", "userId", "kind", "memoryKey")
  );

  CREATE INDEX IF NOT EXISTS "AgentMemory_org_user_idx" ON "AgentMemory" ("organizationId", "userId");

  ALTER TABLE "AgentMemory" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "AgentMemory" FORCE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "AgentMemory_user" ON "AgentMemory";
  CREATE POLICY "AgentMemory_user" ON "AgentMemory"
    FOR ALL
    USING ("userId" = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid)
    WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid);
END
$$;

-- ============================================================
-- Grants (restritos; idempotente; sem BYPASSRLS)
-- ============================================================
DO $$
DECLARE
  _role TEXT;
BEGIN
  FOR _role IN SELECT unnest(ARRAY['authenticated','service_role']) LOOP
    BEGIN
      EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "Task", "TaskStep", "TaskEvent" TO ' || quote_ident(_role);
      EXECUTE 'GRANT SELECT, INSERT, UPDATE ON "AgentMemory" TO ' || quote_ident(_role);
    EXCEPTION WHEN undefined_object THEN
      NULL; -- role ausente neste ambiente
    END;
  END LOOP;

  -- Role de teste local (somente onde existe — cf. 008/009)
  IF to_regrole('revx_test') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "Task", "TaskStep", "TaskEvent" TO revx_test';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON "AgentMemory" TO revx_test';
  END IF;
END
$$;
