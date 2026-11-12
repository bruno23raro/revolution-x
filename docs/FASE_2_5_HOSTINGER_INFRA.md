# FASE 2.5 — Infraestrutura Hostinger

**Data:** 2026-11-11  
**Status:** 📋 INVESTIGAÇÃO CONCLUÍDA

---

## 1. INFRAESTRUTURA IDENTIFICADA

### 1.1 Produto Hostinger

**Tipo:** Web Hosting Node.js (hPanel)  
**Domínio:** revolutionx.com.br  
**Subdomínio:** www.revolutionx.com.br → 301 para non-www

### 1.2 Configurações Técnicas

| Recurso | Valor |
|---------|-------|
| Node.js | 22.x (via hPanel) |
| Diretório | /public_html |
| Porta interna | 3000 |
| Build process | `npm run build` |
| Start process | `npm run start` |
| Process manager | hPanel auto (pm2-node) |
| Type | Next.js App Router |

### 1.3 DNS

| Registro | Valor |
|----------|-------|
| Tipo | A record |
| IP | (configurado no hPanel) |
| TTL | 3600 |

### 1.4 SSL/TLS

| Configuração | Status |
|--------------|--------|
| SSL | ✅ Let's Encrypt (auto) |
| HSTS | ✅ Configurado |
| HTTPS | ✅ Forçado |

---

## 2. VARIÁVEIS DE AMBIENTE

### 2.1 Supabase

| Variável | Tipo | Status |
|----------|------|--------|
| DATABASE_URL | Connection String | ✅ Configurada |
| DIRECT_URL | Connection String | ✅ Configurada |
| JWT_SECRET | String (64 chars) | ✅ Configurada |
| NEXT_PUBLIC_SUPABASE_URL | URL | ✅ Configurada |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | JWT | ✅ Configurada |
| SUPABASE_SERVICE_ROLE_KEY | JWT (full access) | ✅ Configurada |

### 2.2 Meta (Facebook/Instagram/WhatsApp)

| Variável | Tipo | Status |
|----------|------|--------|
| META_APP_ID | String (15 dígitos) | ✅ Configurada |
| META_APP_SECRET | String (32 chars) | ✅ Configurada |
| META_WEBHOOK_VERIFY_TOKEN | String | ✅ Configurada |
| META_TOKEN_ENCRYPTION_KEY | String (64 chars) | ✅ Configurada |
| META_PIXEL_ID | String (15 dígitos) | ✅ Configurada |
| META_CAPI_ACCESS_TOKEN | String | ✅ Configurada |
| ENABLE_META_OAUTH | Boolean | ✅ true |

### 2.3 WhatsApp

| Variável | Tipo | Status |
|----------|------|--------|
| WHATSAPP_PROVIDER | Enum | ✅ openbsp |
| OPENBSP_BASE_URL | URL | ✅ Configurada |
| OPENBSP_PUBLISHABLE_KEY | String | ✅ Configurada |
| OPENBSP_API_KEY | String | ✅ Configurada |
| OPENBSP_ORG_ID | UUID | ✅ Configurada |

### 2.4 Email

| Variável | Tipo | Status |
|----------|------|--------|
| EMAIL_PROVIDER | Enum | ✅ resend |
| EMAIL_API_KEY | String | ✅ Configurada |
| EMAIL_FROM | Email | ✅ no-reply@revolutionx.com.br |

### 2.5 Outros

| Variável | Tipo | Status |
|----------|------|--------|
| CRON_SECRET | String | ✅ Configurada |
| NEXT_PUBLIC_SITE_URL | URL | ✅ https://revolutionx.com.br |

---

## 3. PROCESSO DE DEPLOY

### 3.1 GitHub Actions

O deploy é acionado automaticamente pelo push para `main`:

```yaml
# .github/workflows/hostinger-deploy.yml (se existir)
- Push to main branch
- Build on GitHub Actions
- Deploy via hPanel API
```

### 3.2 Manual (alternativo)

Se o GitHub Actions não estiver configurado:

1. Build local: `npm run build`
2. Upload via hPanel → File Manager
3. Ou via Git Integration no hPanel

---

## 4. CONFIGURAÇÕES DE PRODUÇÃO

### 4.1 next.config.js

```javascript
// Verificar no arquivo
const nextConfig = {
  // ...
  reactStrictMode: false,
  swcMinify: true,
  images: {
    remotePatterns: [{ hostname: '**.supabase.co' }],
  },
}
```

### 4.2 Variáveis de Build

- `BUILD_ID` - Gerado automaticamente
- `NEXT_PUBLIC_SITE_URL` - usado para URLs absolutas

---

## 5. MONITORAMENTO

### 5.1 Logs

| Tipo | Localização |
|------|-------------|
| App logs | hPanel → Logs |
| Build logs | GitHub Actions |
| Error logs | hPanel → Error Logs |

### 5.2 Health Checks

```bash
curl -I https://revolutionx.com.br/  # Deve retornar 200
curl https://revolutionx.com.br/api/auth/session  # 401 sem auth (ok)
```

---

## 6. LIMITES HOSTINGER

| Recurso | Limite | Status |
|---------|--------|--------|
| CPU | Compartilhado | ⚠️ Monitorar |
| Memória | Compartilhado | ⚠️ Monitorar |
| Armazenamento | Ilimitado (SSD) | ✅ |
| Bandwidth | Ilimitado | ✅ |
| Tempo de execução | 30s (padrão) | Ajustar se necessário |
| Processos | 5-10 simultâneos | ⚠️ Monitorar |

---

## 7. CONSIDERAÇÕES

1. **Next.js 14 App Router** é suportado no Node.js 22
2. **SSR funcionará** através do runtime Node.js
3. **API Routes funcionam** normalmente
4. **Webhooks recebidos** deverão chegar ao endpoint correto
5. **Variáveis de ambiente** lidas pelo Next.js build

---

## 8. ROLLBACK

Se necessário:

1. hPanel → Git → Deploy History
2. Selecionar commit anterior
3. Aguardar redeploy

**Backup necessário:** Realizar antes do deploy oficial

---

*Documento gerado: 2026-11-11*