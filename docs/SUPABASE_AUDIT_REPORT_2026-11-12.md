# Auditoria Global Supabase - 12/11/2026

## 📊 Visão Geral dos Projetos

| Projeto | ID | Nome | Região | Status |
|---------|-----|------|--------|--------|
| **Principal** | `ardpabjoepzhkpmkgwgu` | Revolution X | sa-east-1 | ✅ ACTIVE_HEALTHY |
| **Inativo 1** | `mmosryrkzbodqipdswvx` | supabase-fuchsia-xylophone | us-east-1 | ⚪ INACTIVE |
| **Inativo 2** | `urdmpzjycwywsjzhpntc` | supabase-charcoal-lighthouse | us-east-1 | ⚪ INACTIVE |

---

## 🔍 Análise de Tabelas - Projeto Principal (ardpabjoepzhkpmkgwgu)

### Estado RLS (Row Level Security)

**Tabelas com RLS DESATIVADO (13 tabelas):**
```
products, product_variations, warehouses, stock_balances, organizations, plans
organization_members, roles, permissions, subscriptions, usage, billing_events
inventory_movements
```

**Tabelas com RLS ATIVADO (40 tabelas):**
- ✅ `integration_events` - 10 colunas, 2 policies (tenant + service_role)
- ✅ `meta_integrations` - 1 policy
- ✅ `webhook_events` - 1 policy
- ✅ `risk_logs` - 1 policy
- ✅ `whatsapp_channels`, `whatsapp_templates`, `whatsapp_instances` - RLS ativo
- ✅ `scraper_configs` - RLS ativo
- ✅ Todos os modelos de CRM (Lead, Contact, Deal, Pipeline, Task) - RLS ativo

### Estrutura de `integration_events` (após Migration 029)

```sql
Columns:
- event_id: uuid (PK)
- meta_event_id: text
- integration_id: uuid
- event_type: text
- payload_hash: text
- processed_at: timestamptz
- user_id: uuid
- workspace_id: uuid ← CRÍTICO para multi-tenant
- payload: jsonb
- created_at: timestamptz

Policies:
1. integration_events_tenant (multi-tenant isolation)
2. integration_events_service_role (admin bypass)
```

---

## 🚨 Identificação de Riscos

### 1. Tabelas sem RLS (MEDIUM RISK)
**Impacto:** Usuários autenticados podem acessar dados de outras organizações.

**Recomendação:** Analisar necessidade de multi-tenant isolation para cada tabela:
- `organizations`, `organization_members` - **CRÍTICO** - Deve ter RLS
- `users` - Usuários do sistema
- `products`, `product_variations` - Dados de e-commerce
- `subscriptions`, `plans`, `billing_events` - Billing
- `inventory_movements`, `stock_balances`, `warehouses` - Inventário

### 2. Projetos Supabase Inativos (INFO)
**Projetos sem utilização:**
- `supabase-fuchsia-xylophone` - Criado 2025-05-22, INACTIVE
- `supabase-charcoal-lighthouse` - Criado 2026-09-22, INACTIVE

**Ação recomendada:**
- Verificar se há dados sensíveis nesses bancos
- Considerar exclusão se não houver uso ativo
- Não aplicar migrações em bancos inativos

### 3. Migration 025-027 Status
**Migrações identificadas:**
- `025_schema_parity` - AINDA NÃO APLICADA em produção
- `026_external_account_id_text` - AINDA NÃO APLICADA em produção  
- `027_integration_events_cols` - AINDA NÃO APLICADA em produção

**Risco:** Schema drift entre código Prisma e banco de produção.

---

## 📋 Plano de Ação Recomendado

### Imediato (HIGH PRIORITY)
1. ✅ **Migration 029 CONFIRMADA APLICADA** - RLS em `integration_events` funcional
2. **Habilitar RLS em tabelas CRÍTICAS:**
   - `organizations` - Base do multi-tenant
   - `organization_members` - Acesso às organizações
   - `users` - Se não usar auth Supabase
   - `billing_events` - Dados de faturamento

### Médio Prazo
1. Aplicar migrations 025, 026, 027 com teste em staging primeiro
2. Verificar dados nos bancos inativos
3. Limpar projetos Supabase não utilizados

### Longo Prazo
1. Implementar política de RLS consistente em todas as tabelas sensíveis
2. Documentar schema de produção vs dev
3. Automatizar verificação de RLS

---

## 🧪 Testes de Verificação RLS

**Teste de isolamento multi-tenant:**
```sql
-- Como organização A
SET LOCAL app.current_org = 'org-a-uuid';
SELECT COUNT(*) FROM integration_events; -- Deve retornar apenas eventos de org A

-- Como organização B  
SET LOCAL app.current_org = 'org-b-uuid';
SELECT COUNT(*) FROM integration_events; -- Deve retornar apenas eventos de org B

-- Sem contexto de organização
SET LOCAL app.current_org = '';
SELECT COUNT(*) FROM integration_events; -- Deve retornar 0 (fail-closed)
```

---

## 📈 Métricas de Saúde

| Métrica | Status |
|---------|--------|
| Tabelas com RLS | 40/64 (62.5%) |
| Tabelas sem RLS críticas | 13/64 (20.3%) |
| Bancos ativos | 1/3 |
| Migrations pendentes | 3/17 |

---

## 🔐 Credenciais Verificadas

- 📍 Projeto `ardpabjoepzhkpmkgwgu` (Revolution X) - Ativo
- 📍 Region: sa-east-1 (São Paulo)
- 📍 PostgreSQL: 17.6.1.166
- 📍 Status: ACTIVE_HEALTHY

## 📅 Próximos Passos

1. **Hoje:** Verificar necessidade de RLS em tabelas críticas
2. **Esta semana:** Aplicar migrations 025-027 em staging
3. **Próxima semana:** Auditoria completa de dados nos bancos inativos
4. **Mês que vem:** Roadmap de hardening de segurança