# FASE 2 — Base SaaS Multi-tenant

**Data:** 2026-11-11  
**Prioridade:** Alta — auditoria de organizações e políticas RLS  
**Base:** Revolution X production build 01a17a4b

---

## 2.1 Organizations, Users, Members, Roles

### 2.1.1 Auditar Organizations Existentes

**Objetivo:** Validar o estado atual das organizações no sistema.

#### Comandos de Verificação

```powershell
# Verificar organizações no banco
Get-Content "c:\Users\Bruno\.claude\Revolution\X\prisma\schema.prisma" | Select-String -Pattern "model Organization"

# Listar usuários por organização
# Executar via Prisma Studio ou SQL:
# SELECT * FROM "Organization" LIMIT 10;

# Verificar memberships
# SELECT * FROM "OrganizationMember" LIMIT 20;
```

#### Arquivos para Revisão

- `app/api/admin/ai-config/route.ts` — admin routes com organização
- `app/api/admin/alerts/route.ts` — admin routes
- `app/api/admin/chat/route.ts` — admin chat
- `app/api/admin/memory/route.ts` — admin memory
- `app/api/admin/notify-slack/route.ts` — admin notify-slack
- `app/api/admin/notify-whatsapp/route.ts` — admin notify-whatsapp
- `app/api/admin/tasks/route.ts` — admin tasks

### 2.1.2 Validar Papéis (Roles)

**Papéis esperados:**
- **Owner** — dono da organização, pleno acesso
- **Admin** — administrador, gestão de usuários e campanhas
- **Agent** — agente, pode criar/enviar campanhas
- **Viewer** — visualizador, apenas leitura

#### Verificação Necessária

```typescript
// Verificar roles no código
import { getAllOrganizationMemberships } from '@/lib/auth';

// Verificar se roles são coerentes
const memberships = await getAllOrganizationMemberships(req);
const hasAdminRole = memberships.some(m => m.role === 'admin' || m.role === 'owner');
```

### 2.1.3 Implementar Permissões Granulares

**Permissões por role:**

| Recurso | Owner | Admin | Agent | Viewer |
|---------|-------|-------|-------|--------|
| Organizations | CRUD | CRUD | Create | Read |
| Campaigns | CRUD | CRUD | Create | None |
| Contacts | CRUD | CRUD | Create/Edit | Read |
| Templates | CRUD | CRUD | Create | Read |
| Reports | CRUD | CRUD | None | Read |
| Admin panels | CRUD | CRUD | None | None |

### 2.1.4 Garantir Isolamento por Organização

**Princípio:** Cada organização só acede aos seus próprios dados.

#### Padrão de Isolamento

```typescript
// Exemplo de filtro em queries
const organizationId = user.organizationId;

const contacts = await prisma.contact.findMany({
  where: { organizationId },
  orderBy: { createdAt: 'desc' },
});
```

#### Verificar Uso de `organizationId`

Grep em todo o códigobase:

```bash
# Buscar uso de organizationId
rg "organizationId" --type ts --type js --type tsx --type jsx
```

---

## 2.2 RLS e Políticas

### 2.2.1 Confirmar FORCE RLS em Todas as Tabelas

**Status Atual:** ✅ 21 tabelas com FORCE RLS (conforme readiness report 2026-10-26)

#### Tabelas com FORCE RLS

```sql
-- Verificar quais tabelas têm FORCE RLS
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tableowner = current_user;
```

#### Pattern de Policy

```sql
-- Padrão observado em migrations 007/008/009
CREATE POLICY "Organization isolation" ON public."contacts"
  FOR ALL USING (organizationId = NULLIF(current_setting('app.current_org', TRUE), '')::uuid);
```

### 2.2.2 Validar Policies Fail-closed

**Definição:** Policy bloqueia acesso por padrão; apenas usuários explícitos permitidos podem acessar.

#### Verificar Fail-closed

```sql
-- Verificar se policies são fail-closed
SELECT polname, polcmd, polroles, polqualify
FROM pg_policy
WHERE schemaname = 'public';
```

#### Expected Policy Pattern

```sql
-- Políticas devem ter:
-- - polcmd que restringe operações
-- - polqualify que filtra por organizationId
-- - polroles limitados a roles específicos
```

### 2.2.3 Verificar `app.current_org` vs `app.current_org_id`

**Possível inconsistência identificada** em relatórios anteriores.

#### Onde Cada Um Aparece

| Variável | Provável Uso |
|----------|--------------|
| `app.current_org` | Contexto SQL via `current_setting()` |
| `app.current_org_id` | Possibly frontend ou outro contexto |

#### Verificar Migrações

```bash
# Grep nas migrations
rg "current_org" --type prisma
rg "current_org_id" --type prisma
```

#### Corrigir Apenas Quando Comprovar Problema

Manter compatibilidade enquanto verificar o funcionamento real.

### 2.2.4 Validar com Pooling e Transações PostgreSQL

**Importante:** RLS behavior pode variar com connection pooling.

#### Testes Necessários

1. **Connection test:** Abrir múltiplas conexões e verificar que RLS persiste
2. **Transaction test:** Verificar behavior dentro de transactions
3. **Pool test:** Testar com o pool configured no Prisma

#### Padrão de Uso

```typescript
// Exemplo de uso seguro com Prisma
const db = prisma.withOrgContext(user.organizationId);

// ou usando RLS manualmente
await prisma.$executeRaw`SET LOCAL app.current_org = '${organizationId}'`;
```

---

## 2.3 API Keys e Audit Logs

### 2.3.1 Implementar Geração de API Keys por Tenant

#### Fluxo Esperado

1. Admin gera API key no painel
2. Key associada à organização do admin
3. Key tem escopos definidos (read:, write:, admin:)
4. Key válida por período ou usos
5. Key pode ser revogada

#### Armazenamento

```typescript
// Tabela proposta: ApiKey
// - id, hash, organizationId, scopes, expiresAt, createdAt, lastUsedAt
```

### 2.3.2 Implementar Audit Logs

#### Entidades para Log

- **User actions** (create, update, delete)
- **Organization changes** (member additions, role changes)
- **API key operations** (generate, revoke, rotate)
- **Campaign operations** (create, send, pause, resume)
- **Template operations** (create, update, delete)

#### Estrutura Proposta

```typescript
// Tabela: AuditLog
// - id, organizationId, userId, action, entityType, entityId, 
//   changes, ip, userAgent, timestamp, metadata
```

#### Exemplos de Action Values

```
"organization.created", "organization.updated", "organization.deleted"
"user.invited", "user.role_changed", "user.deactivated"
"api_key.created", "api_key.revoked", "api_key.rotated"
"campaign.created", "campaign.sent", "campaign.paused", "campaign.resumed"
"template.created", "template.updated", "template.deleted"
```

---

## 2.4 Próximos Passos Imediatos

1. **Audit organizations** — listar todas organizations no banco
2. **Validate roles** — verificar consistency de memberships
3. **Test RLS policies** — confirmar fail-closed em todas as tabelas
4. **Grep organizationId** — mapear uso em todo códigobase
5. **Document findings** — registrar no ESTADO_ATUAL.md

---

## 2.5 Critérios de Conclusão da FASE 2

- [ ] Todas as organizations auditadas
- [ ] Roles validated e consistentes
- [ ] FORCE RLS confirmado em 21 tabelas
- [ ] Policies fail-closed verificadas
- [ ] organizationId usage documentado
- [ ] API keys design definido
- [ ] Audit logs design definido