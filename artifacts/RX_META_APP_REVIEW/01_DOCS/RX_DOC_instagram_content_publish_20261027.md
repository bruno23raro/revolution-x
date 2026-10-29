# RX_DOC_instagram_content_publish_20261027 — Screencast Documentation

## 1. USE CASE DESCRIPTION (EN)

Instagram Content Publish functionality in Revolution X allows authenticated Instagram Business users to create and publish photo and video posts to their Instagram feed. This permission is core to the app's Instagram publishing capabilities — without it, no content can be published to Instagram. The `instagram_content_publish` scope is requested during the OAuth flow when connecting an Instagram Business account with publishing rights, and it grants access to the 2-step Graph API: `POST /{ig-user-id}/media` (create media container) + `POST /{ig-user-id}/media_publish` (publish container). In the app, this appears in the Instagram publishing section where users can upload a photo/video, add a caption, and publish to their feed. The permission is also necessary for the `instagramPublisher.ts` fluxo de 2 passos (container → publish). This permission is classified as Level A because it has actual code execution (`constants.ts:9` in DEFAULT_SCOPES; `INSTAGRAM_SCOPES` in `instagram/oauth.ts:24`; `src/integrations/instagram/instagramPublisher.ts` — 2-step flow) and is essential for the core Instagram publishing use case of Revolution X.

Official Meta requirement: "login + criar post de foto E publicar no feed"

## 2. REQUISITOS DE SCREENCAST (texto oficial do Meta)

| Permissão | Requisito Oficial |
|-----------|-------------------|
| `instagram_content_publish` | login + criar post de foto E publicar no feed |

## 3. ROTEIRO DO SCREENCAST (tabela tempo|ação|anotação EN, 60-120s)

| tempo | ação | anotação EN |
|-------|------|-------------|
| 0:00 | Acessar section de publicação Instagram | "Navigating to Instagram publishing section" |
| 0:30 | Selecionar tipo de mídia (IMAGE/REEL) | "Selecting media type (IMAGE or REEL)" |
| 1:00 | URL da mídia de teste (imagem pública) | "Entering test image URL or selecting video" |
| 1:30 | Digitar legenda opcional | "Entering optional caption" |
| 2:00 | Clicar em "Publicar agora" ou "Agendar" | "Clicking Publish now or Schedule button" |
| 2:30 | Confirmar postagem no feed Instagram | "Confirming post published to Instagram feed" |

## 4. INSTRUÇÕES DE TESTE PARA O REVISOR (EN, 4 etapas)

1. [Navigate to the Instagram publishing page on revolutionx.com.br] — Access the integrations section and click "Publish Instagram" or "Create new post"
2. [Select media type (IMAGE or REEL) and add test media] — Choose IMAGE or REEL and provide a public URL or select from library
3. [Add optional caption and configure publishing options] — Enter a test caption and choose "Publish now" or schedule
4. [Publish and confirm the post appears in the Instagram feed] — Click publish and verify the post is live on the Instagram profile

## 5. CHECKLIST

- [ ] Vídeo tem entre 60-120 segundos
- [ ] Resolução 1080p (1920x1080)
- [ ] Apenas a janela do app é visível (nenhuma barra de tarefa, desktop, outros apps)
- [ ] Sem áudio (mudo ou ruído de fundo aceitável, mas sem narração)
- [ ] Anotações em inglês em todos os frames
- [ ] Login completo (deslogado → logado → OAuth concluído)
- [ ] Concessão da permissão `instagram_content_publish` visível na tela
- [ ] Postagem de foto ou vídeo no feed Instagram visível
- [ ] Legenda (caption) visível opcional
- [ ] Cursor visível e maior que padrão
- [ ] Interface em inglês (ou navegador em inglês)
- [ ] Vídeo está alinhado com a justificativa escrita: "login + criar post de foto E publicar no feed"

## 6. NOME DO ARQUIVO DE VÍDEO

`RX_VID_instagram_content_publish_20261027.webm`

---

### Anotações em Inglês (detalhado)

- "Navigating to Instagram publishing section"
- "Selecting media type (IMAGE or REEL)"
- "Entering test image URL or selecting video from library"
- "Entering optional caption for the post"
- "Clicking Publish now or Schedule button"
- "Scheduling options (date, time) visible"
- "Posting to Instagram feed in progress"
- "Media ID returned: [ID]"
- "Post appears on Instagram feed successfully"
- "Post with caption visible on profile grid"
- "Confirming publication completed"