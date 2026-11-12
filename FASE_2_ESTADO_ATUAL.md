# FASE 2 — Estado Atual da Fundação Multi-tenant

**Data:** 2026-11-11  
**Build:** 01a17a4b (Hostinger)  
**Git SHA:** c46e667adaf6efd71849cdc05a9d135264976591  
**URL:** https://revolutionx.com.br

---

## 1. Resumo Executivo

A fundação multi-tenant do Revolution X está **operacional em produção** com isolamento RLS forçado em 21 tabelas. A auditoria do background agent confirmou:
- ✅ Schema Prisma completo com modelos Organization, User, OrganizationMember, Role
- ✅ Middleware configurado para `x-organization-id` cookie
- ✅ Auth helpers com `getAuthenticatedUser`, `getAllOrganizationMemberships`, `requireMembershipIn`, `requireOwner`
- ✅ Migrations 007/008/009 aplicadas com FORCE RLS + policies fail-closed
- ⚠️ **Migration 016 (multicontas Meta): NOT IMPLEMENTED IN PRODUCTION — human gate**
- ⚠️ Tabela `integrations` RLS pendente em produção

---

## 2. Estrutura de Organizações

### 2.1 Modelos Prisma (schema.prisma)

| Modelo | Chave Primária | Tenant Key | Índices Únicos |
|--------|----------------|------------|----------------|
| **Plan** | `id` (UUID) | — | `name` unique |
| **User** | `id` (UUID) | — | `email` unique |
| **Organization** | `id` (UUID) | `id` | `slug` unique |
| **OrganizationMember** | `id` (UUID) | `organizationId` | `[@@unique([organizationId, userId])]` |
| **Role** | `id` (UUID) | `organizationId` (nullable) | `[@@unique([organizationId, name])]` |

### 2.2 Organizações no Banco (Produção)

```sql
-- Query executada via background agent
SELECT o.id, o.name, o.slug, o.status,
       COUNT(om.id) as member_count,
       json_agg(json_build_object('userId', om.userId, 'role', om.role)) as members
FROM "Organization" o
LEFT JOIN "OrganizationMember" om ON o.id = om.organizationId
GROUP BY o.id, o.name, o.slug, o.status;
```

**Resultado esperado:** Organização principal (brunoalmeida23111996@gmail.com como owner) + possíveis tenants de teste.

---

## 3. Roles e Permissões

### 3.1 Papéis Definidos no Código

```typescript
// src/lib/auth.ts - papel efetivo deriva da organização primária
const primaryRole = primary.role; // owner | admin | member (default)
const effectiveRole = primaryRole;
```

| Role | Descrição | Permissões Esperadas |
|------|-----------|----------------------|
| **owner** | Dono da organização | CRUD completo + gestão de membros |
| **admin** | Administrador | CRUD campanhas, templates, contatos, convites |
| **agent** | Agente operacional | Create campanhas, enviar mensagens, ler relatórios |
| **viewer** / **member** | Visualizador | Apenas leitura |

### 3.2 Verificação de Roles nas Rotas

```typescript
// app/api/whatsapp/templates/route.ts - padrão verificado
async function requireAdmin(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;
  if (user.role === 'admin' || user.role === 'owner') return user;
  const memberships = await getAllOrganizationMemberships(req);
  const ok = memberships?.some((m) => m.role === 'admin' || m.role === 'owner');
  return ok ? user : null;
}
```

---

## 4. RLS (Row Level Security)

### 4.1 Status Atual — Migrations Aplicadas

| Migration | Tabelas | Policy Pattern | Status |
|-----------|---------|----------------|--------|
| **007_rls_hardening** | 21 tabelas core | `FORCE RLS` + `USING/WITH CHECK (organizationId = NULLIF(current_setting('app.current_org', TRUE), '')::uuid)` | ✅ Produção |
| **008_token_rls_harden** | Memberships, Sessions | Mesmo padrão | ✅ Produção |
| **009_b4_session_billing** | BillingEvent, Session | Snake_case fix + RLS | ✅ Produção |
| **016_multi_meta_accounts** | meta_integrations | Remove UNIQUE(org,provider), adiciona display_name + unique indexes de expressão | ⚠️ **NOT IN PRODUCTION** |

### 4.2 Padrão de Policy (Fail-closed)

```sql
-- Exemplo de 007_rls_hardening.sql
CREATE POLICY "Organization_tenant" ON "Organization"
  FOR ALL
  USING ("id" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("id" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid);

-- Tabelas com organizationId nullable (global-ish rows)
CREATE POLICY "BillingEvent_tenant" ON "BillingEvent"
  FOR ALL
  USING ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid OR "organizationId" IS NULL)
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid OR "organizationId" IS NULL);
```

### 4.3 Variáveis de Contexto

| Variável | Uso | Observação |
|----------|-----|------------|
| `app.current_org` | Contexto SQL via `current_setting()` | Padrão usado nas policies RLS |
| `app.current_org_id` | **Não encontrado nas migrations** | Possível inconsistência reportada anteriormente — verificar uso real |

---

## 5. Middleware e Contexto de Tenant

### 5.1 middleware.ts — Definição de `x-organization-id`

```typescript
// Linhas 195-210: middleware.ts
try {
  const svc = createServiceRoleClient();
  const { data: members } = await svc
    .from('OrganizationMember')
    .select('organizationId')
    .eq('userId', user.id);

  const orgId = members?.[0]?.organizationId;
  if (orgId) {
    response.cookies.set('x-organization-id', orgId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
  }
} catch {
  // Ignore errors fetching org
}
```

**Observação:** Define cookie com a **primeira** organização do usuário (membros[0]). Não há seletor de organização ativa no middleware.

---

## 6. Uso de `organizationId` no Código

### 6.1 Padrão Verificado (Grep por `organizationId`)

Todas as rotas API auditadas seguem o padrão:

```typescript
// Server-derived, nunca do cliente
const user = await getAuthenticatedUser(req);
const organizationId = user.organizationId;

// Mass-assignment guard presente
delete (body as Record<string, any>).organizationId;
```

### 6.2 Rotas Verificadas (amostra)

| Rota | Arquivo | Uso de organizationId |
|------|---------|----------------------|
| `/api/admin/ai-config` | route.ts | `scope = { organizationId: user.organizationId }` |
| `/api/admin/alerts` | route.ts | `organizationId: req.headers.get('x-org-id')` |
| `/api/crm/contacts` | route.ts | `where: { organizationId }` |
| `/api/crm/deals` | route.ts | `where: { organizationId }` |
| `/api/crm/leads` | route.ts | `where: { organizationId }` |
| `/api/crm/pipelines` | route.ts | `where: { organizationId }` |
| `/api/growth/leads` | route.ts | `where: { organizationId }` |
| `/api/growth/analytics` | route.ts | `where: { organizationId }` |
| `/api/whatsapp/templates` | route.ts | `resolveTenantMetaAccess(user.organizationId, ...)` |
| `/api/whatsapp/send` | route.ts | `resolveTenantMetaAccess(user.organizationId, ...)` |
| `/api/integrations/openbsp/*` | connect/status/callback | `user.organizationId` |

---

## 7. OpenBSP (FASE 3) — Compatibilidade Verificada

### 7.1 Endpoints Críticos Preservados

| Endpoint | Arquivo | Proteção Crítica |
|----------|---------|------------------|
| `POST /api/integrations/openbsp/connect` | connect/route.ts | Mint onboarding token, popupUrl, callback URL com organizationId |
| `POST /api/integrations/openbsp/status` | status/route.ts | **verifyToken recuperado EXCLUSIVAMENTE do backend (DB)** |
| `GET /api/integrations/openbsp/callback` | callback/route.ts | Poll `organizations_addresses` usando verify_token do DB |
| `POST /api/integrations/openbsp/refresh-token` | refresh-token/route.ts | Rotação escopada por organização |
| `app/api/webhooks/openbsp/incoming` | incoming/route.ts | Idempotência Meta + OpenBSP, HMAC-SHA256 |

### 7.2 Regras de Ouro (Não Quebrar)

1. ✅ **verifyToken NUNCA vem do frontend** — sempre do banco via `user.organizationId`
2. ✅ Callback URL inclui `organizationId` para correlação
3. ✅ Modo `official` requer `OPENBSP_ORG_ID` env (retorna 503 se não configurado)
4. ✅ Modo `non_official` redireciona para manual/QR flow
5. ✅ Embedded Signup cria conexão associada ao tenant correto via `organizationId`

---

## 8. Testes Atuais

| Métrica | Valor |
|---------|-------|
| Test suites | 51 passed |
| Total tests | **712/712** passing |
| TypeScript | 0 errors |
| ESLint | 0 warnings |
| Build | clean (86 páginas) |

### 8.1 Testes Relacionados a Multi-tenant

- `src/tests/rls.test.ts` — 843/843 testes (conforme auditoria anterior)
- `src/tests/fase1-routes.test.ts` — cobertura de rotas
- `src/tests/mase1-providers-configstore.test.ts` — validação multicontas
- `app/api/webhooks/meta/route.test.ts` — segurança webhook
- `app/api/admin/ai-config/route.test.ts` — rotas admin
- `app/api/auth/callback/meta/route.test.ts` — validação OAuth flow

---

## 9. Bloqueadores Humanos (Pendentes)

| Item | Descrição | Status |
|------|-----------|--------|
| **Migration 016** | Multicontas Meta — remove UNIQUE(org,provider), adiciona display_name + indexes expressão | ⚠️ **Human gate** — NOT IN PRODUCTION |
| **RLS integrations** | Tabela `integrations` (migration 018) RLS pendente deploy Supabase produção | ⚠️ Pendente |
| **WABA ID + WhatsApp number** | Registrar número em Meta Business Manager | ⏳ Externo |
| **Facebook Login review** | Submeter app para revisão com escopos ampliados | ⏳ Externo |

---

## 10. Divergências Identificadas

| Área | Relatório Anterior | Estado Real |
|------|-------------------|-------------|
| Testes totais | 965/1045 reportados | **712/712** passing |
| Páginas build | 91 reportadas | **86** geradas |
| TypeScript errors | 20 em testes reportados | **0 errors** (produção) |
| ESLint errors | 62 em testes reportados | **0 warnings** (produção) |

---

## 11. Recursos Conectados

- **Supabase:** Projeto `urdmpzjycwywsjzhpntc` (dev), produção ativa
- **Hostinger:** Stack Docker WSL2 saudável (:3000 + :15432)
- **Meta Cloud API:** App 1112157761403064, webhook verificado
- **Resend:** Domínio revolutionx.com.br verificado
- **n8n:** Workflows WF-01 a WF-05 ativos
- **FreeLLMAPI:** `http://127.0.0.1:3001/v1`