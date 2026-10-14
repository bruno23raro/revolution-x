# Fase 6 — Relatório Final: Missão 5f (MIDDLEWARE + PREPARAÇÃO PRODUÇÃO)

**Data:** 2026-10-13
**Branch:** main | **HEAD:** d99d9bf
**Banco de dados:** NENHUMA alteração em produção
**Migrations 007/008 aplicadas:** NÃO

---

## Sumário Executivo

| Fase | Objetivo | Status |
|------|----------|--------|
| 1 — Estado real | Confirmar correções 5d + estado Git | ✅ CONCLUÍDO |
| 2 — Corrigir middleware | Resolver incompatibilidade RLS + Edge Runtime | ✅ CORRIDO |
| 3 — Auditoria de rotas | Verificar dependência de x-organization-id | ✅ CONCLUÍDO |
| 4 — Ordem de migração | Definir sequência segura de aplicação | ✅ DOCUMENTADO |
| 5 — Testar | Validações pós-correção | ✅ APROVADO |
| 6 — Relatório | Documento final | ✅ ESTE ARQUIVO |

---

## Fase 1 — Estado Real Confirmado

| Verificação | Resultado |
|-------------|-----------|
| Instagram fix (igRes.json) | ✅ Presente em linha 106 |
| withUserContext em auth.ts | ✅ 2 chamadas (getAuthenticatedUser + getAllOrganizationMemberships) |
| withUserContext em callback/meta | ✅ 1 chamada |
| Testes 64/64 | ✅ Passam |
| Typecheck | ✅ 0 erros |
| Lint | ✅ 0 warnings |

---

## Fase 2 — Correção do Middleware

### Problema identificado

`middleware.ts` consultava `OrganizationMember` via Supabase com anon key (RLS-subject).
Após a aplicação da migration 007, a política `OrganizationMember_tenant` exige o GUC
`app.current_org`, que não pode ser definido no Edge Runtime do Next.js (middleware não
tem acesso a `set_config`). Resultado: query retorna 0 linhas, cookie `x-organization-id`
nunca é setado.

### Solução implementada

```ts
// ANTES (quebrava após 007):
const { data: member } = await supabase
  .from('OrganizationMember').select('organizationId')
  .eq('userId', user.id).maybeSingle();

// DEPOIS (funciona em qualquer estado de RLS):
const svc = createServiceRoleClient();
const { data: member } = await svc
  .from('OrganizationMember').select('organizationId')
  .eq('userId', user.id).maybeSingle();
```

### Por que é seguro

- A identidade do usuário já foi validada por Supabase Auth antes do middleware alcançar esta linha
- O serviço retorna apenas `organizationId` (campo não sensível)
- O serviço role neste contexto é uma consulta de leitura unilateral — não expõe tokens criptografados nem permite escrita
- O cookie resultante (`x-organization-id`) nunca é lido em nenhuma rota de produção (ver Fase 3)

### Arquivo alterado

| Arquivo | Alteração |
|---------|-----------|
| `middleware.ts` | Import de `createServiceRoleClient`; query usa serviço em vez de anon |

---

## Fase 3 — Auditoria de Rotas Dependentes

### x-organization-id: consumo

Busca por `x-organization` em todo o TypeScript fonte (excluindo testes):

```
0 ocorrências
```

O cookie é **apenas definido no middleware, nunca lido**. Nenhuma rota de produção o consome
para decisão de autorização ou acesso a dados.

### Rotas que consultam OrganizationMember via anon key (após 007)

Antes da correção, apenas `middleware.ts`. Após a correção: **zero rotas** usam anon key para
consultar `OrganizationMember`. Todas as rotas de API usam `getAuthenticatedUser()` (via
`withUserContext`) ou `supabase.auth.*` (que não toca em tabelas RLS).

### Rotas auditadas (produção, excluindo stubs)

| Rota | Autenticação | Organização | RLS-safe após 007? |
|------|-------------|-------------|-------------------|
| GET /api/crm/contacts | getAuthenticatedUser | DB membership | ✅ |
| POST /api/crm/contacts | getAuthenticatedUser | DB membership | ✅ |
| GET /api/crm/deals | getAuthenticatedUser | DB membership | ✅ |
| POST /api/crm/deals | getAuthenticatedUser | DB membership | ✅ |
| GET /api/crm/leads | getAuthenticatedUser | DB membership | ✅ |
| POST /api/crm/leads | getAuthenticatedUser | DB membership | ✅ |
| GET /api/crm/pipelines | getAuthenticatedUser | DB membership | ✅ |
| POST /api/crm/pipelines | getAuthenticatedUser | DB membership | ✅ |
| GET /api/products | getAuthenticatedUser | DB membership | ✅ |
| POST /api/products | getAuthenticatedUser | DB membership | ✅ |
| GET /api/integrations/meta | getAuthenticatedUser | DB membership | ✅ |
| DELETE /api/integrations/meta | getAuthenticatedUser | DB membership | ✅ |
| POST /api/auth/login | supabase.auth | N/A (não consulta OrgMember) | ✅ |
| POST /api/auth/register | supabase.auth | N/A | ✅ |
| GET /api/auth/callback/meta | getAuthenticatedUser + withUserContext | DB membership | ✅ |
| POST /webhooks/meta | withTenantContext | DB integration | ✅ |
| middleware.ts | service role (correção) | DB membership | ✅ |

### Rotas stub (não implementadas, retornam 503)

| Rota | Status |
|------|--------|
| POST /api/auth/forgot-password | stub — email provider pending |
| POST /api/auth/reset-password | stub — database_not_configured |
| POST /api/auth/resend-verification | stub — email provider pending |
| POST /api/auth/verify-email | stub — database_not_configured |

Nenhuma rota stub consulta `PasswordResetToken` or `EmailVerificationToken` diretamente.
As políticas RLS do 008 são defensivas e não impactam o funcionamento atual.

---

## Fase 4 — Ordem de Migração Segura

### Sequência recomendada para staging → produção

1. **Pré-requisitos (já atendidos)**
   - `getAuthenticatedUser()` usa `withUserContext` ✅
   - `crmRepoReal.ts` usa `withTenantContext` ✅
   - `productRepoReal.ts` usa `withTenantContext` ✅
   - `webhooks/meta/route.ts` usa `withTenantContext` ✅
   - `middleware.ts` usa service role ✅

2. **Aplicar migration 007 em staging**
   - Hardening de todas as tabelas tenant-scoped (Organization, Contact, Lead, Deal,
     Pipeline, Product, Media, Post, CalendarEvent, Video, Message, Report, Subscription,
     Usage, BillingEvent, Session, Role, meta_integrations, webhook_events)
   - Verificar que todas as rotas CRM funcionam (usam `withTenantContext` com GUC pinado)

3. **Aplicar migration 008 em staging**
   - User table: `User_self` + `User_self_write`
   - PasswordResetToken + EmailVerificationToken: user-scoped
   - Verificar que login/register continuam funcionando (Supabase Auth não toca nessas tabelas)

4. **Testar fluxos críticos em staging**
   - Login → verify que `getAuthenticatedUser` retorna dados corretamente
   - Registrar novo usuário → verificar que não há erro de RLS
   - Acessar rotas CRM → verificar isolamento por tenant
   - Webhook Meta → verificar processamento com contexto de tenant

5. **Repetir em produção** (janela de manutenção)
   - Aplicar 007 primeiro, validar 30 min
   - Aplicar 008, validar 30 min
   - Monitorar logs de RLS violations

6. **Rollback plan**
   - Se falhar após 007: reverter para backup de schema anterior
   - Se falhar após 008: verificar se alguma nova rota consulta token tables diretamente

---

## Fase 5 — Validações Pós-Correção

| Verificação | Comando | Resultado |
|-------------|---------|-----------|
| Full suite | `npm test -- --no-coverage` | **64/64 PASS** |
| TypeScript | `npm run typecheck` | **0 erros** |
| ESLint | `npm run lint` | **0 warnings** |
| Build | `npm run build` | **OK (33 páginas)** |

### Cobertura de testes por categoria

| Categoria | Arquivo | Tests | Tipo |
|-----------|---------|-------|------|
| Auth unitário | src/lib/auth.test.ts | 8 | Unitário (mocks) |
| Tenant isolation (RLS) | src/tests/rls.test.ts | 10 | PostgreSQL local |
| Token RLS (user-scope) | src/tests/token-rls.test.ts | 20 | PostgreSQL local |
| Meta IDOR | src/tests/meta-idor.test.ts | 9 | Unitário (mocks) |
| Prisma + RLS real | src/tests/prisma-tenant.test.ts | 3 | PostgreSQL local |
| Encryption | src/lib/encryption.test.ts | 4 | Unitário |
| Tenant service | src/lib/tenant.test.ts | 1 | Unitário |
| CRM validation | src/lib/crmValidation.test.ts | 4 | Unitário |
| WhatsApp processor | src/integrations/meta/whatsappProcessor.test.ts | 5 | Unitário (mocks) |

---

## Fase 6 — Relatório Final

### Arquivos alterados nesta missão (5f)

| Arquivo | Alteração | Motivo |
|---------|-----------|--------|
| `middleware.ts` | MODIFICADO | Usar service role client para query OrganizationMember |
| `docs/PHASE6_MISSION5F_REPORT.md` | **NOVO** | Este arquivo |
| `docs/PHASE6_MISSION5D_REPORT.md` | ATUALIZADO | Bug igRes.json documentado |
| `docs/PHASE3_PROD_ROLE_MIGRATION_PLAN.md` | ATUALIZADO | Bug igRes.json mencionado |

### Causa raiz do bloqueio do middleware

Migration 007 adiciona política RLS `OrganizationMember_tenant` exigindo `app.current_org`.
O middleware (Edge Runtime) não tem capacidade de definir GUCs PostgreSQL. A query via
anon key retornava 0 linhas após a aplicação da migração, impedindo o set do cookie
`x-organization-id`.

### Solução implementada

Trocar o cliente Supabase (anon key) pelo cliente service role na query
`OrganizationMember` dentro do middleware. A identidade do usuário já foi validada
pelo Supabase Auth upstream; o serviço role aqui é usado apenas para ler um campo
não sensível (`organizationId`) de uma linha que pertence exclusivamente ao usuário.

### Riscos avaliados

| Risco | Severidade | Mitigação |
|-------|------------|-----------|
| Service role expõe dados sensíveis | Baixa | Consulta limitada a `organizationId` (campo não sensível) de linha filtrada por `userId` do usuário autenticado |
| Service role permite escrita | Baixa | Código atual usa apenas `.select()` — apenas leitura |
| Cookie `x-organization-id` legado | Baixa | Ninguém lê este cookie; remoção futura pode ser planejada |

### Estado do projeto

| Aspecto | Status |
|---------|--------|
| Testes | 64/64 PASS |
| Typecheck | ✅ Limpo |
| Lint | ✅ Limpo |
| Build | ✅ OK |
| Middleware RLS-safe | ✅ Corrigido |
| Todas as rotas de API RLS-safe | ✅ Confirmado |
| Migrations 007/008 aplicadas | Não (awaiting staging test) |

### Bloqueios externos (ação do usuário necessária)

1. **Aplicar migration 007 em staging** — validação de que rotas CRM funcionam
2. **Aplicar migration 008 em staging** — validação de que login/register não quebram
3. **Implementar rotas de forgot-password / reset-password / verify-email** — stubs atuais
   retornam 503; quando implementadas, usar `withUserContext` para queries nas token tables
4. **Deploy para produção** — após validação em staging, aplicar 007 então 008 em produção

### Classificação final

**B — PRONTO PARA STAGING**

Todos os blocos locais foram resolvidos. O projeto está tecnicamente pronto para ser
implantado em ambiente de staging, onde as migrations 007 e 008 podem ser aplicadas
e validadas com fluxos reais de usuário antes do deploy em produção.

---

## BANCO ALTERADO: NÃO
## MIGRATION 007 APLICADA EM PRODUÇÃO: NÃO
## MIGRATION 008 APLICADA EM PRODUÇÃO: NÃO
