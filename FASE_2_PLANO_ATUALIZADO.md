# FASE 2 — Plano Atualizado: Consolidação da Fundação Multi-tenant

**Data:** 2026-11-11  
**Base:** FASE_2_ESTADO_ATUAL.md + FASE_3_OPENBSP_CANAIS.md  
**Objetivo:** Fortalecer a fundação multi-tenant SEM quebrar OpenBSP (FASE 3 validada)

---

## Regra Absoluta (do f238)

> **NUNCA FECHAR UMA PORTA ABERTA. SEMPRE CONSTRUIR, TESTAR E VALIDAR UMA NOVA ANTES DE SUBSTITUIR A ANTERIOR.**
> 
> - Não modificar schema/migration 016 em produção sem autorização humana
> - Não alterar endpoints FASE 3 OpenBSP sem substituição testada
> - Não fazer deploy/commit/push automático
> - Não enviar mensagens reais sem autorização explícita

---

## 2.1 Organizations, Users, Members, Roles

### 2.1.1 Auditar Organizações Existentes ✅ CONCLUÍDO
- [x] Schema Prisma validado (Organization, User, OrganizationMember, Role)
- [x] Queries de verificação documentadas no ESTADO_ATUAL
- [x] Organizações no banco mapeadas via background agent

### 2.1.2 Validar Papéis (Roles) 🔄 EM ANDAMENTO
- [x] Roles definidos: owner, admin, agent, viewer/member
- [x] Verificação de consistência: papel deriva da organização primária
- [ ] **AÇÃO:** Criar matriz de permissão formal por recurso
- [ ] **AÇÃO:** Validar que `Role.permissionsJson` é usado nas rotas admin

### 2.1.3 Implementar Permissões Granulares 📋 PLANEJADO
| Recurso | Owner | Admin | Agent | Viewer |
|---------|-------|-------|-------|--------|
| Organizations | CRUD | CRUD | Create | Read |
| Campaigns | CRUD | CRUD | Create | Read |
| Contacts | CRUD | CRUD | Create/Edit | Read |
| Templates | CRUD | CRUD | Create | Read |
| Reports | CRUD | CRUD | Read | Read |
| Admin panels | CRUD | CRUD | None | None |
| Integrations | CRUD | CRUD | Read | Read |
| Webhooks | CRUD | CRUD | None | None |

**Próximos passos:**
1. Criar helper `requireRole(req, roles: string[])` em `src/lib/auth.ts`
2. Aplicar em rotas admin sensíveis (ai-config, schema/diff, tasks)
3. Testes unitários para cada combinação role/recurso

### 2.1.4 Garantir Isolamento por Organização ✅ VALIDADO
- [x] Middleware define `x-organization-id` cookie
- [x] `getAuthenticatedUser` retorna `organizationId` da org primária
- [x] `requireMembershipIn` valida acesso a org específica
- [x] Todas as rotas usam `user.organizationId` (server-derived)
- [x] Mass-assignment guard presente em POST handlers
- [ ] **AÇÃO:** Verificar se há rotas que aceitam `organizationId` do body/query

---

## 2.2 RLS e Políticas

### 2.2.1 Confirmar FORCE RLS em Todas as Tabelas ✅ CONFIRMADO
- [x] 21 tabelas com FORCE RLS (migrations 007/008/009)
- [x] Tabelas: Organization, OrganizationMember, Contact, Lead, Deal, Pipeline, Product, Media, Post, CalendarEvent, Video, Message, Report, Subscription, Usage, BillingEvent, Session, Role, meta_integrations, webhook_events, whatsapp_channels, whatsapp_templates

### 2.2.2 Validar Políticas Fail-closed ✅ CONFIRMADO
- [x] Padrão: `NULLIF(current_setting('app.current_org', TRUE), '')::uuid`
- [x] Contexto vazio/ausente → NULL → nenhuma linha (fail-closed)
- [x] USING + WITH CHECK idênticos
- [ ] **AÇÃO:** Testar com connection pooling (Supavisor) e transações

### 2.2.3 Verificar `app.current_org` vs `app.current_org_id` 🔍 INVESTIGAR
- [x] Migrations 007/008/009 usam **apenas** `app.current_org`
- [ ] **AÇÃO:** Grep no codebase por `current_org_id` — confirmar se é usado em algum lugar
- [ ] **AÇÃO:** Se não usado, documentar como legado/inexistente

### 2.2.4 Validar com Pooling e Transações PostgreSQL 📋 PLANEJADO
- [ ] Testar conexões múltiplas via Supavisor (port 54320)
- [ ] Verificar behavior dentro de transactions (`SET LOCAL app.current_org`)
- [ ] Validar com Prisma `withOrgContext` helper

---

## 2.3 API Keys e Audit Logs

### 2.3.1 Implementar Geração de API Keys por Tenant 📋 PLANEJADO
**Novo modelo sugerido:**
```prisma
model ApiKey {
  id           String   @id @default(uuid()) @db.Uuid
  organizationId String @db.Uuid
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name         String   @db.VarChar(100)
  keyHash      String   @unique @db.VarChar(255)
  scopes       String[] @default("[]") // read:, write:, admin:
  expiresAt    DateTime?
  lastUsedAt   DateTime?
  createdAt    DateTime @default(now()) @db.Timestamp(6)
  revokedAt    DateTime?
  @@index([organizationId])
}
```

**Fluxo:**
1. Admin gera API key no painel `/admin/api-keys`
2. Key associada à organização do admin
3. Scopes definidos (read:campaigns, write:messages, admin:webhooks)
4. Key válida por período ou usos
5. Key pode ser revogada/rotacionada

### 2.3.2 Implementar Audit Logs 📋 PLANEJADO
**Novo modelo sugerido:**
```prisma
model AuditLog {
  id           String   @id @default(uuid()) @db.Uuid
  organizationId String @db.Uuid
  userId       String   @db.Uuid
  action       String   @db.VarChar(100) // "organization.created", "user.invited", etc.
  entityType   String   @db.VarChar(50)
  entityId     String?
  changes      Json     @default("{}")
  ip           String?  @db.VarChar(45)
  userAgent    String?
  timestamp    DateTime @default(now()) @db.Timestamp(6)
  metadata     Json     @default("{}")
  @@index([organizationId, timestamp])
  @@index([userId])
  @@index([action])
}
```

**Actions a logar:**
- `organization.created/updated/deleted`
- `user.invited/role_changed/deactivated`
- `api_key.created/revoked/rotated`
- `campaign.created/sent/paused/resumed`
- `template.created/updated/deleted`
- `integration.connected/disconnected/refreshed`

---

## 2.4 Compatibilidade OpenBSP (Seção 12 do f238) — CRÍTICO

### 2.4.1 Regressões a Prevenir (Testes Obrigatórios)

| Endpoint FASE 3 | Teste de Não-Regressão | Status |
|-----------------|------------------------|--------|
| `POST /integrations/openbsp/connect` | Mint token + popupUrl + callback com orgId | ✅ Validado |
| `POST /integrations/openbsp/status` | **verifyToken do DB apenas** (não frontend) | ✅ Validado |
| `GET /integrations/openbsp/callback` | Poll organizations_addresses com verify_token | ✅ Validado |
| `POST /integrations/openbsp/refresh-token` | Rotação escopada por organização | ✅ Validado |
| `POST /webhooks/openbsp/incoming` | Idempotência + HMAC-SHA256 | ✅ Validado |

### 2.4.2 Isolamento por Organização
- [x] Connect usa `user.organizationId` para criar canal
- [x] Status recupera `verifyToken` via `organizationId` autenticado
- [x] Callback usa `verify_token` do DB (não do frontend)
- [ ] **AÇÃO:** Testar cross-tenant: org A não vê canais/org B

### 2.4.3 verifyToken Backend-only
- [x] **REGRA DE OURO:** `verifyToken` NUNCA exposto ao frontend
- [x] Status endpoint: `SELECT verifyToken FROM whatsapp_channels WHERE organizationId = $1`
- [ ] **AÇÃO:** Adicionar teste unitário que tenta passar verifyToken no body → deve falhar

---

## 2.5 Testes Obrigatórios (Seção 13 do f238)

### 2.5.1 Suite de Testes Multi-tenant

```typescript
// src/tests/fase2-multi-tenant.test.ts — NOVO ARQUIVO
describe('FASE 2 — Multi-tenant Foundation', () => {
  // 2.5.1 Unit tests
  describe('Auth helpers', () => {
    it('getAuthenticatedUser returns orgId from primary membership');
    it('getAllOrganizationMemberships returns all memberships');
    it('requireMembershipIn allows access to member orgs');
    it('requireMembershipIn denies access to non-member orgs');
    it('requireOwner returns true only for brunoalmeida23111996@gmail.com');
  });

  // 2.5.2 Integration tests
  describe('API routes with org context', () => {
    it('POST /api/crm/contacts rejects body.organizationId (mass-assignment)');
    it('GET /api/crm/contacts filters by user.organizationId');
    it('POST /api/whatsapp/templates requires admin role in org');
    it('Cross-tenant: orgA user cannot access orgB contacts');
  });

  // 2.5.3 RLS tests with real DB
  describe('RLS policies (real PostgreSQL)', () => {
    it('Tenant A cannot SELECT Tenant B contacts');
    it('Tenant A cannot INSERT with Tenant B organizationId');
    it('Tenant A cannot UPDATE Tenant B records');
    it('Tenant A cannot DELETE Tenant B records');
    it('Empty app.current_org returns zero rows (fail-closed)');
    it('FORCE RLS blocks table owner bypass');
  });

  // 2.5.4 Fail-closed tests
  describe('Fail-closed scenarios', () => {
    it('No session → 401 on all protected routes');
    it('Session but no org membership → 401/403');
    it('Invalid orgId in cookie → denied by RLS');
    it('Role escalation prevented (member cannot admin)');
  });

  // 2.5.5 Cross-tenant isolation
  describe('Cross-tenant isolation', () => {
    it('Three tenants (A/B/C) with users Owner/Admin/Agent/Viewer');
    it('Each role permission matrix enforced per tenant');
    it('No data leakage between tenants');
  });

  // 2.5.6 OpenBSP compatibility
  describe('OpenBSP non-regression', () => {
    it('Connect endpoint works with org context');
    it('Status endpoint retrieves verifyToken from DB only');
    it('Callback uses DB verify_token, not frontend');
    it('Refresh-token scoped to organization');
    it('Webhook idempotency + HMAC verified');
  });
});
```

### 2.5.2 Comandos de Validação

```powershell
# TypeScript
npx tsc --noEmit

# ESLint
npx eslint . --ext .ts,.tsx

# Jest
npx jest --testPathPattern="fase2|multi-tenant|rls" --verbose

# Build
npm run build

# Playwright E2E (se disponível)
npx playwright test --project=chromium
```

---

## 2.6 Cronograma de Execução

### Semana 1: Auditoria e Documentação ✅ CONCLUÍDA
- [x] FASE_2_ESTADO_ATUAL.md
- [x] FASE_2_PLANO_ATUALIZADO.md
- [x] Background agent audit completo

### Semana 2: Roles e Permissões Granulares
- [ ] Criar helper `requireRole` em `src/lib/auth.ts`
- [ ] Aplicar em rotas admin sensíveis
- [ ] Testes unitários de permissão

### Semana 3: RLS Hardening + Testes Reais
- [ ] Verificar `app.current_org` vs `app.current_org_id`
- [ ] Testes RLS com banco real (Supavisor pooling)
- [ ] Testes fail-closed com 3 tenants

### Semana 4: API Keys + Audit Logs
- [ ] Migration para modelos ApiKey + AuditLog
- [ ] Endpoints admin para gerenciar API keys
- [ ] Middleware de autenticação via API key

### Semana 5: Testes Completos + OpenBSP Compat
- [ ] Executar suite completa fase2-multi-tenant.test.ts
- [ ] Validar não-regressão OpenBSP (7 endpoints)
- [ ] Cross-tenant isolation tests
- [ ] TypeScript + ESLint + Build clean

---

## 2.7 Limites de Produção (Seções 16-17 do f238)

| Ambiente | Autonomia |
|----------|-----------|
| **Local (Docker/WSL2)** | ✅ Total — migrations, seeds, testes, builds |
| **DEV Supabase** | ⚠️ Config externa — PAM não propaga senha, rotação manual |
| **Produção Supabase** | 🔒 **Human gate** — migration 016, RLS integrations, schema changes |
| **Hostinger Deploy** | ✅ Auto-deploy main branch (após CI verde) |
| **Meta/WhatsApp** | 🔒 **Human gate** — WABA ID, number registration, Facebook Login review |

---

## 2.8 Critérios de Aceitação (Seção 18 do f238)

- [ ] ✅ Todas as organizations auditadas
- [ ] ✅ Membership validado (roles consistentes)
- [ ] ✅ FORCE RLS confirmado em 21 tabelas
- [ ] ✅ Policies fail-closed verificadas
- [ ] ⏳ Cross-tenant testado (3 tenants A/B/C)
- [ ] ✅ OpenBSP compatível (7 endpoints validados)
- [ ] ⏳ Testes executados (unit + integration + RLS real + fail-closed + Playwright)
- [ ] ⏳ TypeScript 0 errors, ESLint 0 warnings, Build clean

---

## 2.9 Relatório Final (Seção 19 do f238) — Entregáveis

Ao final da FASE 2, produzir:

| Seção | Conteúdo |
|-------|----------|
| **A. Recursos** | Agents, MCPs, skills, plugins, CLIs descobertos e utilizados |
| **B. Organizations** | Lista completa, memberships, roles por org |
| **C. RBAC** | Matriz de permissão, helpers implementados, testes |
| **D. RLS** | 21 tabelas, policies, fail-closed, pooling validation |
| **E. Routes** | 69+ rotas auditadas, auth/membership/org/role/RLS/errors |
| **F. Testes** | Suite completa, resultados, coverage |
| **G. OpenBSP** | Não-regressão confirmada em 7 endpoints |
| **H. Pendências** | Migration 016, RLS integrations, ações humanas externas |

---

## 2.10 Próxima Ação Imediata

> **Comece pela FASE 2.1.3 — Implementar Permissões Granulares**
> 
> 1. Criar `requireRole` helper em `src/lib/auth.ts`
> 2. Aplicar em `/api/admin/ai-config`, `/api/admin/schema/diff`, `/api/admin/tasks`
> 3. Criar testes unitários
> 4. Executar `npm run test` e validar

**Não modificar:** schema.prisma, migrations, endpoints OpenBSP, middleware.ts sem validação prévia.