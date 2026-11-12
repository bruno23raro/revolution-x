# REVOLUTION X — FASE 2.6: PLANO DE ROLLBACK

**Data:** 2026-11-12  
**Versão:** 1.0

---

## 1. IDENTIFICAÇÃO DO RELEASE

### 1.1 Commit Atual (a ser publicado)

```
commit: [pendente - será o próximo a ser criado]
branch: main
data: 2026-11-12
```

### 1.2 Commit Anterior (último publicado)

Para identificar o commit anterior após o deploy:

```bash
# Via CLI
git log --oneline -5

# Via hPanel
hPanel → Git → Deploy History → Ver detalhes do último deploy
```

---

## 2. ESTRATÉGIAS DE ROLLBACK

### 2.1 Rollback mais simples: hPanel Git History

**Quando usar:** Erro crítico, site caiu, erros 500 em massa

**Passos:**

1. Acesse hPanel → **Git** → **Deploy History**
2. Localize o commit anterior ao deploy atual
3. Clique em **Deploy** ao lado do commit
4. Aguarde confirmação (1-3 minutos)
5. Verifique `https://revolutionx.com.br/` retorna 200

**Tempo estimado:** 5-10 minutos

### 2.2 Rollback via CLI/GitHub

**Quando usar:** Precisão no revert, múltiplos commits

**Passos:**

```bash
# 1. Verificar histórico
git fetch origin
git log origin/main --oneline -10

# 2. Identificar commit de rollback
# Supondo que o commit anterior seja: abc123def

# Opção A: Reset para commit específico (perderá commits intermediários)
git reset --hard abc123def
git push --force-with-lease origin main

# Opção B: Revert (cria novo commit desfazendo as mudanças - MAIS SEGURO)
git revert HEAD  # ou HEAD~N para reverter N commits
git push origin main
```

### 2.3 Rollback parcial: Selective revert

**Quando usar:** Apenas alguns arquivos causaram problema

```bash
# 1. Resetar arquivo específico ao estado anterior
git checkout HEAD~1 -- app/api/integrations/openbsp/incoming/route.ts
git checkout HEAD~1 -- app/api/whatsapp/templates/route.ts

# 2. Commit específico
git commit -m "revert: volta versão anterior de webhook OpenBSP e templates"
git push origin main
```

---

## 3. VERIFICAÇÕES DE ROLLBACK

### 3.1 Health Check pós-rollback

```bash
# Site principal deve retornar 200
curl -I https://revolutionx.com.br/

# API sem auth deve retornar 401
curl -I https://revolutionx.com.br/api/auth/session

# Health endpoint (se existir)
curl https://revolutionx.com.br/api/dev/status
```

### 3.2 Verificação de dados

```bash
# Verificar se as tabelas principais existem
npx prisma studio  # Acesse via browser

# Ou via SQL (quando disponível)
psql -h [host] -U [user] -c "SELECT tablename FROM pg_tables WHERE tablename LIKE 'user_%';"
```

---

## 4. ROLLBACK DE MIGRATIONS

### 4.1 Migrations aplicadas durante FASE 2.6

Se migrações novas foram aplicadas, revertê-las:

```bash
# 1. Ver status das migrations
npx prisma migrate status

# 2. Rollback específico (CUIDADO - dados podem ser perdidos)
npx prisma migrate reset  # **PERDE DADOS**

# 3. Rollback seletivo (mais seguro)
# Editar prisma/migrations/YYYYMMDD_HHMMSS_name/migration.sql
# e reversar as alterações SQL manualmente
```

### 4.2 Migration 026 (webhook_events)

Se a migration 026 causar problemas:

```sql
-- SQL para remover UNIQUE constraint criado pela migration 026
ALTER TABLE webhook_events DROP CONSTRAINT IF exists webhook_events_openbsp_event_id_key;
```

---

## 5. RECUPERAÇÃO DE DADOS

### 5.1 Backup do banco (recomendado antes do deploy)

```bash
# Exportar schema
pg_dump --schema-only [DATABASE_URL] > schema_backup_YYYYMMDD.sql

# Exportar dados críticos
pg_dump --data-only --table=user_users --table=whatsapp_channel --table=organization_members [DATABASE_URL] > data_backup_YYYYMMDD.sql
```

### 5.2 Restaurar backup

```bash
# Antes do deploy
psql [DATABASE_URL] < backup_anterior.sql
```

---

## 6. CONTATOS URGENTES

| Serviço | Contato | Uso |
|---------|---------|-----|
| Hostinger Support | support@hostinger.com | Problema com hPanel/deploy |
| Supabase Support | https://supabase.com/docs/support | Problemas de banco |
| Meta Developer | https://developers.facebook.com/support | Webhook/Graph API |
| GitHub Actions | https://github.com/contact | CI/CD issues |

---

## 7. CHECKLIST DE ROLLBACK

### Antes do Deploy

- [ ] Backup do banco de dados criado
- [ ] Commit anterior identificado
- [ ] Documentação de rollback salva
- [ ] Equipe notificada sobre janela de manutenção

### Durante o Deploy

- [ ] Monitorar logs em tempo real
- [ ] Verificar health endpoint a cada 30s
- [ ] Ter rollback ready para executar

### Pós-Deploy (se necessário)

- [ ] Executar rollback via hPanel ou CLI
- [ ] Verificar health checks
- [ ] Testar funcionalidades críticas
- [ ] Notificar equipe
- [ ] Documentar causa root

---

## 8. COMUNICAÇÃO DE INCIDENTE

### Modelo de notificação

```
Assunto: [URGENTE] Rollback de produção - Revolution X

Equipe,

Identificamos um problema crítico após o deploy de FASE 2.6 às [hora].
O rollback foi iniciado e está em andamento.

Status do rollback: [EM ANDAMENTO / CONCLUÍDO]
Tempo estimado de recuperação: [X] minutos
Impacto: [usuários afetados / serviços interrompidos]

Aguardaremos confirmação de saúde antes de comunicar conclusão.

Atenciosamente,
[Seu nome]
```

---

## 9. HISTÓRICO DE ROLLBACKS

| Data | Deploy | Rollback | Causal | Durção |
|------|--------|----------|--------|--------|
| - | - | - | - | - |

*Preencher após cada incidente*

---

**Este plano deve ser revisado e testado antes da primeira publicação em produção.**