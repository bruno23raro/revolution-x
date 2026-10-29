# RX_DOC_API_TEST_CALLS_20261027 — Chamadas de Teste da API

## Visão Geral

Este documento documenta todas as chamadas de API que serão testadas durante a gravação dos screencasts. Cada permissão tem endpoints e parâmetros específicos que devem ser testados.

## Endpoints Principais (7 Level A)

### 1. `pages_show_list`
- **Endpoint**: `GET /api/auth/meta?provider=facebook`
- **Escopo OAuth**: `pages_show_list`
- **Operação**: Redireciona para o dialog da Meta, callback chama Graph API `GET /me/accounts`
- **Parâmetros de teste**: `redirect_uri=https://revolutionx.com.br/api/auth/callback/meta`
- **Resultado esperado**: Lista de páginas conectadas exibida com nome, ID e status

### 2. `instagram_basic`
- **Endpoint**: `GET /api/auth/meta?provider=instagram`
- **Escopo OAuth**: `instagram_basic`
- **Operação**: Redireciona para o dialog da Meta, callback persiste dados de conexão Instagram
- **Parâmetros de teste**: `redirect_uri=https://revolutionx.com.br/api/auth/callback/meta`
- **Resultado esperado**: Perfil Instagram exibindo username, name, biography, follower count

### 3. `instagram_content_publish`
- **Endpoint**: `POST /{ig-user-id}/media` (criar container) + `POST /{ig-user-id}/media_publish` (publicar)
- **Escopo OAuth**: `instagram_content_publish`
- **Operação**: Fluxo de 2 passos: criar container → publicar container
- **Parâmetros de teste**: 
  - Container: `{"image_url": "https://example.com/test-image.jpg", "caption": "Test caption"}`
  - Publicação: `{"creation_id": "<container-id>"}`
- **Resultado esperado**: Media ID retornado; postagem aparecendo no feed Instagram

### 4. `pages_manage_posts`
- **Endpoint**: `POST /{page-id}/feed` (publicar post na página)
- **Escopo OAuth**: `pages_manage_posts`
- **Operação**: Publicar conteúdo no feed da página Facebook
- **Parâmetros de teste**: `message="Texto de teste de postagem", link="https://exemplo.com"`
- **Resultado esperado**: Postagem aparecendo no feed da página ou confirmação de agendamento

### 5. `ads_read`
- **Endpoint**: `GET /{ad-account-id}/insights`
- **Escopo OAuth**: `ads_read`
- **Operação**: Ler insights de campanhas de anúncios
- **Parâmetros de teste**: `date_preset=last_7d&fields=impressions,spend,clicks,reach`
- **Resultado esperado**: Tabela/métricas: Impressions, Conversions, Spend, Clicks, Reach

### 6. `whatsapp_business_messaging`
- **Endpoint**: `POST /{phone-number-id}/messages` (enviar mensagem)
- **Escopo OAuth**: `whatsapp_business_messaging`
- **Operação**: Enviar mensagem via WhatsApp Business API
- **Parâmetros de teste**: `to="+5511917345249", "type": "text", "text="{"preview_text": "Teste de mensagem"}`
- **Resultado esperado**: Status de envio visível no app; mensagem recebida pelo cliente WhatsApp

### 7. `business_management`
- **Endpoint**: `GET /{business-account-id}/accounts` (listar contas conectadas)
- **Escopo OAuth**: `business_management`
- **Operação**: Gerenciar múltiplas contas Meta sob mesma organização
- **Parâmetros de teste**: Sem parâmetros específicos; OAuth flow completa a conexão
- **Resultado esperado**: Lista mostrando 2+ contas conectadas com nomes/IDs distintos

## Endpoints Level B (4 permissões)

### 8. `pages_read_engagement`
- **Endpoint**: `GET /{page-id}/insights` (métricas de engajamento)
- **Escopo OAuth**: `pages_read_engagement` (dependência de `business_management`)
- **Operação**: Ler métricas de engajamento (likes, comentários, compartilhamentos)
- **Parâmetros de teste**: `date_preset=last_30d&fields=engagement,comments,shares,likes`
- **Resultado esperado**: Gráfico/tabela com métricas (engajamento, visitas, posts)

### 9. `pages_manage_ads`
- **Endpoint**: `POST /{page-id}/ads` (criar anúncio) ou boost de post
- **Escopo OAuth**: `pages_manage_ads` (defined in constants, not actively called)
- **Operação**: Criar anúncio para a Page ou boost de post
- **Parâmetros de teste**: `objective_LINK_CLICKS, adset_name="Teste", billing_event=IMPRESSIONS`
- **Resultado esperado**: Confirmação de criação ou rascunho criado

### 10. `pages_read_user_content`
- **Endpoint**: `GET /{ig-user-id}` (perfil do Instagram) ou `GET /{page-id}`
- **Escopo OAuth**: `pages_read_user_content` (dependência de `instagram_basic`)
- **Operação**: Ler conteúdo do perfil Instagram ou página Facebook
- **Parâmetros de teste**: Campos user_name, biography, follower_count, media_count
- **Resultado esperado**: Perfil ou página dados visíveis sem expor tokens

### 11. `whatsapp_business_management`
- **Endpoint**: Gerenciar configurações da WABA (Webhook, números de telefone)
- **Escopo OAuth**: `whatsapp_business_management` (dependência de `whatsapp_business_messaging`)
- **Operação**: Logar eventos de conversão (purchase, add-to-cart, leads) na WABA
- **Parâmetros de teste**: Configuração de webhook, seleção de número de telefone
- **Resultado esperado**: WABA configurada; eventos de conversão logados (não é webhook de mensagem)

## Formato de Registro de Chamadas

Cada chamada de API deve ser registrada no formato:

```
RX_API_TEST_<data>_<endpoint>.md
```

Com os seguintes campos:
- **endpoint** — URL completa do endpoint
- **method** — GET, POST, PUT, DELETE
- **scopes** — escopos OAuth necessários
- **parâmetros** — todos os parâmetros enviados
- **resultado** — o que foi retornado / exibido
- **status** — OK | PARCIAL | FALHOU

## Instruções para o Screencast

Durante a gravação do vídeo, certifique-se de:

1. **Mostrar o endpoint sendo chamado** (se visível na URL ou na rede)
2. **Exibir os parâmetros** sendo enviados (mascarar segredos)
3. **Mostrar o resultado** retornado pela API
4. **Verificar que os dados esperados** estão presentes (impressions, reach, post ID, etc.)
5. **Marcar qualquer erro** ou resposta inesperada

## Registry

Após cada teste, preencher RX_API_TEST_<data>_<endpoint>.md com os resultados. Esses arquivos serão referenciados no MANIFEST.csv e usados como evidência no Meta review.