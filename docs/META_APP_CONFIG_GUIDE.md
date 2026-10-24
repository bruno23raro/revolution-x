# Guia de Configuração do App Meta para Revolution X

## Dados do seu App Meta

**ID do App:** `1112157761403064`  
**Secret do App:** `ff2edcdec00e1e843433b860c717a3ab`  
**URL do App:** `https://revolutionx.com.br`

---

## Passo 1 — Configurar Produto "Facebook Login"

### 1.1 Acessar o Developer Portal
1. Vá para: https://developers.facebook.com/apps/
2. Selecione o app com ID `1112157761403064`
3. No menu lateral esquerdo, clique em **"Facebook Login"**

### 1.2 Configurar Configurações do Socket
- **URL do Site:** `https://revolutionx.com.br`
- **URL do Socket Seguro:** deixe em branco (não necessário para web apps)

### 1.3 Configurar OAuth Redirect URIs
Em **"Configurações"** > **"OAuth Redirect URIs"**, adicione:

```
https://revolutionx.com.br/api/auth/callback/meta
```

⚠️ **IMPORTANTE:** Esta é a URI EXATA que o app usa para callback OAuth. Deve ser adicionada exatamente como acima.

### 1.4 Configurar Scopes/Permissões
Em **"Permissões"** dentro de Facebook Login, adicione as permissões necessárias:

| Permissão | Descrição | Usada em |
|-----------|-----------|----------|
| `pages_show_list` | Ver páginas do Facebook | Listagem de páginas |
| `pages_manage_posts` | Criar e gerenciar posts | Publicação |
| `pages_read_engagement` | Ver engajamento das páginas | Analytics |
| `instagram_basic` | Acesso básico ao Instagram | Integração IG |
| `instagram_content_publish` | Publicar no Instagram | Publicação IG |
| `business_management` | Gerenciar negócios | Multi-contas |

---

## Passo 2 — Configurar Produto "WhatsApp"

### 2.1 Adicionar WhatsApp ao App
1. No dashboard do app, clique em **"Adicionar Produto"**
2. Selecione **"WhatsApp"**
3. Clique em **"Configurar"**

### 2.2 Configurar Webhook URL
Em **"Webhooks"** > **"Configurar"**:

- **Callback URL:** `https://revolutionx.com.br/api/webhooks/meta`
- **Verify Token:** (mesmo token configurado em `META_WEBHOOK_VERIFY_TOKEN`)

### 2.3 Configurar Assinaturas de Webhook
Selecione os campos para monitorar:
- **WhatsApp Business Account:** `phone_number_id`, `business_account_id`
- **Messages:** ` messaging_events `
- **Messaging Optins:** `optins`

---

## Passo 3 — Configurar Produto "Instagram Graph API"

### 3.1 Adicionar Instagram ao App
1. No dashboard do app, clique em **"Adicionar Produto"**
2. Selecione **"Instagram Graph API"**
3. Clique em **"Configurar"**

### 3.2 Configurar Permissões do Instagram
Verifique se as seguintes permissões estão habilitadas:
- `instagram_basic`
- `instagram_content_publish`
- `pages_show_list`
- `pages_read_engagement`

---

## Passo 4 — Configurar Produto "Meta Ads API" (opcional)

Se quiser usar relatórios de anúncios:

1. Adicione o produto **"Marketing API"** ao app
2. Solicite permissões:
   - `ads_read` — para ler relatórios de campanhas
   - `ads_management` — para gerenciar anúncios (se necessário)

---

## Passo 5 — Configurar App no hPanel (já feito ✅)

As variáveis de ambiente já foram configuradas no Hostinger:

| Variável | Valor | Status |
|----------|-------|--------|
| `NEXT_PUBLIC_SITE_URL` | `https://revolutionx.com.br` | ✅ |
| `META_APP_ID` | `1112157761403064` | ✅ |
| `META_APP_SECRET` | `[MASCARADO]` | ✅ |

---

## Passo 6 — Tornar o App Público (para revisão da Meta)

### 6.1 Tornar App Disponível
1. No dashboard do app, vá para **"Configurações"** > **"Básico"**
2. Em **"Modo de Uso"**, mude de **"Desenvolvimento"** para **"Ao Vivo"**
3. Confirme a alteração

⚠️ **IMPORTANTE:** Se o app ainda estiver em modo desenvolvimento, apenas usuários testadores podem fazer login. Para produção, ative o modo ao vivo.

### 6.2 Adicionar Testadores (opcional)
Se não quiser tornar público imediatamente:
1. Vá para **"Configurações"** > **" papéis"**
2. Adicione os emails dos usuários que precisam testar:
   - `brunoalmeida23111996@gmail.com`
   - Email do analisador da Meta (se fornecido)

---

## Passo 7 — Testar o Fluxo OAuth

### 7.1 Testar Conecta via OAuth
1. Acesse: `https://revolutionx.com.br/integrations`
2. Faça login com: `brunoalmeida23111996@gmail.com`
3. Clique em **"Conectar via OAuth"** na seção Meta
4. Você será redirecionado para o Facebook
5. Autorize as permissões solicitadas
6. O callback irá para: `/api/auth/callback/meta`
7. Se tudo estiver configurado, verá a tela de sucesso

### 7.2 Verificar se Funcionou
Após o callback, verifique:
- Página mostra "Meta conectada" ou similar
- Botão "Renovar token da Meta" aparece
- Integrações listadas como "configurado"

---

## Resumo das Configurações Necessárias no Developer Portal

| Configuração | Valor | Local |
|--------------|-------|-------|
| OAuth Redirect URI | `https://revolutionx.com.br/api/auth/callback/meta` | Facebook Login > Configurações |
| Webhook Callback URL | `https://revolutionx.com.br/api/webhooks/meta` | WhatsApp > Webhooks |
| Produto Facebook Login | ✅ Ativado | Produtos |
| Produto WhatsApp | ✅ Ativado | Produtos |
| Produto Instagram Graph API | ✅ Ativado | Produtos |
| Modo do App | Ao Vivo (ou Development com testadores) | Configurações > Básico |

---

## Troubleshooting Comum

### Erro: "redirect_uri não corresponde a nenhum URI registrado"
- **Causa:** A URI de callback não foi adicionada nas configurações do app
- **Solução:** Adicione `https://revolutionx.com.br/api/auth/callback/meta` em OAuth Redirect URIs

### Erro: "This app is in development mode"
- **Causa:** App não está em modo produção
- **Solução:** Vá em Configurações > Básico e ative o modo ao vivo, ou adicione testadores

### Erro: "Invalid verification code"
- **Causa:** Verify token do webhook não corresponde
- **Solução:** Verifique se `META_WEBHOOK_VERIFY_TOKEN` no hPanel corresponde ao token configurado no webhook

### Erro: "App not configured"
- **Causa:** APP ID ou APP SECRET incorretos
- **Solução:** Verifique se as variáveis `META_APP_ID` e `META_APP_SECRET` no hPanel estão corretas

---

## Próximos Passos Após Configuração

1. ✅ Testar OAuth flow completo
2. ✅ Verificar se as integrações aparecem configuradas
3. ✅ Testar publicação em Facebook/Instagram/WhatsApp
4. ✅ Preencher o formulário de revisão da Meta (se aplicável)
