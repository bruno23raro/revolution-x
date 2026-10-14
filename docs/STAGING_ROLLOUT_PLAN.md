# Plano de Rollout para Staging — Missão 5g

## Sequência de Aplicação

### Pré-requisitos (todos atendidos)

- [x] `withUserContext` em `auth.ts` (getAuthenticatedUser + getAllOrganizationMemberships)
- [x] `withUserContext` em `callback/meta/route.ts`
- [x] `withTenantContext` em `crmRepoReal.ts` + `productRepoReal.ts` + `webhooks/meta/route.ts`
- [x] `middleware.ts` usa `createServiceRoleClient()`
- [x] Rotas forgot-password / reset-password / verify-email / resend-verification implementadas
- [x] Interface de email pluggável (`src/lib/email.ts`)
- [x] 15 novos testes de segurança (`src/tests/auth-security.test.ts`)

### Passos

1. **Backup do schema atual**
   ```bash
   supabase db dump -f backup-pre-007.sql
   ```

2. **Aplicar migration 007 em staging** (tenant RLS hardening)
   ```bash
   supabase migration up --db-url <staging-db-url>
   ```

3. **Testar CRM em staging**
   - Criar organização de teste + membro
   - CRUD completo de contacts/leads/deals/pipelines/products
   - Verificar isolamento multi-tenant (org A não vê org B)

4. **Aplicar migration 008 em staging** (user-scoped tokens)
   ```bash
   supabase migration up --staging-db-url
   ```

5. **Testar fluxos de autenticação em staging**
   - Register → User_self_write permite INSERT
   - Login → User_self permite SELECT
   - Forgot password → PasswordResetToken user-scoped
   - Reset password → token validation + password update
   - Verify email → EmailVerificationToken user-scoped
   - Resend verification → regeração de token

6. **Aplicar migration 009 em staging** (B4 RLS correction: Session + BillingEvent)
   ```bash
   supabase migration up --staging-db-url
   ```
   **Correção crítica de segurança (B4):**
   - `Session` re-escopada para usuário (app.current_user_id) -- elimina leak
     cross-tenant onde sessões com organizationId=NULL eram visíveis a todos.
   - `BillingEvent` escopo estrito por tenant (app.current_org) -- eventos órfãos
     (organizationId=NULL após DELETE da org) fecham fail-closed em vez de abrir.
   - `Role` inalterado (NULL-permissivo, intencional para roles globais).
   - Validar com `src/tests/b4-rls.test.ts` antes de prosseguir.

7. **Testar webhook Meta**
   - Configurar integração Meta em staging
   - Simular webhook e verificar processamento

8. **Validar middleware**
   - Usuário autenticado recebe cookie x-organization-id
   - Usuário sem membership não recebe cookie

## Critérios de Interrupção (Rollback)

- Qualquer rota CRM retornando 403/500 após 007
- Login/register falhando após 008
- Webhook Meta parando de funcionar
- Erros de cast UUID quando GUC app.current_org está vazio

## Rollback

```bash
supabase db restore -f backup-pre-007.sql --db-url <staging-db-url>
```

## Migrations Não Aplicadas em Produção

- MIGRATION 007 APLICADA EM PRODUÇÃO: NÃO
- MIGRATION 008 APLICADA EM PRODUÇÃO: NÃO
