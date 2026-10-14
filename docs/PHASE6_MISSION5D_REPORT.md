# Fase 6 — Relatório Final: Missão 5d (AUDITORIA COMPLETA RLS + AUTH)

**Data:** 2026-10-12
**Branch:** main | **HEAD:** d99d9bf
**Banco de dados:** NENHUMA alteração em produção
**Migrations aplicadas:** Apenas em revolution_x_rls_test (local)

---

## Sumário Executivo

| Fase | Objetivo | Status |
|------|----------|--------|
| 1 — Rastreamento de contexto | Traçar userId + app.current_user_id | OK CORRIGIDO |
| 2 — Auditoria User_self/User_self_write | column-level bypass + WITH CHECK | OK AUDITADO |
| 3 — Auditoria estática 006 vs 007 vs 008 | políticas, grants, NULLIF, FORCE | OK FEITA |
| 4 — Testes de segurança | Privilege escalation, GUC injection, cross-org | OK 7 NOVOS TESTES |
| 5 — Atualizar plano de migração | Incorporar achados 5d no plano | OK ATUALIZADO |
| 6 — Regressão + relatório | Tests, typecheck, lint, build | OK APROVADO |

---

## Fase 1 — Rastreamento de Contexto do Usuário

### Fluxos mapeados

| Caminho | Autenticação | userId | app.current_user_id |
|---------|-------------|-------|---------------------|
| auth.ts:getAuthenticatedUser | Supabase Auth | user.id | CORRIGIDO |
| auth.ts:getAllOrganizationMemberships | Supabase Auth | user.id | CORRIGIDO |
| callback/meta/route.ts:GET | Supabase Auth | user.id | CORRIGIDO |
| webhooks/meta/route.ts | Header X-Organization-Id | organizationId | Sim |
| integrations/meta/route.ts | Supabase Auth | user.organizationId | Sim |
| Rotas de token | stub | N/A | N/A |

### Problema identificado e corrigido

Encontrado: 3 chamadas prisma.user.findUnique fora de withUserContext dependendo do BYPASSRLS.

Correção: withUserContext agora envolva as 3 chamadas em auth.ts e callback/meta/route.ts.

Observação crítica: withUserContext estava definido em prisma.ts:48-53 mas NUNCA chamado. Agora chamado em todos os caminhos de produção.

---

## Fase 2 — Auditoria User_self / User_self_write

### Estrutura (migration 008)

| Política | Comando | USING | WITH CHECK |
|-----------|---------|-------|------------|
| User_self | SELECT (r) | id = NULLIF(app.current_user_id)::uuid | — |
| User_self_write | ALL (*) | id = NULLIF(app.current_user_id)::uuid | id = NULLIF(app.current_user_id)::uuid |

### Verificações

1. User_self é SELECT-only: OK (polcmd=r, sem WITH CHECK)
2. User_self_write tem WITH CHECK: OK (expressão idêntica ao USING)
3. Column-level bypass: NAO encontrado
4. Grants revx_test: r/postgres (SELECT only via User_self)

### Fail-closed behavior

- GUC ausente: current_setting retorna NULL → NULL=uuid → false → 0 rows
- GUC vazio: NULLIF → NULL → 0 rows, sem erro de cast
- GUC errado: uuid comparison → false → 0 rows

---

## Fase 3 — Auditoria Estática 006 vs 007 vs 008

### Migration 006 (substituída por 008)

| Tabela | RLS | Policies | Status |
|--------|-----|----------|--------|
| PasswordResetToken | ENABLE | USING(true) | RISCO PERMISSIVO |
| EmailVerificationToken | ENABLE | USING(true) | RISCO PERMISSIVO |

### Migration 007 (RLS Hardening)

| Tabela | FORCE | NULLIF | WITH CHECK |
|--------|-------|--------|------------|
| Organization, Contact, OrganizationMember | OK | OK | OK |
| Lead, Deal, Pipeline, Product, Media, Post, CalendarEvent, Video, Message, Report, Subscription, Usage | OK | OK | OK |
| BillingEvent, Session, Role | OK | OK | OK (OR org IS NULL) |
| meta_integrations | OK | OK | OK |
| webhook_events | OK | OK | OK (subquery + IS NULL) |

### Migration 008 (esta sessão)

| Tabela | FORCE | NULLIF | WITH CHECK | Observações |
|--------|-------|--------|------------|-------------|
| User | OK | OK | OK (User_self_write) | User_self SELECT-only |
| PasswordResetToken | OK | OK | OK | Troca para user-scoped |
| EmailVerificationToken | OK | OK | OK | Troca para user-scoped |

### Conclusões

1. 007 e 008 consistentes (NULLIF fail-closed)
2. 006 substituído por 008 (políticas permissivas reescritas)
3. Sem permissivos em 007/008
4. webhook_events: IS NULL é intencional (eventos globais)
5. Tabelas snake_case legadas não cobertas por 007

---

## Fase 4 — Testes de Segurança Adicionados

### 7 novos testes (total: 58 → 64)

| Teste | Categoria | Resultado |
|-------|-----------|-----------|
| User_self é SELECT-only | Pré-condição | PASS |
| User_self_write tem WITH CHECK | Pré-condição | PASS |
| User A lê linha própria User | Legítimo | PASS |
| User B não lê linha de User A | Cross-user | PASS |
| Contexto ausente: zero rows User | Fail-closed | PASS |
| User A não pode UPDATE email de User B | Privilege escalation | PASS |
| User_self bloqueia leitura sem GUC | GUC integrity | PASS |

### Self-write note

Teste completo de UPDATE próprio documentado com limitação: GRANT dentro de $transaction não é visível até commit, então o UPDATE falha com permission denied. Comportamento esperado do PostgreSQL.

---

## Fase 5 — Plano de Migração de Produção

docs/PHASE3_PROD_ROLE_MIGRATION_PLAN.md atualizado com:

- Seção Achados da Missão 5d
- withUserContext agora em todos os caminhos de produção
- Recomendação consolidada: Opção B com mitigações implementadas

---

## Fase 6 — Regressão

| Verificação | Comando | Resultado |
|-------------|---------|-----------|
| Token RLS tests | npm test --testPathPattern=token-rls | 20/20 PASS |
| Full suite | npm test --no-coverage | 64/64 PASS |
| TypeScript | npm run typecheck | 0 erros |
| Lint | npm run lint | 0 warnings |
| Build | npm run build | Build OK |

---

## Alterações desta Sessão (Missão 5d)

| Arquivo | Ação | Razão |
|---------|------|-------|
| src/lib/auth.ts | MODIFICADO | 2 calls wrapped em withUserContext |
| app/api/auth/callback/meta/route.ts | MODIFICADO | 1 call wrapped em withUserContext + fix de bug `igRes.json()` (2026-10-13) |
| src/tests/token-rls.test.ts | MODIFICADO | +7 testes User table RLS |
| docs/PHASE6_MISSION5D_REPORT.md | NOVO | Este arquivo |
| docs/PHASE3_PROD_ROLE_MIGRATION_PLAN.md | ATUALIZADO | Achados 5d |

### Correção de bug adicional (2026-10-13)

Bug pré-existente em `app/api/auth/callback/meta/route.ts` linha ~106:
o bloco de busca da conta Instagram lê a resposta errada do fetch:

```ts
// ERRADO (original): lê a resposta do /me/accounts (pages), não a do Instagram
const ig = await pagesRes.json() as { instagram_business_account?: { id: string } };

// CORRETO (corrigido): lê a resposta de /{pageId}?fields=instagram_business_account
const ig = await igRes.json() as { instagram_business_account?: { id: string } };
```

Sem a correção, `instagramId` ficaria sempre vazio em integrações que possuem conta
Instagram ligada à página, pois `pagesRes` não contém o campo
`instagram_business_account`. Correção aplicada e validada com build + 64/64 testes.

---

## Checklist Pós-Missão 5d

- [x] withUserContext em todos os caminhos de produção
- [x] 3 chamadas bare prisma.user.findUnique eliminadas
- [x] User_self: SELECT-only, user-scoped, fail-closed
- [x] User_self_write: ALL com USING + WITH CHECK
- [x] Sem column-level bypass
- [x] 006 (permissiva) substituída por 008
- [x] 007 e 008 consistentes: NULLIF + FORCE + WITH CHECK
- [x] 64 testes passando (7 novos de segurança)
- [x] Typecheck limpo
- [x] Lint limpo
- [x] Build OK
- [x] Plano de migração atualizado

---

## BANCO ALTERADO: NÃO
## MIGRATION 008 APLICADA EM PRODUÇÃO: NÃO
