# Plano System User Meta — O QUE FAZER

## Objetivo

Gerar um **usuário do sistema Meta** com permissões para chamadas Graph API de alta permissão (ads_management, ads_read, pages_read_user_content, pages_show_list) para o app `1421814643397349` (CAPI). Este token será salvo em `.env.local` como `META_SYSTEM_USER_TOKEN_1421814643397349` e utilizado pela integração Meta para chamadas Graph API que excedem os limites do app token.

## Estado Atual (2026-11-03)

- **App ID**: 1421814643397349
- **Secret atual**: não é o do CAPI (pertence ao app 1112157761403064)
- **Token atual em .env**: `META_APP_ID` + `META_APP_SECRET` (app token — não funciona para user token)
- **Endpoint de autenticação**: https://www.facebook.com/v26.0/dialog/oauth (v26.0 consistente em todo o app)
- **Permissões necessárias**: 
  - `ads_management`
  - `ads_read`
  - `pages_read_user_content` (se disponível)
  - `pages_show_list` (se disponível)

## Passos — Executar Humano (≈10 minutos)

### 1. Acesse o Meta Developer Console

- Abra https://developers.facebook.com/
- Localize o app **1421814643397349**
  - Se não existir, **crie um novo app Meta**.

### 2. Verifique o App Secret (se estiver ausente/incorreto)

- Na aba **Configurações → Básicas**, localize **App Secret**.
- Se o secret estiver ausente ou for o do app 1112157761403064, **gere um novo**.
- Ative **Mostrar App Secret** se necessário.

### 3. Configure a página Configurações → Negócios

- Na aba **Configurações → Negócios**, encontre **Usuários do Sistema**.
- **Crie um novo Usuário do Sistema** (ou use um existente).
  - Nome: "Revolution X"
  - Papel: **Admin**

### 4. Gere um token de acesso do sistema do usuário

- Escolha **Gerar um novo token de acesso do usuário do sistema**.
- **Marque as seguintes permissões**:
  - `ads_management`
  - `ads_read`
  - `pages_read_user_content` *(se aparecer)*
  - `pages_show_list` *(se aparecer)*
- **Copie o token** (começa com `EAA...`).

### 5. Salve o token em .env.local

Abra `C:\Users\Bruno\.claude\Revolution\X\.env.local` (ou `\.env` se preferir):

```
META_SYSTEM_USER_TOKEN_1421814643397349=<TOKEN_COPIADO>
```

- Se `META_SYSTEM_USER_TOKEN_1112157761403064` já existe, você pode manter ambos.

### 6. Documente com valor mascarado

Salve este token em `docs/plan_meta_system_user.md` (este arquivo) com **primeiros 8 + últimos 4**:

```
META_SYSTEM_USER_TOKEN_1421814643397349=EAAu3...ABCd7
```

### 7. Valide o token

```bash
curl -X GET "https://graph.facebook.com/v26.0/me?fields=id,name&access_token=<TOKEN>"
```

- Deve retornar `id`/`name` — o token funciona.

## Caminho Alternativo (se 1421814643397349 não for acessível)

Se o app CAPI não existir ou não for editável, use o app **1112157761403064** (anteriormente usado para OAuth):

- Crie um **Usuário do Sistema** nele (mesmas permissões).
- Salve como `META_SYSTEM_USER_TOKEN_1112157761403064`.

## Segurança

- **Nunca** comente o token bruto no Git — este arquivo já mascara.
- `.env.local` e `.env` estão no `.gitignore`.
- Ao alterar este token, **alerte** no CHANGELOG.md.

## Ações Pós-Token (Pós-Humano)

1. **Valide as chamadas Graph API**: execute `meta auth status`.
2. **Verifique a integração**: chame `/api/integrations/meta/callback` (se disponível).
3. **Atualize o estado do sistema**: `GET /api/admin/schema/diff` para incluir o novo token.
4. **Execute testes**: `npm test` para garantir que a integração meta funcione com o system user.

## O que este token habilita

- **Rotas protegidas**: `/api/admin/tasks`, `/api/admin/schema`, `/api/admin/users`
- **Otimizador**: `/api/ai/models` + `/api/ai/generate`
- **Integrações**: OAuth Meta /insights /publisher /whatsapp /instagram
- **Graph API**: chamadas com `ads_management` + `ads_read` + permissões de página

## Limites e Avisos

- Este é um **token de acesso do sistema do usuário** — não pode ser revogado facilmente.
- Use-o apenas para chamadas Graph API de alta permissão; mantenha credenciais de app token (META_APP_ID/SECRET) para OAuth.
- Armazene em um **`.env.local` seguro** (permissões restritas).

---

*Execute os passos acima e reporte o token gerado (mascarado) para validar.*