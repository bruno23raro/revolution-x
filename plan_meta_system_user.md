# Plano: Gerar System User Token para App Meta 1421814643397349

## Visão Geral

O objetivo é gerar um system user token para o app Meta **1421814643397349** (descobrido em conteúdo colado anteriormente), que já possui 17 permissões configuradas incluindo `instagram_branded_content_ads_brand`, `ads_read`, `pages_read_engagement`, etc.

O app `1112157761403064` (no `.env.local`) só tem 4 permissões no token atual: `business_management`, `whatsapp_business_management`, `whatsapp_business_messaging`, `public_profile`.

## Arquitetura Atual

### App IDs no Sistema
- **1112157761403064** — `.env.local`, `META_APP_ID`, `META_APP_SECRET=ff2edcdec00e1e843433b860c717a3ab`
  - Token atual tem 4 permissões
  - OAuth flow funcional para WhatsApp/Instagram básico
- **1421814643397349** — Descoberto em conteúdo colado, já tem 17 permissões
  - Precisa de system user token para acessar recursos avançados
  - Tem permissões: `manage_app_solution`, `whatsapp_business_messaging`, `instagram_branded_content_ads_brand`, `ads_read`, `pages_read_engagement`, etc.

### Permissões Necessárias (pelo menos 4 extras das 17)
Atualmente temos: `business_management`, `whatsapp_business_messaging`
Precisamos adicionar: `ads_management`, `pages_read_engagement`, `pages_manage_ads`, `read_insights` (pelo menos)

## Etapas do Plano

### Etapa 1: Descobrir o App Secret para 1421814643397349

**Métodos a tentar:**

1. **Variáveis de ambiente Hostinger** — verificar se o secret foi armazenado ao configurar o hosting_nodejs_replace-environment-variables
2. **Facebook Developer Console** — verificar se há outro secret associado ao app 1421814643397349
3. **Token debug** — tentar usar o Graph API debug endpoint com o known secret para ver se ele tem acesso ao app 1421814643397349
4. **OAuth flow** — tentar iniciar OAuth para o app 1421814643397349 (pode exigir review da Meta)

**Código para testar o secret conhecido:**
```bash
# Testar se o known_secret funciona com o target_app_id
curl "https://graph.facebook.com/v26.0/oauth/access_token?client_id=1421814643397349&client_secret=ff2edcdec00e1e843433b860c717a3ab&grant_type=client_credentials"
```

### Etapa 2: Gerar System User Token

Após descobrir o correto app secret, gerar o token:

```bash
# 1. Obter system users do app
curl "https://graph.facebook.com/v26.0/1421814643397349/roles?access_token={system_user_token}"

# 2. Identificar o system user com as permissões corretas
# Precisamos de: ads_management, pages_read_engagement, pages_manage_ads, read_insights

# 3. Gerar o system user token
# O token do system user tem formato: EAAP... ou similar
# Usar o app secret correto com o endpoint system user
```

### Etapa 3: Listar Recursos

Com o system user token, listar:

```bash
# Listar ad accounts
curl "https://graph.facebook.com/v26.0/1421814643397349/adaccounts?access_token={system_user_token}"

# Listar páginas
curl "https://graph.facebook.com/v26.0/1421814643397349/pages?access_token={system_user_token}"

# Listar contas Instagram vinculadas
curl "https://graph.facebook.com/v26.0/1421814643397349/insigram_branded_content_ads_brand?access_token={system_user_token}"
```

### Etapa 4: Popular .env.local

Atualizar as variáveis:

```
# Substituir ou adicionar:
META_APP_ID=1421814643397349
META_APP_SECRET=[SECRET_CORRETO_PARA_APP_1421814643397349]
META_SYSTEM_USER_TOKEN=[TOKEN_GERADO]
AD_ACCOUNT_ID=[DE_API]
PAGE_ID=[DE_API]
IG_BUSINESS_HANDLE=[DE_API]
```

### Etapa 5: Validar Conexão

Testar o status:

```bash
# Testar auth status
# Verificar se todas as permissões estão ativas
```

## Riscos e Considerações

1. **Secret não encontrado** — Se não descobrirmos o secret para app 1421814643397349, precisaremos:
   - Tentar OAuth flow (pode exigir revisão da Meta)
   - Verificar se há documentação ou suporte
   - Considerar se o app 1112157761403064 atende às necessidades atuais

2. **Permissões incompletas** — Mesmo com o system user token, algumas permissões podem exigir revisão da Meta (Facebook Login, Instagram Graph API em modo produção, etc.)

3. **Facebook Login Review** — Item pendente da readiness report: revisão externa da Meta, requer manual submission em https://developers.facebook.com → App Review → Submit for Review

4. **DMARC/SPF already handled** — Confirmado: `p=quarantine` via Hostinger DNS API

5. **WhatsApp já conectado** — Confirmado: WABA=801885496316680, phone_number_id=1244329368771764, status Conectado

## Sucess Criteria

- [ ] System user token gerado para app 1421814643397349
- [ ] AD_ACCOUNT_ID identificado e populado no .env.local
- [ ] PAGE_ID identificado e populado no .env.local
- [ ] IG_BUSINESS_HANDLE identificado e populado no .env.local
- [ ] `meta auth status` retorna sucesso
- [ ] Pelo menos 12+ das 17 permissões do app 1421814643397349 estão ativas no token

## Próximos Passos Imediatos

1. Testar o known_secret `ff2edcdec00e1e843433b860c717a38` com app 1421814643397349 via Graph API
2. Se não funcionar, verificar variáveis de ambiente Hostinger em busca do secret
3. Se encontrado, gerar system user token
4. Listar recursos e popular .env.local
5. Testar validação final