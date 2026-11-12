# Template de Teste RLS para `integration_events`

Este template deve ser adicionado ao arquivo `src/tests/rls.test.ts` após a migração 028 ser aplicada.

## Testes a Adicionar

```typescript
describe('integration_events RLS', () => {
  let orgA: string;
  let orgB: string;
  let integrationId: string;

  beforeAll(async () => {
    orgA = uuidv4();
    orgB = uuidv4();
    integrationId = uuidv4();
    
    // Criar organizações
    await adminQ(admin, `INSERT INTO "Organization" (id, name, slug) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`, [
      orgA, 'Org A', `a_${uuidv4().slice(0, 8)}`
    ]);
    await adminQ(admin, `INSERT INTO "Organization" (id, name, slug) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`, [
      orgB, 'Org B', `b_${uuidv4().slice(0, 8)}`
    ]);
    
    // Criar uma integração de teste
    await adminQ(admin, `INSERT INTO "integration" (id, "organizationId", name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`, [
      integrationId, orgA, 'Test Integration'
    ]);
  });

  afterAll(async () => {
    await adminQ(admin, 'DELETE FROM "integration_events" WHERE "integrationId" = $1', [integrationId]);
    await adminQ(admin, 'DELETE FROM "integration" WHERE id = $1', [integrationId]);
    await adminQ(admin, 'DELETE FROM "Organization" WHERE id IN ($1, $2)', [orgA, orgB]);
  });

  it('org A can read its own integration_events', async () => {
    const eventId = uuidv4();
    await adminQ(admin, 
      `INSERT INTO "integration_events" (id, "integrationId", "workspaceId", "event_type", "payload", "created_at") 
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [eventId, integrationId, orgA, 'connection_success', {}]
    );

    const rows = await withCtx({ kind: 'org', org: orgA }, async (q) => {
      const { rows } = await q('SELECT id, event_type FROM "integration_events" WHERE "workspaceId" = $1', [orgA]);
      return rows;
    });

    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe(eventId);
    expect(rows[0].event_type).toBe('connection_success');
    
    await adminQ(admin, 'DELETE FROM "integration_events" WHERE id = $1', [eventId]);
  });

  it('org B cannot read org A integration_events', async () => {
    const eventId = uuidv4();
    await adminQ(admin,
      `INSERT INTO "integration_events" (id, "integrationId", "workspaceId", "event_type", "payload", "created_at")
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [eventId, integrationId, orgA, 'connection_success', {}]
    );

    const rows = await withCtx({ kind: 'org', org: orgB }, async (q) => {
      const { rows } = await q('SELECT id FROM "integration_events" WHERE "workspaceId" = $1', [orgA]);
      return rows;
    });

    expect(rows.length).toBe(0);
    await adminQ(admin, 'DELETE FROM "integration_events" WHERE id = $1', [eventId]);
  });

  it('INSERT with wrong workspace_id is rejected by WITH CHECK', async () => {
    await expect(
      withCtx({ kind: 'org', org: orgA }, async (q) => {
        await q(
          `INSERT INTO "integration_events" (id, "integrationId", "workspaceId", "event_type", "payload")
           VALUES ($1, $2, $3, $4, $5)`,
          [uuidv4(), integrationId, orgB, 'connection_success', {}]
        );
      })
    ).rejects.toThrow();
  });

  it('empty tenant context grants no access to integration_events', async () => {
    const eventId = uuidv4();
    await adminQ(admin,
      `INSERT INTO "integration_events" (id, "integrationId", "workspaceId", "event_type", "payload", "created_at")
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [eventId, integrationId, orgA, 'connection_success', {}]
    );

    const rows = await withCtx({ kind: 'empty' }, async (q) => {
      const { rows } = await q('SELECT id FROM "integration_events" WHERE "workspaceId" = $1', [orgA]);
      return rows;
    });

    expect(rows.length).toBe(0);
    await adminQ(admin, 'DELETE FROM "integration_events" WHERE id = $1', [eventId]);
  });

  it('integration_events has FORCE RLS enabled', async () => {
    const { rows } = await adminQ(admin,
      `SELECT relname, relforcerowsecurity AS forced
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'integration_events'`
    );
    expect(rows.length).toBe(1);
    expect(rows[0].forced).toBe(true);
  });
});
```

## Preparação para Testes

Antes de executar os testes, é necessário:

1. **Criar a tabela `integration_events`** no banco de teste (se não existir)
2. **Criar a política RLS** correspondente
3. **Configurar o schema_migrations** com a versão 028

### Script SQL de Preparação

```sql
-- Criar tabela integration_events no banco de teste (se não existir)
CREATE TABLE IF NOT EXISTS integration_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_events FORCE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY integration_events_tenant ON integration_events
  FOR ALL TO PUBLIC
  USING (workspace_id = (NULLIF(current_setting('app.current_org'::text, true), ''::text))::uuid)
  WITH CHECK (workspace_id = (NULLIF(current_setting('app.current_org'::text, true), ''::text))::uuid);

CREATE POLICY integration_events_service_role ON integration_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_integration_events_workspace_id 
  ON integration_events(workspace_id);
```