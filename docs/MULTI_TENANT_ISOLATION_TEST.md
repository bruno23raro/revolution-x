# Teste de Isolamento Multi-Tenant - Revolução X

## Visão Geral

Este documento descreve o plano de teste autônomo para validar que a **RLS (Row Level Security) 100% está funcionando** em todas as 64 tabelas do banco de dados Supabase.

## Status Atual

| Item | Status |
|------|--------|
| RLS Hardening | ✅ Concluído (migration 007/008/009/028) |
| Tabelas com RLS | 64 tabelas protegidas |
| Políticas criadas | 14 políticas tenant |
| Teste de isolamento | ⏳ Aguardando execução |

## Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| `src/tests/multi-tenant-isolation-autonomous.test.ts` | Script de teste Jest completo |
| `scripts/setup-multitenant-test.ps1` | Script PowerShell de setup |
| `docs/MULTI_TENANT_ISOLATION_TEST.md` | Este documento |

## Estrutura do Teste

### 1. Setup (execução automática)

O script de teste cria dinamicamente:
- **2 usuários de teste** (user1, user2)
- **2 organizações** (org1, org2)
- **Dados de teste** em ambas as organizações

### 2. Testes de SELECT (Leitura)

Verifica que cada usuário **NÃO consegue ler** dados da outra organização:

- `Contact` - org1 NÃO vê contacts de org2
- `Lead` - org2 NÃO vê leads de org1
- `Product` - isolamento verificado
- `Campaign` - isolamento verificado
- `meta_integrations` - usa `organization_id` (snake_case)
- `webhook_events` - join com `meta_integrations`
- E todas as outras tabelas

### 3. Testes de INSERT (Escrita)

Verifica que cada usuário **NÃO consegue inserir** dados na outra organização:

- Tentativa de INSERT em org2 usando contexto de org1 → 403 ou nenhuma linha retornada

### 4. Testes de UPDATE/DELETE

Verifica que UPDATE e DELETE são bloqueados para cross-org access.

### 5. Teste de Service Role

Verifica que `service_role` pode acessar dados de todas as organizações (quando autorizado).

## Executar os Testes

### Pré-requisitos

1. **Variáveis de ambiente configuradas** em `.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=http://localhost:8432
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   DATABASE_URL=postgresql://postgres:password@localhost:54321/postgres
   ```

2. **Supabase local ou remoto ativo** com RLS habilitado

3. **Docker rodando** (se usar Supabase local):
   ```bash
   docker compose -f docker-compose.yml up -d
   ```

### Comandos

```bash
# Executar testes de isolamento
npm test -- src/tests/multi-tenant-isolation-autonomous.test.ts

# Ou diretamente com Jest
npx jest src/tests/multi-tenant-isolation-autonomous.test.ts --runInBand

# Setup (PowerShell no Windows)
.\scripts\setup-multitenant-test.ps1
```

## Matriz de Resultados Esperados

| Tabela | SELECT org1→org2 | SELECT org2→org1 | INSERT cross-org | UPDATE cross-org | DELETE cross-org |
|--------|------------------|------------------|------------------|------------------|------------------|
| Contact | 403/Empty | 403/Empty | 403 | 403 | 403 |
| Lead | 403/Empty | 403/Empty | 403 | 403 | 403 |
| Deal | 403/Empty | 403/Empty | 403 | 403 | 403 |
| Product | 403/Empty | 403/Empty | 403 | 403 | 403 |
| Pipeline | 403/Empty | 403/Empty | 403 | 403 | 403 |
| Campaign | 403/Empty | 403/Empty | 403 | 403 | 403 |
| meta_integrations | 403/Empty | 403/Empty | 403 | 403 | 403 |
| webhook_events | 403/Empty | 403/Empty | 403 | 403 | 403 |
| WhatsAppChannel | 403/Empty | 403/Empty | 403 | 403 | 403 |
| Task | 403/Empty | 403/Empty | 403 | 403 | 403 |
| AgentMemory | 403/Empty | 403/Empty | 403 | 403 | 403 |
| Message | 403/Empty | 403/Empty | 403 | 403 | 403 |
| Report | 403/Empty | 403/Empty | 403 | 403 | 403 |
| Payment | 403/Empty | 403/Empty | 403 | 403 | 403 |
| Subscription | 403/Empty | 403/Empty | 403 | 403 | 403 |
| Usage | 403/Empty | 403/Empty | 403 | 403 | 403 |
| Session | 403/Empty | 403/Empty | 403 | 403 | 403 |
| ... (todas as tabelas) | 403/Empty | 403/Empty | 403 | 403 | 403 |

## Como os Testes Funcionam

### Contexto de Tenant via GUC (Grand Unified Configuration)

```sql
-- Setar o contexto de organização
SELECT set_config('app.current_org', 'uuid-da-organizacao', true);
SELECT set_config('app.current_user_id', 'uuid-do-usuario', true);
```

### Políticas RLS (do migration 007/008)

```sql
-- Exemplo de política para tabela Contact
CREATE POLICY "Contact_tenant" ON "Contact"
  FOR ALL
  USING ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid);
```

### Política para meta_integrations (snake_case)

```sql
CREATE POLICY meta_integrations_tenant ON meta_integrations
  FOR ALL
  USING (organization_id = NULLIF(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', TRUE), '')::uuid);
```

### Política para webhook_events (via join)

```sql
CREATE POLICY webhook_events_tenant ON webhook_events
  FOR ALL
  USING (
    integration_id IS NULL
    OR integration_id IN (
      SELECT mi.id FROM meta_integrations mi
      WHERE mi.organization_id = NULLIF(current_setting('app.current_org', TRUE), '')::uuid
    )
  );
```

## Verificação Manual Alternativa

Se o ambiente não permitir execução de testes automatizados, use este script SQL manual:

```sql
-- 1. Criar test orgs e users (em SQL)
-- 2. Setar contexto e tentar SELECT/INSERT/UPDATE/DELETE
-- 3. Verificar resultados

-- Exemplo: Verificar que org1 não vê dados de org2
BEGIN;
SELECT set_config('app.current_org', 'org1-id', true);
SELECT * FROM "Contact"; -- Deve retornar contatos apenas de org1
SELECT * FROM "Contact" WHERE "organizationId" = 'org2-id'; -- Deve retornar 0 linhas
COMMIT;
```

## Correções Aplicadas

### 1. Mass-Assignment Protection

Todas as rotas POST garantem que `organizationId` é **sempre** derivado do usuário autenticado:

```typescript
// Em app/api/crm/contacts/route.ts
delete (body as Record<string, unknown>).organizationId;
const item = await contactRepoReal.create({ 
  organizationId: user.organizationId, 
  ...body 
});
```

### 2. FAIL-CLOSED RLS

Políticas usam `NULLIF(current_setting(...), '')` que:
- Retorna NULL quando contexto não está configurado
- Faz com que comparações falhem
- RESULTADO: 403 Forbidden ou Empty Array

### 3. WITH CHECK Policies

Políticas UPDATE/DELETE incluem `WITH CHECK` para prevenir:
- Reatribuição de `organizationId`
- Escrita em registros errados

```sql
WITH CHECK ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid)
```

## Relatórios De Relacionamento

Verifique também:

- `/docs/FINAL_AUDIT_REPORT_2026-10-19.md` - Auditoria completa
- `src/tests/tenant-isolation.test.ts` - Testes existentes de isolamento
- `src/tests/middleware-guard.test.ts` - Testes de middleware multi-org

## Próximos Passos

1. ✅ **Criar script de teste** - **CONCLUÍDO**
2. ⏳ **Configurar ambiente de teste** - Definir .env.local e iniciar Supabase
3. ⏳ **Executar testes** - `npm test -- multi-tenant-isolation`
4. ⏳ **Analisar resultados** - Verificar se há vazamento de dados
5. ⏳ **Corrigir eventuais falhas** - Ajustar políticas RLS específicas

## Contato

Para dúvidas sobre o teste de isolamento, consulte:
- Arquivo: `src/tests/multi-tenant-isolation-autonomous.test.ts`
- Documentação: `docs/MULTI_TENANT_ISOLATION_TEST.md`
- Migrations: `supabase/migrations/007_rls_hardening.sql`