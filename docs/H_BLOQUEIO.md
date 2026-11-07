# H-1: Meta System User Token - Guia de Configuração

## Status: BLOCKED (Ação Humana Necessária)

## Descrição
O token de usuário sistema do Meta não foi gerado. Este token é necessário para:
- Executar ações administrativas via Marketing API
- Acessar endpoints de integração do WhatsApp Business
- Enviar mensagens via API Cloud do WhatsApp

## App Meta Details

- **App ID**: 1112157761403064
- **App Secret**: Armazenado em `.env.local`
- **Conta**: 1421814643397349

## Passos para Configuração

### 1. Acessar Business Manager

1. Abrir: https://business.facebook.com/
2. Fazer login com a conta administradora

### 2. Criar Usuário Sistema

1. Navegar para: **Settings** → **Business Settings** → **System Users**
2. Clicar em: **Add** → **Create System User**
3. Nome: "Revolution X System User"
4. Role: **Admin**
5. Salvar o ID do usuário criado

### 3. Gerar Token de Acesso

1. Na lista de System Users, selecionar o criado
2. Em **Assets** → **Add Assets** → selecionar a App criada
3. Conceder permissões:
   - `business_management`
   - `pages_manage_cta`
   - `pages_show_list`
   - `whatsapp_business_messaging`
   - `ads_management`
4. Copiar o **System User ID**
5. Gerar token via Graph API Explorer ou CLI:

```bash
curl -X GET "https://graph.facebook.com/v19.0/{system-user-id}/access_tokens?access_token={system-user-access-token}&grant_type=client_credentials"
```

### 4. Adicionar ao .env.local

```env
SYSTEM_USER_TOKEN=1112157761403064|6PBUFK2Rb96rx7W8-SdvpONKF8s
```

## Endpoints Necessários com o Token

- `POST /v19.0/{phone-number-id}/messages` - Enviar mensagens
- `GET /v19.0/{phone-number-id}` - Verificar status
- `GET /v19.0/{app-id}/lead_ads` - Lead ads insights

## Próximos Testes

Após configuração:

1. Testar conexão com:

```bash
curl -X GET "https://graph.facebook.com/v19.0/me?access_token={SYSTEM_USER_TOKEN}"
```

2. Verificar WhatsApp no painel de controle Meta

## Referências

- [Meta System Users Docs](https://developers.facebook.com/docs/business-identity/system-users)
- [WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Marketing API Permissions](https://developers.facebook.com/docs/apps/review)