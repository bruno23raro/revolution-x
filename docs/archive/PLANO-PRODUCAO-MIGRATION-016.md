# PLANO-PRODUCAO-MIGRATION-016.md — Migration 016 no Supabase de Produção

**Data**: 2026-10-26 | **Projeto**: revolution-x-saas | **Migration**: 016 (multi-multi-accounts)

---

## ⚠️ AVISO DE SEGURANÇA

Este documento descreve o procedimento para aplicar a Migration 016 no ambiente de **produção** do Supabase. **A execução desse plano só deve ocorrer após:**

1. **Backup completo** do banco de produção verificado
2. **Ambiente de staging** testado com a migration (via TEST_DATABASE_URL)
3. **Autorização explícita** para alterações de produção
4. **Rollback plan** preparado

**Regra absoluta**: Nunca execute DDL/migration contra produção sem as três condições acima verificadas por escrito.

---

## 1. Backup Obrigatório antes da Execução

### 1.1. Exportar dump do banco de produção

```bash
# Usando a DATABASE_URL de produção (NUNCA use credentials diretas)
pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-privileges \
  --format=custom \
  --file=/tmp/revolution_x_production_backup_$(date +%Y%m%d_%H%M%S).dump
```

**Arquivos essenciais do backup:**
- `revolution_x_production_backup_*.dump` — dump binário completo
- **Verificar no painel do Supabase** que o backup foi gerado com sucesso

### 1.2. No painel do Supabase (hPanel)

1. Acesse https://supabase.com/dashboard
2. Selecione o projeto `urdmpzjycwywsjzhpntc` (ou o nome do projeto de produção)
3. Vá em **Settings → Data API** ou **Backup**
4. Clique em **Backup now** (se disponível no plano)
5. Aguarde conclusão e faça download do backup

**Importante**: O plano do Hostinger/Supabase pode ter limitação de backup automático. Confirmar antes.

---

## 2. Como Aplicar a Migration no Supabase de Produção

### 2.1. Preparar a environment

```bash
# NUNCA use o DATABASE_URL de produção diretamente se não tiver certeza
# Verifique se a URL começa com postgresql:// e aponta para o Supabase AWS
# A DATABASE_URL atual é: postgresql://postgres.ardpabjoepzhkpmkgwgu:MWf4HWz66Vx1EMMw@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

### 2.2. Aplicar migration via Prisma

```bash
# A migration 016 já existe no supabase/migrations/
# Vamos aplicá-la usando o prisma migrate deploy

# Primeiro, garantir que o DATABASE_URL aponta para produção (já está configurado)
# Segundo, verificar se há migrations pendentes
npx prisma migrate status

# Aplicar migrações pendentes
npx prisma migrate deploy
```

**OU via SQL direto no painel SQL Editor:**

1. No painel do Supabase, vá em **SQL Editor**
2. Crie uma nova query com o conteúdo de `supabase/migrations/016_multi_meta_accounts.sql`
3. Execute passo a passo, observando os logs

** Conteúdo da migration 016 (resumo):**
- `ALTER TABLE meta_integrations ADD COLUMN IF NOT EXISTS display_name TEXT;`
- `UPDATE meta_integrations SET display_name = 'Página ' || meta_page_id WHERE display_name IS NULL AND meta_page_id IS NOT NULL;`
- `UPDATE meta_integrations SET display_name = 'Nº ' || phone_number_id WHERE display_name IS NULL AND meta_page_id IS NULL AND phone_number_id IS NOT NULL;`
- `ALTER TABLE meta_integrations DROP CONSTRAINT IF EXISTS uq_meta_integrations_org_provider;`
- `ALTER TABLE meta_integrations DROP CONSTRAINT IF EXISTS meta_integrations_organization_id_provider_key;`
- `CREATE UNIQUE INDEX IF NOT EXISTS uq_meta_integrations_account ON meta_integrations (organization_id, provider, coalesce(meta_page_id, phone_number_id, instagram_account_id));`
- `CREATE UNIQUE INDEX IF NOT EXISTS uq_meta_integrations_page ON meta_integrations (organization_id, provider, meta_page_id);`

---

## 3. Como Validar Cada Alteração no Supabase Dashboard

### 3.1. Verificar coluna display_name

1. No painel do Supabase, vá em **SQL Editor**
2. Execute: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'meta_integrations';`
3. Confirme que `display_name` aparece como `character varying`

### 3.2. Verificar constraint removida

1. No painel do Supabase, vá em **SQL Editor**
2. Execute: `SELECT constraint_name, constraint_type FROM information_schema.table_constraints WHERE table_name = 'meta_integrations';`
3. Confirme que `uq_meta_integrations_org_provider` e `meta_integrations_organization_id_provider_key** NÃO aparecem** (foram removidas)

### 3.3. Verificar novos índices

1. No painel do Supabase, vá em **SQL Editor**
2. Execute: `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'meta_integrations';`
3. Confirme que:
   - `uq_meta_integrations_account` existe com a expressão `coalesce(meta_page_id, phone_number_id, instagram_account_id)`
   - `uq_meta_integrations_page` existe com `meta_page_id`

### 3.4. Verificar dados existentes intactos

1. No painel do Supabase, vá em **SQL Editor**
2. Execute: `SELECT id, organization_id, provider, meta_page_id, phone_number_id, display_name, status FROM meta_integrations LIMIT 10;`
3. Confirme que todos os registros existentes continuam acessíveis e `display_name` foi preenchido onde possível (melhor esforço)

---

## 4. Como Reverter ou Mitigar Caso Something Falhe

### 4.1. Rollback Manual (usando o 016_rollback.sql)

O arquivo `supabase/migrations/016_rollback.sql` já existe no repositório e contém:

```sql
-- Rollback: remover constraint + coluna
ALTER TABLE meta_integrations DROP CONSTRAINT IF EXISTS uq_meta_integrations_org_provider;
ALTER TABLE meta_integrations DROP CONSTRAINT IF EXISTS meta_integrations_organization_id_provider_key;

-- Remover índice único por expressão
DROP INDEX IF EXISTS uq_meta_integrations_account;

-- Remover índice de suporte
DROP INDEX IF EXISTS uq_meta_integrations_page;

-- Remover coluna display_name (apaga dados!)
ALTER TABLE meta_integrations DROP COLUMN IF EXISTS display_name;
```

**Para reverter:**
1. No SQL Editor do Supabase, execute o conteúdo do `016_rollback.sql`
2. Verifique se a constraint única volta a existir (apenas uma por (org, provider))
3. Verifique se a coluna `display_name` foi removida

### 4.2. Se der erro na aplicação

1. **Não entre em pânico**
2. Execute o `016_rollback.sql` imediatamente
3. Verifique se o site ainda funciona (o app pode continuar com 1 conta por org se a constraint única ainda existir em parte)
4. Se o site quebra, entre em contato com o suporte do Supabase
5. Recupere o backup se necessário: `pg_dump` do backup feito na etapa 1

### 4.3. Mitigação

- **Cenário**: A constraint única não é encontrada pelo nome esperado
- **Ação**: As `DROP CONSTRAINT IF EXISTS` são "no-op" se a constraint não existir — o migration continua normalmente

- **Cenário**: O display_name backfill falha
- **Ação**: Os `UPDATE ... WHERE ... IS NULL` são seguros — se nenhuma linha atender à condição, nada acontece

- **Cenário**: Índice já existe
- **Ação**: `CREATE UNIQUE INDEX IF NOT EXISTS` é idempotente — se já existir, nada acontece

---

## 5. Como Confirmar que o Site Continua Funcionando após a Migration

### 5.1. Testes críticos

```bash
# 1. Build do aplicativo
npm run build

# 2. TypeScript check
npx tsc --noEmit

# 3. Todos os testes
npm test

# 4. Verificar rotas críticas funcionando
# - /api/auth/meta (OAuth)
# - /api/webhooks/meta (webhooks)
# - Login/logout de usuário
```

### 5.2. Verificação manual no navegador

1. Acesse `https://revolutionx.com.br`
2. Tente fazer login/registro
3. Verifique se as organizações ainda são acessíveis
4. Teste a conexão com Meta (se o Facebook Login estiver liberado)
5. Confirme se não há erros no console (F12)

### 5.3. Monitoramento

- Observar logs do Supabase por 24h após a migration
- Conferir se não há aumento de erros de conexão
- Verificar se novas contas Meta podem ser adicionadas (após a remoção da constraint única)

---

## 6. Comandos Exatos e Checklist Passo a Passo

### ✅ Checklist Pré-Aplicação

- [ ] **Backup verificado** — dump do banco de produção em `/tmp/revolution_x_production_backup_*.dump`
- [ ] **Teste em ambiente isolado** — migration aplicada via TEST_DATABASE_URL e todos testes passing (578/578)
- [ ] **Rollback plan documentado** — 016_rollback.sql pronto
- [ ] **Janela de manutenção** — período de baixa atividade no site
- [ ] **Equipe notificada** — todos os devs avisados sobre a migration
- [ ] **Rollback testado** — executado em ambiente de staging e funciona

### ✅ Checklist Execução

- [ ] Acessar SQL Editor do Supabase produção
- [ ] Executar migration 016 (conteúdo de `016_multi_meta_accounts.sql`)
- [ ] Validar `display_name` column criada
- [ ] Validar constraints antigas removidas
- [ ] Validar novos índices criados
- [ ] Verificar dados existentes intactos (SELECT 10 linhas)
- [ ] Rodar `npm run build` — deve passar
- [ ] Rodar `npm test` — deve passar (578/578)
- [ ] Testar no navegador — login/registro/CRM funcionando

### ✅ Checklist Pós-Aplicação (24h)

- [ ] Monitorar logs do Supabase — sem erros novos
- [ ] Conferir se novas contas Meta podem ser adicionadas
- [ ] Verificar se RLS policies ainda funcionam
- [ ] Confirmar que nenhum dado foi perdido
- [ ] Atualizar documentação se necessário

---

## 7. Segurança e Conformidade

### 7.1. Regras Never Violate

- [ ] **NUNCA** usar `DATABASE_URL` de produção como `TEST_DATABASE_URL`
- [ ] **NUNCA** executar `git reset --hard`, `git clean -fd` ou equivalents destrutivos
- [ ] **NUNCA** executar `DROP COLUMN` sem backup confirmado
- [ ] **NUNCA** aplicar migration sem ter rollback planejado e testado

### 7.2. O Que Esta Migration Muda

| Alteração | Impacto | Risco |
|-----------|---------|-------|
| `display_name` column | Adicional, nullable, backfill de melhor esforço | ⬇️ Nenhum (apenas adiciona dado opcional) |
| Remoção constraint `UNIQUE(organization_id, provider)` | Permite múltiplas contas Meta por organização | ⚠️ Médio — permite 2+ páginas/números pela mesma org |
| Índices únicos expression | Apenas performance/estrutura, não afeta dados | ⬇️ Nenhum |
| Novos índices de suporte | Apenas performance de query | ⬇️ Nenhum |

### 7.3. Quando NÃO Aplicar

- Se o site estiver em produção crítica sem janela de manutenção
- Se não houver backup verificado
- Se os testes em ambiente de staging falharem
- Se a equipe não concordar com a alteração

---

## Próximo Passo Imediato

**Não executar a migration na produção ainda.**

1. Confirmar que o backup de produção foi feito e está acessível
2. Aplicar a migration 016 no ambiente de teste usando `TEST_DATABASE_URL` do `.env.test`
3. Verificar se todos os testes (578/578) ainda passam no ambiente de teste
4. Apenas então, se tudo correr bem, planejar a aplicação na produção com a janela de manutenção

**Comando de verificação no teste:**
```bash
# Aplicar migration no banco de teste (usando TEST_DATABASE_URL)
npx prisma migrate deploy --preview-feature  # sobre o TEST_DATABASE_URL

# Ou via SQL no painel do Supabase teste
# Executar o conteúdo de 016_multi_meta_accounts.sql

# Validar testes
npm test  # deve manter 578/578 passing
```

---

*Este plano deve ser seguido rigorosamente. A aplicação na produção só ocorre após todas as condições de segurança serem atendidas e homologadas.*