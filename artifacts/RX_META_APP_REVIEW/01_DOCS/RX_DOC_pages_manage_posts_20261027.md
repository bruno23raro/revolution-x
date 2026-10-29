# RX_DOC_pages_manage_posts_20261027 — Screencast Documentation

## 1. USE CASE DESCRIPTION (EN)

Pages Manage Posts functionality in Revolution X allows authenticated Facebook Page admins to publish content directly to their Facebook Page's feed. This permission is core to the app's Facebook Page posting capabilities — without it, no posts can be published to Facebook Pages. The `pages_manage_posts` scope is requested during the OAuth flow when connecting a Facebook Page, and it grants access to the Graph API endpoint `POST /{page-id}/feed`. In the app, this appears in the Page publishing section where users can compose a post, add media (image/video), and click "Publish" or "Schedule" to publish to their connected Facebook Page. This permission is classified as Level A because it has actual code execution (`constants.ts:7` in DEFAULT_SCOPES; `src/integrations/meta/facebookPublisher.ts` makes POST `/{page-id}/feed` for page posts) and is essential for the core Facebook Page posting use case of Revolution X.

Official Meta requirement: "login + publicar conteúdo na Page"

## 2. REQUISITOS DE SCREENCAST (texto oficial do Meta)

| Permissão | Requisito Oficial |
|-----------|-------------------|
| `pages_manage_posts` | login + publicar conteúdo na Page |

## 3. ROTEIRO DO SCREENCAST (tabela tempo|ação|anotação EN, 60-120s)

| tempo | ação | anotação EN |
|-------|------|-------------|
| 0:00 | Acessar section de publicação de Posts | "Navigating to Facebook Page posts publishing section" |
| 0:30 | Selecionar página conectada da lista | "Selecting connected Facebook Page from list" |
| 1:00 | Digitar texto do post no campo de conteúdo | "Entering post text in content field" |
| 1:30 | (Opcional) Selecionar imagem ou vídeo | "(Optional) Selecting image or video to attach" |
| 2:00 | Clicar em "Publicar" ou "Agendar" | "Clicking Publish or Schedule button" |
| 2:30 | Confirmar postagem aparecendo no feed da Page | "Confirming post appears in Facebook Page feed" |

## 4. INSTRUÇÕES DE TESTE PARA O REVISOR (EN, 4 etapas)

1. [Navigate to the Facebook Page publishing page on revolutionx.com.br] — Access the integrations section, select a connected Page, and click "Publish post" or similar
2. [Select the Facebook Page from the connections list] — Choose which connected Page to publish to
3. [Enter post text and optionally add media] — Type the test post content and attach an image or video
4. [Click Publish/Schedule and verify the post appears on the Page feed] — Publish the post and confirm it's live on the Facebook Page

## 5. CHECKLIST

- [ ] Vídeo tem entre 60-120 segundos
- [ ] Resolução 1080p (1920x1080)
- [ ] Apenas a janela do app é visível (nenhuma barra de tarefa, desktop, outros apps)
- [ ] Sem áudio (mudo ou ruído de fundo aceitável, mas sem narração)
- [ ] Anotações em inglês em todos os frames
- [ ] Login completo (deslogado → logado → OAuth concluído)
- [ ] Concessão da permissão `pages_manage_posts` visível na tela
- [ ] Postagem de conteúdo na Page Facebook visível
- [ ] Cursor visível e maior que padrão
- [ ] Interface em inglês (ou navegador em inglês)
- [ ] Vídeo está alinhado com a justificativa escrita: "login + publicar conteúdo na Page"

## 6. NOME DO ARQUIVO DE VÍDEO

`RX_VID_pages_manage_posts_20261027.webm`

---

### Anotações em Inglês (detalhado)

- "Navigating to Facebook Page posts publishing section"
- "Selecting connected Facebook Page from list"
- "Entering post text in content field"
- "(Optional) Selecting image or video to attach"
- "Clicking Publish or Schedule button"
- "Scheduling options visible (date, time)"
- "Posting to Facebook Page feed in progress"
- "Post appears on Facebook Page feed successfully"
- "Post with text and image visible on Page timeline"
- "Publication confirmed with success message"