# Fase 3 — Plano de Migração do Papel Prisma em Produção

## Estado Atual

| Conexão | URL | Papel | SUPER? | BYPASSRLS? | Propósito |
|---------|-----|-------|--------|------------|-----------|
| **Prisma** | `DATABASE_URL` → pooler Supabase (`aws-0-sa-east-1.pooler.supabase.com`) | `postgres.ardpabjoepzhkpmkgwgu` | ❌ (proxy) | ✅ **SIM** | Leitura/escrita app |
| **Supabase-js auth** | `NEXT_PUBLIC_SUPABASE_URL` + anon key | `anon` (via pooler) | ❌ | ❌ | Client-side / browser |
| **Supabase-js server** | `NEXT_PUBLIC_SUPABASE_URL` + anon key | `anon` | ❌ | ❌ | Server API routes (RLS-subject) |

### Observações críticas

1. **O papel `postgres` do Supabase NÃO é superusuário** — é um *broker* (proxy) que conecta ao backend PostgreSQL real como `postgres`. Apesar de não ser `rolsuper = true`, ele **ainda possui `rolbypassrls = true`**. Isso significa que **todas as queries Prisma em produção ignoram RLS**, independentemente dos GUCs definidos.

2. **RLS só protege via pooler anon** — todas as rotas de API que usam `createClient()` com anon key são efetivamente protegidas por RLS. As rotas que usam `prisma.*` diretamente **não** passam por RLS.

3. **Webhooks e rotas internas** — o webhook de WhatsApp usa `withTenantContext()` + GUC, mas como o `prisma` vai pelo pooler `postgres` (BYPASSRLS), o GUC `app.current_org` **não filtra as linhas**. A segurança depende de:
   - Autorização na camada de aplicação (`getAuthenticatedUser` → membership check)
   - Isolamento por `organizationId` nos filtros de query, não por RLS

## O Que Seria Necessário para Remover BYPASSRLS do Prisma

### Opção A: Criar papel `revx_app` sem BYPASSRLS (recomendado se RLS for crítico)

```sql
-- Em produção (via Supabase SQL Editor ou migração):
CREATE ROLE revx_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
GRANT USAGE ON SCHEMA public TO revx_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO revx_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO revx_app;
-- Grant functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO revx_app;
-- Default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO revx_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO revx_app;
```

**Problemas:**
- O pooler do Supabase (`proxy-user`) é configurado para rotear conexões autenticadas como `postgres`. Não é trivial mudar isso sem reconfigurar o pooler.
- O pooler **multiplexa** conexões — cada query pode ir por uma conexão diferente, então `set_config('app.current_org', ...)` **só funciona se a query estiver no mesmo pooled connection**. O Prisma `adapter-pg` com `PrismaPg` sobre `pg.Pool` resolve isso porque `$transaction` pinna uma conexão. Queries simples fora de transação **podem** cair em conexões diferentes e perder o GUC.
- Migrations DDL precisam de BYPASSRLS/superuser — o papel `revx_app` não pode executar ALTER TABLE, CREATE INDEX, etc.

### Opção B: Manter BYPASSRLS no pooler + confiar na autorização de aplicação (estado atual)

**Recomendação deste relatório: Opção B, com mitigações.**

O motivo: a infraestrutura do Supabase (pooler multiplexado + papel `postgres` BYPASSRLS) torna a migração para RLS via app role complexa e arriscada. O custo-benefício não justifica a troca no estado atual.

## Mitigações Atuais (já implementadas)

| Mecanismo | Status | Arquivo |
|-----------|--------|---------|
| Anon key em rotas API (RLS-subject) | ✅ | `auth/callback/meta/route.ts`, `integrations/meta/route.ts` |
| Service-role ONLY onde necessário (encryption, meta upsert) | ✅ | `auth/callback/meta/route.ts` |
| GUC `app.current_org` em transações | ✅ | `webhooks/meta/route.ts` (embora BYPASSRLS ignore) |
| Membership check antes de qualquer ação | ✅ | `auth.ts:getAuthenticatedUser` |
| Token RLS user-scoped (008) | ✅ | `supabase/migrations/008_token_rls_harden.sql` |
| Prisma transacional com pin de conexão | ✅ | `prisma.ts:withTenantContextOn`, `withUserContextOn` |

## Plano de Execução (se Opção A for adotada no futuro)

1. **Fase 1 — Preparação (sem deploy)**
   - Criar migração 009: `CREATE ROLE revx_app` + grants
   - Verificar todas as funções/procedures que precisam de EXECUTE
   - Verificar extensiones (pgcrypto, pgjwt, etc.)

2. **Fase 2 — Teste em staging**
   - Apontar `DATABASE_URL` de staging para usar `revx_app`
   - Executar todas as operações CRUD
   - Confirmar que migrations ainda funcionam (requer role separada com superuser)

3. **Fase 3 — Rollout gradual**
   - Manter `postgres` BYPASSRLS para migrations (papel `supabase_admin`)
   - Trocar `DATABASE_URL` para `revx_app`
   - Monitorar por 72h
   - Manter rollback plan: reverter `DATABASE_URL` para conexão direta (sem pooler) se houver regressão

4. **Rollback**
   - `ALTER ROLE postgres BYPASSRLS;` (se aplicável ao broker)
   - Ou voltar `DATABASE_URL` para conexão direta ao banco (sem pooler)


## Achados da Missao 5d (2026-10-12)

### Correcoes de integracao
- withUserContext era definido mas NUNCA chamado; agora usado em 3 caminhos de producao:
  - src/lib/auth.ts:getAuthenticatedUser() (linha 55)
  - src/lib/auth.ts:getAllOrganizationMemberships() (linha 88)
  - app/api/auth/callback/meta/route.ts (linha 45)
- Cada chamada usa $transaction com GUC app.current_user_id transacional
- Bug adicional corrigido (2026-10-13): `pagesRes.json()` → `igRes.json()` no fetch
  da conta Instagram no callback OAuth. O campo `instagramId` ficava sempre vazio
  quando a integração possuía conta Instagram.

### Auditoria User table RLS
- User_self: SELECT-only, fail-closed quando GUC ausente
- User_self_write: ALL com USING+WITH CHECK identicos (bloqueia escrita cross-user)
- Sem column-level bypass; grants revx_test = r/postgres (apenas leitura via RLS)

### Recomendacao atualizada
Opcao B permanece valida. O custo de migracao para Opcao A continua alto
(pooler multiplexado exige pinning de conexao). As mitigacoes agora incluem
withUserContext em todos os caminhos de producao, reduzindo a superficie de risco
se BYPASSRLS for removido no futuro.
## BANCO ALTERADO: NÃO
## MIGRATION 007 APLICADA: NÃO (apenas revisão estática e testes)
## MIGRATION 008 APLICADA: SIM (somente no banco de teste local `revolution_x_rls_test`)
