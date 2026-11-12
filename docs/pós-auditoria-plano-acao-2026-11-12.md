# Plano de Ação Pós-Auditoria Supabase 2026-11-12

## 📋 Resumo Executivo

**Status Atual:**
- ✅ FASE 3.5 CONCLUÍDA - Migration 029 aplicada com sucesso em produção
- ✅ RLS em `integration_events` funcionando (IDOR corrigido)
- 🟡 Auditoria Supabase concluída - 3 projetos identificados
- 🟡 Bancos inativos sem acesso (status INACTIVE)

## 🎯 Prioridades de Ação

### 1. MIGRAÇÕES 025-027 (MEDIUM - NÃO CRÍTICO)

**Status:** Pendentes em produção

**Análise:**
- Tabelas críticas (`integration_events`, `meta_integrations`, `webhook_events`, `integrations`) **estão vazias** (0 rows)
- Migrations 025-027 podem ser aplicadas **sem risco de perda de dados**

**Recomendação:**
- **Aplicar migrations 025-027** imediatamente após backup
- As colunas `openbsp_event_id` e `external_account_id` são críticas para idempotência de webhooks

### 2. Tabelas com RLS Desativado (HIGH - Recomendado)

**Tabelas sem RLS (13):**
```
products, product_variations, warehouses, stock_balances
organizations, organization_members, roles, permissions
subscriptions, usage, billing_events, inventory_movements
```

**Ação Requerida (para segurança multi-tenant):**
```sql
-- Exemplo para organizations (CRÍTICO):
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY organizations_tenant ON organizations
  USING (id IN (SELECT id FROM organizations WHERE org_id = current_setting('app.current_org')::uuid));
```

### 3. Bancos Inativos (INFO)

**Projetos INACTIVE:**
- `supabase-fuchsia-xylophone` - Criado 2025-05-22
- `supabase-charcoal-lighthouse` - Criado 2026-09-22

**Ação:**
- Manter por enquanto - podem conter dados de desenvolvimento/teste
- Não aplicar migrações em bancos inativos

## 📊 Status Técnico Detalhado

### Produção (ardpabjoepzhkpmkgwgu)

| Recurso | Status | Comentário |
|---------|--------|------------|
| RLS `integration_events` | ✅ ATIVO | 2 policies, IDOR corrigido |
| RLS `meta_integrations` | ✅ ATIVO | 1 policy encontrada |
| RLS `webhook_events` | ✅ ATIVO | 1 policy encontrada |
| Migration 029 | ✅ CONCLUÍDA | 2026-11-12 |
| Migration 025-027 | ❌ PENDENTE | Tabelas vazias, pode aplicar |
| Tabelas com RLS | 40/64 | 62.5% |
| Dados sensíveis | ✅ PRODENTES | Nenhum dado em tables vazias |

### Bancos Inativos

| Projeto | Status | Ação |
|---------|--------|------|
| mmosryrkzbodqipdswvx | INACTIVE | Sem acesso - monitorar |
| urdmpzjycwywsjzhpntc | INACTIVE | Sem acesso - monitorar |

## 🔧 Comandos para Aplicação

### Backup Produção
```bash
# Via Supabase Dashboard ou pg_dump
pg_dump -h db.ardpabjoepzhkpmkgwgu.supabase.co -U <user> -d postgres > backup_pre_migrations_025_027.sql
```

### Aplicar Migrations 025-027
```bash
# Opção A: Via Supabase CLI
npx supabase db push --db-url $DATABASE_URL

# Opção B: Via psql
psql -h db.ardpabjoepzhkpmkgwgu.supabase.co -U <user> -d postgres -f supabase/migrations/025_schema_parity.sql
psql -h db.ardpabjoepzhkpmkgwgu.supabase.co -U <user> -d postgres -f supabase/migrations/026_external_account_id_text.sql
psql -h db.ardpabjoepzhkpmkgwgu.supabase.co -U <user> -d postgres -f supabase/migrations/027_integration_events_cols.sql
```

### Verificação Pós-Aplicação
```sql
-- Verificar colunas adicionadas
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'meta_integrations' 
AND column_name IN ('openbsp_event_id', 'external_account_id')
ORDER BY column_name;

-- Verificar políticas RLS
SELECT tablename, rowsecurity, (SELECT count(*) FROM pg_policies WHERE tablename = pg_tables.tablename) as policy_count
FROM pg_tables WHERE tablename IN ('integration_events', 'meta_integrations', 'webhook_events', 'integrations');
```

## 📅 Cronograma Recomendado

| Data | Ação | Responsável |
|------|------|-------------|
| **2026-11-12** | Backup produção | DBA |
| **2026-11-13** | Aplicar migrations 025-027 em staging | Dev |
| **2026-11-14** | Verificação staging | QA |
| **2026-11-15** | Aplicar em produção (após manutenção) | Dev/DBA |
| **2026-11-16** | Monitoramento 24h | Dev/OPS |

## 📁 Arquivos Criados

1. `docs/SUPABBASE_AUDIT_REPORT_2026-11-12.md` - Relatório completo de auditoria
2. `.claude/state/projeto_state.json` - Estado persistente do projeto
3. `pós-auditoria-plano-acao-2026-11-12.md` - Este plano de ação

## ⚠️ Riscos Identificados

1. **Migração 025-027 não aplicadas** - Schema drift entre código e produção
2. **Tabelas sem RLS** - 13 tabelas expostas sem isolamento multi-tenant
3. **Bancos inativos** - Não verificados para dados sensíveis

---

**Status Final:** ✅ FASE 3.5 COMPLETA / 🔍 AUDITORIA SUPABASE CONCLUÍDA