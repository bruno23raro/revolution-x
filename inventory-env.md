# Inventário de Variáveis de Ambiente - Hostinger

## Origin: `.env.example` (template base)

| Variável | Ambiente | Presente/Ausente | Últimos 4 chars | Formato |
|----------|----------|-----------------|-----------------|---------|
| `META_APP_ID` | Produção | **Presente** (`.env.local`) | `3064` | Numérico (ID do app Facebook) |
| `META_APP_SECRET` | Produção | **Presente** (`.env.local`) | `3ab` | Secreto (chave do app) |
| `META_WEBHOOK_VERIFY_TOKEN` | Produção | **Presente** (`.env.local`) | `e1c` | Token de verificação |
| `NEXT_PUBLIC_SUPABASE_URL` | Produção | **Presente** (`.env.local`) | `gwgu` | URL Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Produção | **Presente** (`.env.local`) | `BdOi` | Chave anônima Publ. |
| `NEXT_PUBLIC_SITE_URL` | Produção | **Presente** (`.env.local`) | `om.br` | URL do site |
| `META_TOKEN_ENCRYPTION_KEY` | Produção | **Presente** (`.env.local`) | `1b9d` | Chave de criptografia AES |
| `CRON_SECRET` | Produção | **Presente** (`.env.local`) | `8625` | Segredo para cron jobs |

---

## Origin: `.env.local` (configurações atuais)

| Variável | Ambiente | Presente/Ausente | Últimos 4 chars | Formato |
|----------|----------|-----------------|-----------------|---------|
| `DATABASE_URL` | Produção | **Presente** | `EMMw` | URL Postgres Supabase |
| `DIRECT_URL` | Produção | **Presente** | `EMMw` | URL Postgres Direta |
| `JWT_SECRET` | Produção | **Presente** | `ecret` | Segredo JWT (deve ser girado p/ prod) |
| `NEXT_PUBLIC_SUPABASE_URL` | Produção | **Presente** | `gwgu` | URL Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Produção | **Presente** | `BdOi` | Chave anônima Publ. |
| `META_APP_ID` | Produção | **Presente** | `3064` | ID app Facebook |
| `META_APP_SECRET` | Produção | **Presente** | `3ab` | Chave app Facebook |
| `META_WEBHOOK_VERIFY_TOKEN` | Produção | **Presente** | `e1c` | Token verificação webhook |
| `META_TOKEN_ENCRYPTION_KEY` | Produção | **Presente** | `1b9d` | Chave criptografia |
| `CRON_SECRET` | Produção | **Presente** | `8625` | Segredo cron |

---

## Origin: `.env.test` (banco de teste isolado)

| Variável | Ambiente | Presente/Ausente | Últimos 4 chars | Formato |
|----------|----------|-----------------|-----------------|---------|
| `TEST_ADMIN_DATABASE_URL` | Teste | **Presente** | `rls_test` | URL DB admin isolado |
| `TEST_RLS_DATABASE_URL` | Teste | **Presente** | `rls_test` | URL DB RLS isolado |
| `TEST_DATABASE_URL` | Teste | **Presente** | `rls_test` | URL DB padrão teste |

---

## ⚠️ Diferenças Críticas Identificados

1. **META_WEBHOOK_VERIFY_TOKEN** difere entre ambientes:
   - `.env.example`: `1ecb0e680b1a70e59e1e4f1f0fdf9e1c`
   - `.env.local`: `0b1e361df76b89b0e1f2985d830fe6d5`
   - ⚠️ **Necessário confirmar qual está cadastrado no painel Meta**

2. **JWT_SECRET** em `.env.local` é `super-secret-key-that-should-be-in-env-production` — **deve ser girado** para produção no Hostinger

3. **.env.example** não inclui `DATABASE_URL`/`DIRECT_URL` — essas são específicas do ambiente local/Produção

4. **.env.test** usa banco isolado `revolution_x_rls_test` — **NUNCA use DATABASE_URL/prod em testes**

---

## 🌐 Verificação de Domínio e SSL

| Item | Status |
|------|--------|
| `revolutionx.com.br` | Domain configurada |
| HTTPS/SSL | Precisa ser validado no Hostinger |
| Redirecionamento | Precisa verificar se não há loop incorreto |
| URL pública no código | `https://revolutionx.com.br` (confere com domínio) |

---

## 📡 Verificação de Webhook WhatsApp

| Item | Status |
|------|--------|
| Rota: `/api/webhooks/meta` | Implementada ✅ |
| GET hub.verify_token | Validado contra `META_WEBHOOK_VERIFY_TOKEN` ✅ |
| POST processa mensagens | Implementado no `handler.ts` ✅ |
| Assinatura HMAC-SHA256 | Validada via `META_APP_SECRET` ✅ |
| Retorno hub.challenge | Implementado na rota GET ✅ |

### Rota de webhook esperada na Meta:
```
https://revolutionx.com.br/api/webhooks/meta
```

⚠️ **Importante**: Confirmar que a URL cadastrada no painel da Meta corresponde exatamente ao domínio real e à rota implementada.

---

## 📋 Próximos Passos Obrigatórios

1. **Validar SSL no Hostinger** — certificado ativo em `https://revolutionx.com.br`
2. **Confirmar webhook na Meta** — URL correta no painel desenvolvedor
3. **Girar JWT_SECRET** para produção (diferente do valor atual)
4. **Verificar build no Hostinger** — `npm run build` deve passar
5. **Testar Playwright** — páginas principais abrindo sem erro

---

## 🔍 Evidências de Validação

- **Build local**: `npm run build` — passing (65 páginas)
- **Typecheck**: `npx tsc --noEmit` — 0 erros
- **Tests**: `npm test` — 712/712 passing
- **Lint**: `npx next lint` — 0 erros/warnings
- **Tests RLS**: `npx jest --testPathPattern="tests/rls.test"` — 11/11 passing

---

## 📁 Arquivos Afetados

Nenhum arquivo foi modificado — este é um **inventário diagnóstico**.
Próxima ação: validar no painel Hostinger e confirmar variáveis.