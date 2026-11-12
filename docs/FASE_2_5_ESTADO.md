# FASE 2.5 — Release Candidate, Auditoria Final

**Data:** 2026-11-11  
**Status:** 🔄 PREPARAÇÃO PARA RELEASE CANDIDATE  
**Destino:** Hostinger (não Vercel)

---

## 1. RESUMO DA FASE 2.4

| Critério | Status |
|----------|--------|
| Webhook OpenBSP corrigido | ✅  |
| Idempotência tenant-scoped | ✅  |
| Mock de teste atualizado | ✅  |
| 1074/1074 testes passando | ✅  |
| Build 91 páginas | ✅  |
| TypeScript 0 erros | ✅  |
| ESLint 0 erros | ✅  |
| Documentação Hostinger | ✅  |

---

## 2. MIGRATIONS CONCILIADAS

### 2.1 Estado em Produção

| Migration | Nome | Status |
|-----------|------|--------|
| 005 | meta_integrations (snake_case) | ✅ APLICADA |
| 006 | consolidate_schema | ✅ APLICADA |
| 007 | FORCE RLS on 21 tables | ✅ APLICADA |
| 008 | token_rls_harden | ✅ APLICADA |
| 009 | session + billing RLS | ✅ APLICADA |
| 013 | sync auth.users → public."User" | ✅ APLICADA |
| 014 | Agent task queue | ✅ APLICADA |
| 015 | webhook_events + unique index | ✅ APLICADA |
| 016 | multicontas Meta | ✅ APLICADA |
| 017 | Campaign + LGPD consent | ✅ APLICADA |

### 2.2 Schema Canônico (migration 025)

A migration **025_schema_parity.sql** é a referência canônica para:
- `meta_integrations` em snake_case
- `webhook_events` com `openbsp_event_id`
- Zero dados nas tabelas (backfill limpo)

**Status:** ✅ CONSISTENTE entre local e produção

### 2.3 NÃO APLICAR

As migrations 005/006 **não devem ser reaplicadas** - suas funcionalidades estão incorporadas ao schema atual.

---

## 3. AUDITORIA DE SEGURANÇA MULTI-TENANT

### 3.1 Webhook OpenBSP - Status

**Arquivo:** `app/api/integrations/openbsp/incoming/route.ts`

#### Verificações Realizadas:

| Verificação | Resultado |
|-------------|-----------|
| `tx.webhookEvent.create()` dentro `withTenantContext` | ✅ |
| Contexto PostgreSQL transacional | ✅ |
| Chave de idempotência `openbspEventId` | ✅ |
| Signature HMAC-SHA256 com timing-safe | ✅ |
| Channel lookup via service role client | ✅ |
| Status channel verificado (CONNECTED) | ✅ |

#### Transação Completa:
```typescript
await withTenantContext(org, async (tx) => {
  await processWhatsAppPayload(body, org, tx);
  await tx.webhookEvent.create({
    data: {
      metaEventId: wamid || payloadHash,
      openbspEventId: wamid || null,
      eventType: 'whatsapp_api_inbound',
      payloadHash,
      processedAt: new Date(),
    },
  });
});
```

---

## 4. HOOKS E MIDDLEWARES VERIFICADOS

| Arquivo | Verificação | Status |
|---------|-------------|--------|
| `src/lib/auth.ts` | Fail-closed JWT | ✅ |
| `src/middleware.ts` | Tenant isolation | ✅ |
| `src/middleware/demo-auth.ts` | Demo mode guard | ✅ |
| `app/api/facebook/publish/route.ts` | RBAC + demo guard | ✅ |
| `app/api/instagram/publish/route.ts` | RBAC + demo guard | ✅ |

---

## 5. HOSTINGER - INVESTIGAÇÃO

### 5.1 Informações Coletadas

| Campo | Valor |
|-------|-------|
| Domínio | revolutionx.com.br |
| Build anterior | 01a15fda (2026-11-07) |
| Node.js | 22.x (hPanel) |
| Diretório alvo | /public_html |
| Variáveis | 14 configuradas |

### 5.2 Variáveis de Ambiente

| Variável | Status |
|----------|--------|
| DATABASE_URL | ✅ Configurada |
| DIRECT_URL | ✅ Configurada |
| JWT_SECRET | ✅ Configurada |
| NEXT_PUBLIC_SUPABASE_URL | ✅ Configurada |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | ✅ Configurada |
| META_APP_ID | ✅ Configurada |
| META_APP_SECRET | ✅ Configurada |
| META_WEBHOOK_VERIFY_TOKEN | ✅ Configurada |
| META_TOKEN_ENCRYPTION_KEY | ✅ Configurada |
| WHATSAPP_PHONE_NUMBER_ID | ✅ Configurada |
| WHATSAPP_ACCESS_TOKEN | ✅ Configurada |
| CRON_SECRET | ✅ Configurada |
| SUPABASE_SERVICE_ROLE_KEY | ✅ Configurada |
| EMAIL_API_KEY | ✅ Configurada |

### 5.3 Processo de Deploy

O Hostinger utiliza **Node.js Web App** com:
- Deploy via GitHub Actions (main branch)
- Diretório: `/public_html`
- Start: `npm run start`
- Porta: 3000 (interna)

---

## 6. RELEASE CANDIDATE

### 6.1 Commits Atuais

Commit atual: HEAD (sem mudanças não commitadas na FASE 2.5)

### 6.2 Build Verificado

```bash
npm run build  # 91 páginas geradas
npm test       # 1074/1074 passando
npx tsc --noEmit --incremental false  # 0 erros
```

### 6.3 Arquivos Modificados

- `app/api/integrations/openbsp/incoming/route.ts` (correção segurança)
- `app/api/integrations/openbsp/incoming/route.test.ts` (atualização mock)
- `docs/FASE_2_4_HOSTINGER_ESTADO.md` (atualização)

### 6.4 Arquivos para Commit

```bash
git add app/api/integrations/openbsp/incoming/route.ts
git add app/api/integrations/openbsp/incoming/route.test.ts
git add docs/FASE_2_4_HOSTINGER_ESTADO.md
git add docs/FASE_2_5_*.md
git commit -m "FASE 2.5: webhook OpenBSP security fix + release candidate documentation"
```

---

## 7. PENDENCIAIS RESTANTES

| Item | Status | Ação |
|------|--------|------|
| Deploy na Hostinger | AGUARDANDO | Autorização explícita |
| Rotação credenciais DEV | AGUARDANDO | Aguardar autorização |
| Facebook Login OAuth | AGUARDANDO | Aprovação no Meta Console |
| GoTrue SMTP | AGUARDANDO | Configuração painel Supabase |

---

## 8. CHECKLIST DE RELEASE

- [x] Webhook OpenBSP auditado e corrigido
- [x] Idempotency verificado
- [x] Multi-tenant isolation comprovado
- [x] Migrations 005-017 verificadas
- [x] Schema 025 como canônico
- [x] 1074 testes passando
- [x] Build limpo (91 páginas)
- [x] TypeScript 0 erros
- [x] ESLint 0 erros
- [x] Variáveis de ambiente verificadas
- [x] Documentação atualizada
- [ ] **Deploy autorizado pelo usuário**

---

## 9. PROXIMOS PASSOS

1. **Aguardar autorização** para commit e push
2. **Verificar migrates** em ambiente de staging (recomendado)
3. **Deploy na Hostinger** via GitHub Actions
4. **Verificação pós-deploy** em produção
5. **Monitoramento** de erros 5xx e webhook processing

---

*Documento gerado: 2026-11-11*  
*Status: PRONTO PARA RELEASE CANDIDATE*