# Meta Screencast Plan — Revolution X

**Date:** 2026-10-27  
**Purpose:** Document demonstrable flows for each Meta OAuth permission to support the app review submission.  
**Scope:** 9 permissions from `DEFAULT_SCOPES` — only those with confirmed code references.

---

## Preconditions & Constraints

- **No invented data**: All demonstrated flows must correspond to real code functionality.
- **No real secrets**: OAuth flows use test accounts; access tokens must be masked/obfuscated.
- **Playwright available**: Project has Playwright extension configured; browser bridge (qa_*) drives the real profile with real logins.
- **Artifacts directory**: `artifacts/meta-app-review/` for video organization.
- **Human approval required**: Any action needing 2FA, confirm login, or Meta panel interaction must pause and request user input.
- ** Videos must not expose**: Passwords, raw access tokens, cookies, personal data, or internal secrets.

---

## 1. `pages_show_list` — Listar páginas Facebook conectadas

### Functionalidade real
Rota `GET /api/auth/meta?provider=facebook` constrói URL OAuth com `DEFAULT_SCOPES` e redireciona para o dialog da Meta. No callback `app/api/auth/callback/meta/route.ts`, o endpoint chama Graph API `GET /me/accounts` para listar páginas conectadas ao usuário.

### Pré-requisitos
- Usuário de teste logado no Facebook (brunoalmeida23111996@gmail.com ou conta de teste Meta)
- Variáveis `META_APP_ID`, `META_APP_SECRET` no ambiente
- OAuth state cookie válido

### Roteiro de gravação
1. **Início**: Acessar `https://revolutionx.com.br/api/auth/meta?provider=facebook`
2. **Autorização**: Facebook dialog aparecer; autorizar o app com permissões solicitadas
3. **Redirect**: Retorno para `https://revolutionx.com.br/api/auth/callback/meta`
4. **Operação**: Na seção Integrações, clicar "Conectar via OAuth" no cartão Meta
5. **Resultado verificável**: Lista de páginas conectadas exibida (nome da página, ID, status)
6. **Finalizar**: Verificar que a página aparece como "Conectada" na lista

### Dados a ocultar
- Qualquer token de acesso em texto livre
- Informações de cookie além do `oauth_state` (já mascarado pelo projeto)
- Dados pessoais do perfil Facebook

### Critério de conclusão
Vídeo deve mostrar: URL de login → autorização Facebook → redirect de volta → lista de páginas exibida na UI. Pelo menos uma página deve aparecer na lista.

---

## 2. `pages_manage_posts` — Publicar conteúdo nas páginas

### Functionalidade real
`src/integrations/meta/facebookPublisher.ts` publica posts via POST `/{page-id}/feed` usando Bearer token. O fluxo utiliza `pages_manage_posts` scope para autorização.

### Pré-requisitos
- Página Facebook conectada (via `pages_show_list` flow)
- Token de acesso válido para a página
- Conteúdo de teste (texto/imagem)

### Roteiro de gravação
1. **Início**: Acessar seção de publicação de posts para página conectada
2. **Seleção**: Escolher página Facebook da lista de contas conectadas
3. **Conteúdo**: Digitar texto de teste para postagem
4. **Autorização**: Se necessário, re-autorizar permissões via OAuth
5. **Publicação**: Clicar em "Publicar" ou "Agendar"
6. **Resultado**: Postagem aparecendo no feed da página ou confirmação de agendamento

### Dados a ocultar
- Tokens de acesso em texto livre
- IDs de página em formato completo se não necessário
- Conteúdo sensível

### Critério de conclusão
Vídeo deve mostrar: seleção de página → campo de texto → ação de publicação → confirmação de postagem agendada ou publicada no feed da página.

---

## 3. `instagram_basic` — Obter informações básicas do perfil Instagram

### Functionalidade real
Rota `GET /api/auth/meta?provider=instagram` constrói OAuth com escopos Instagram. No callback, a integração persiste dados de conexão do Instagram. O `instagram_basic` scope concede acesso a endpoints como `GET /{ig-user-id}`.

### Pré-requisitos
- Conta Instagram Business conectada
- Token de acesso Instagram válido

### Roteiro de gravação
1. **Início**: Acessar `https://revolutionx.com.br/api/auth/meta?provider=instagram`
2. **Autorização**: Facebook/Instagram dialog para autorização do app
3. **Redirect**: Retorno para callback Meta
4. **Operação**: Na seção Integrações, conectar conta Instagram
5. **Resultado**: Perfil Instagram exibindo username, name, biography, follower count

### Dados a ocultar
- Tokens de acesso completos
- Informações de contato do perfil
- Qualquer dado pessoal além do necessário

### Critério de conclusão
Vídeo deve mostrar: login Instagram → perfil exibido na UI → dados básicos (username, followers) visíveis sem expor tokens.

---

## 4. `instagram_content_publish` — Publicar imagens e vídeos no Instagram

### Functionalidade real
`src/integrations/instagram/instagramPublisher.ts` — fluxo de 2 passos:
1. `POST /{ig-user-id}/media` (create media container)
2. `POST /{ig-user-id}/media_publish` (publish container)

Usa `instagram_content_publish` scope para autorização OAuth inicial.

### Pré-requisitos
- Conta Instagram Business conectada com `instagram_basic` + `instagram_content_publish`
- Imagem ou vídeo de teste público disponível URL
- Container Instagram ID persistido

### Roteiro de gravação
1. **Início**: Na seção de publicação Instagram, selecionar tipo IMAGE ou REEL
2. **Mídia**: URL pública de imagem ou vídeo de teste
3. **Legenda**: Texto opcional para a publicação
4. **Publicar agora ou agendar**: Escolher horário (opcional, dentro do limite de 75 dias)
5. **Executar fluxo de 2 passos**: Container criado → publicação efetivada
6. **Resultado**: Media ID retornado; postagem aparecendo no feed Instagram

### Dados a ocultar
- Tokens de acesso
- URLs de mídia se contiverem dados sensíveis
- IDs de usuário em formato completo

### Critério de conclusão
Vídeo deve mostrar: seleção de tipo mídia → URL da mídia → legenda (opcional) → ação de publicação → Media ID retornado → postagem no feed Instagram (ou confirmação de agendamento).

---

## 5. `business_management` — Gerenciar múltiplos negócios e conexões

### Functionalidade real
Usado para conectar múltiplas contas Meta (Facebook Pages, Instagram Business, WhatsApp Business) sob uma mesma organização. Presente em ambos `DEFAULT_SCOPES` e `INSTAGRAM_SCOPES`. A rota `app/api/integrations/meta/refresh-token/` e `app/api/integrations/meta/` utilizam esse escopo para managing conexões.

### Pré-requisitos
- Pelo menos 2 contas Meta conectadas (diferentes páginas/perfis)
- Organização no Supabase com multi-tenant setup

### Roteiro de gravação
1. **Início**: Acessar seção de gerenciamento de integrações
2. **Adicionar conta**: Clicar em "Conectar" para novo provedor (Facebook/Instagram/WhatsApp)
3. **Autorizar fluxo**: Passar pelo OAuth com `business_management` scope
4. **Selecionar conta**: Escolher qual página/perfil conectar
5. **Verificar lista**: Verificar que múltiplas contas aparecem na lista de integrações
6. **Resultado**: Lista mostrando 2+ contas conectadas com nomes/IDs distintos

### Dados a ocultar
- Tokens de acesso em texto livre
- IDs de organização em formato completo
- Dados de conexão sensíveis

### Critério de conclusão
Vídeo deve mostrar: interface de integrações → adição de nova conta → fluxo OAuth → lista de contas conectadas com múltiplos provedores visíveis.

---

## 6. `whatsapp_business_messaging` — Enviar e receber mensagens via WhatsApp Business

### Functionalidade real
Apenas no `DEFAULT_SCOPES`, não em `INSTAGGRAM_SCOPES` (WhatsApp é produto separado). Fluxo em `app/api/whatsapp/accounts/route.ts` POST constrói OAuth URL e no callback persiste conexão WhatsApp. O `whatsapp_business_messaging` scope concede acesso a API de mensagens.

### Pré-requisitos
- Número WhatsApp Business conectado (já configurado: WABA ID 801885496316680, phone number +55 11 91734-5249)
- Token de acesso WhatsApp Business válido
- Conta de teste para mensagens

### Roteiro de gravação
1. **Início**: Acessar `https://revolutionx.com.br/api/auth/meta?provider=whatsapp`
2. **Autorização**: Facebook WhatsApp Business onboarding dialog
3. **Redirect**: Retorno para callback Meta
4. **Operação**: Na seção WhatsApp, clicar em conectar/novo número
5. **Selecionar número**: Escolher número já registrado (+55 11 91734-5249)
6. **Resultado**: Conexão aparecendo como "Conectada" na lista de contas WhatsApp

### Dados a ocultar
- Números de telefone em formato completo (mascarar: +55 11 9*** -5*** )
- Tokens de acesso
- ID de WABA em formato completo

### Critério de conclusão
Vídeo deve mostrar: login WhatsApp → onboarding dialog → seleção de número → conta aparecendo como conectada na lista.

---

## 7. `ads_read` — Ler insights e relatórios de campanhas de anúncios

### Functionalidade real
Referenciado em `src/integrations/meta/adsInsights.ts` e `src/integrations/meta/resolveAccess.ts`. Endpoints Graph API `GET /{ads-id}/insights` ou similar. O scope `ads_read` é solicitado no OAuth mas a leitura real depende de IDs de campanhas existentes.

### Pré-requisitos
- Campanhas de anúncios Meta configuradas
- Token de acesso com `ads_read` permission
- IDs de campanhas/ativos para teste

### Roteiro de gravação
1. **Início**: Acessar seção de insights ou relatórios de anúncios
2. **Seleção**: Escolher campanha/ativo de teste
3. **Carregar dados**: Solicitar insights via API
4. **Resultado**: Métricas exibidas (impressões, cliques, gasto, alcance)

### Dados a ocultar
- IDs de campanhas em formato completo se não necessário
- Tokens de acesso
- Dados financeiros sensíveis (masks where possible)

### Critério de conclusão
Vídeo deve mostrar: interface de insights → seleção de campanha → dados de métricas carregados → tabela/graph com dados de anúncios.

---

## 8. `pages_read_engagement` — Métricas de engajamento páginas

### Functionalidade real
Apenas em `DEFAULT_SCOPES`, não em `INSTAGRAM_SCOPES`. Concede acesso a métricas de engajamento (likes, comentários, compartilhamentos) das páginas Facebook conectadas. Endpoint típico: `GET /{page-id}/insights`.

### Pré-requisitos
- Página Facebook conectada
- Pelo menos alguma métrica de engajamento registrada

### Roteiro de gravação
1. **Início**: Acessar seção de métricas/engajamento de página
2. **Seleção**: Escolher página Facebook conectada
3. **Carregar métricas**: Solicitar insights de engajamento
4. **Resultado**: Gráfico/tabela com métricas (engajamento, visitas, posts)

### Dados a ocultar
- IDs de página em formato completo
- Tokens de acesso
- Dados demográficos sensíveis

### Critério de conclusão
Vídeo deve mostrar: seleção de página → métricas de engajamento carregadas → dados visíveis (likes, comentários, compartilhamentos ou similares).

---

## 9. `pages_manage_ads` — Gerenciar anúncios páginas

### Functionalidade real
Apenas em `DEFAULT_SCOPES`, não em `INSTAGRAM_SCOPES`. Concede permissão para criar e gerenciar anúncios nas páginas conectadas. Endpoints: `GET /{page-id}/ads` ou criação de campaign/ad set.

### Pré-requisitos
- Página Facebook conectada
- Configuração de ads Manager ou acesso equivalente

### Roteiro de gravação
1. **Início**: Acessar seção de gerenciamento de anúncios da página
2. **Criar anúncio**: Selecionar objetivo, público, orçamento
3. **Configurar**: Definir criativo, placar, duração
4. **Publicar**: Submeter criação do anúncio
5. **Resultado**: Confirmação de criação ou rascunho criado

### Dados a ocultar
- IDs de campanha/publicidade em formato completo
- Orçamentos e dados financeiros
- Tokens de acesso

### Critério de conclusão
Vídeo deve mostrar: interface de creation de anúncio → preenchimento de campos → ação de criação → confirmação de rascunho/campanha criado.

---

## Directory Structure for Artifacts

```
artifacts/meta-app-review/
├── 01-pages_show_list/
│   └── video.mp4
├── 02-pages_manage_posts/
│   └── video.mp4
├── 03-instagram_basic/
│   └── video.mp4
├── 04-instagram_content_publish/
│   └── video.mp4
├── 05-business_management/
│   └── video.mp4
├── 06-whatsapp_business_messaging/
│   └── video.mp4
├── 07-ads_read/
│   └── video.mp4
├── 08-pages_read_engagement/
│   └── video.mp4
└── 09-pages_manage_ads/
    └── video.mp4
```

---

## Verification Checklist (before submitting to Meta)

- [ ] Todos os 9 vídeos gravados e verificáveis em `artifacts/meta-app-review/`
- [ ] Nenhum token de acesso exposto em texto livre em nenhum vídeo
- [ ] IDs de contas mascarados conforme diretrizes de cada seção
- [ ] Cada vídeo demonstra fluxo completo: login → operação → resultado
- [ ] TypeScript, lint, testes e build passaram após mudanças de código
- [ ] `docs/META_PERMISSION_AUDIT.md` gerado e inclui todas as justificativas
- [ ] Permissões desnecessárias removidas do código (5 scopes: `ads_management`, `catalog_management`, `manage_app_solution`, `instagram_branded_content_ads_brand`, `facebook_branded_content_ads_brand`)

---

## Próximas etapas (dependem de ação)

1. **Gravar vídeos** — usar Playwright ou navegador manual para cada um dos 9 fluxos acima
2. **Validar vídeos** — confirmar que cada um atende ao critério de conclusão
3. **Executar verificações finais** — `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`
4. **Gerar `docs/META_SCREENCAST_RESULTS.md`** — registrar resultados e caminhos dos vídeos
5. **Atualizar Meta Developer Console** — remover 5 scopes desnecessários, garantir que só os 9 necessários estejam solicitados

**Pare nesta etapa se necessário**: qualque fluxo que exija login humano, 2FA, token real, ou ação no painel da Meta requer confirmação antes de prosseguir. Nonexperimental flows excused.