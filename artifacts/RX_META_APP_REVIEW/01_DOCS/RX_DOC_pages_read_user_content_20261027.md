# RX_DOC_pages_read_user_content_20261027 — Screencast Documentation

## 1. USE CASE DESCRIPTION (EN)

Pages Read User Content functionality in Revolution X allows authenticated Instagram Business users to read content from Instagram profiles and Facebook Pages. This permission is classified as Level B — it is a dependent permission of `instagram_basic` (Level A) per the official Meta dependency chart. The `instagram_basic` scope grants access to `GET /{ig-user-id}` which returns basic profile info, and `pages_read_user_content` extends this capability to read additional content from pages and profiles. Per Meta's rule: "instagram_basic -> pages_read_user_content, pages_show_list". In the app, this permission is used when the app needs to read additional content beyond basic profile info — such as reading post content, comments, or additional profile data that requires this scope. This permission is classified as Level B because it is dependent on `instagram_basic` (Level A) and is not independently called in real code flows, but is retained because Meta accepts dependent permissions when the primary permission is declared.

Official Meta requirement (via dependency): "dependência de `instagram_basic`" — the permission is needed to read user content from Instagram as part of the `instagram_basic` flow.

## 2. REQUISITOS DE SCREENCAST (texto oficial do Meta)

| Permissão | Requisito Oficial |
|-----------|-------------------|
| `pages_read_user_content` | dependência de `instagram_basic` |

## 3. ROTEIRO DO SCREENCAST (tabela tempo|ação|anotação EN, 60-120s)

| tempo | ação | anotação EN |
|-------|------|-------------|
| 0:00 | Acessar section de leitura de conteúdo | "Navigating to Page/Profile content reading section" |
| 0:30 | Selecionar perfil Instagram ou Page Facebook | "Selecting Instagram profile or Facebook Page" |
| 1:00 | Solicitar leitura de conteúdo adicional | "Requesting additional content read via API" |
| 1:30 | Carregar dados de conteúdo | "Loading additional content data" |
| 2:00 | Exibir conteúdo lido (posts, comentários) | "Displaying read content (posts, comments)" |
| 2:30 | Verificar que conteúdo está acessível | "Verifying content is accessible and visible" |

## 4. INSTRUÇÕES DE TESTE PARA O REVISOR (EN, 4 etapas)

1. [Navigate to the content reading page on revolutionx.com.br] — Access the integrations section and select "Read content" or similar for a connected Instagram profile/Page
2. [Select the Instagram profile or Facebook Page] — Choose which connected account to read content from
3. [Request and load additional content] — Click "Read Content" or similar and wait for additional data to load
4. [Verify content is displayed] — Confirm that additional content (posts, comments, or profile data) is visible

## 5. CHECKLIST

- [ ] Vídeo tem entre 60-120 segundos
- [ ] Resolução 1080p (1920x1080)
- [ ] Apenas a janela do app é visível (nenhuma barra de tarefa, desktop, outros apps)
- [ ] Sem áudio (mudo ou ruído de fundo aceitável, mas sem narração)
- [ ] Anotações em inglês em todos os frames
- [ ] Login completo (deslogado → logado → OAuth concluído)
- [ ] Concessão da permissão `pages_read_user_content` visível na tela (justificada por `instagram_basic`)
- [ ] Conteúdo adicional visível (posts, comentários ou dados de perfil)
- [ ] Cursor visível e maior que padrão
- [ ] Interface em inglês (ou navegador em inglês)
- [ ] Vídeo está alinhado com a justificativa escrita: "dependência de `instagram_basic`"

## 6. NOME DO ARQUIVO DE VÍDEO

`RX_VID_pages_read_user_content_20261027.webm`

---

### Anotações em Inglês (detalhado)

- "Navigating to Page/Profile content reading section"
- "Selecting Instagram profile or Facebook Page from connections"
- "Requesting additional content read via API"
- "Loading additional content data"
- "Displaying read content (posts, comments, profile data)"
- "Posts: [number]" (mostrar número de posts)
- "Comments: [number]" (mostrar número de comentários)
- "Profile data visible (bio, name, etc.)"
- "Content accessibility verified"
- "Additional content loaded successfully"
- "LIGAR CHAMADA: dependência de `instagram_basic`, não chamada independente"