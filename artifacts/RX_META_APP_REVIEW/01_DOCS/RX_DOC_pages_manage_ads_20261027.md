# RX_DOC_pages_manage_ads_20261027 — Screencast Documentation

## 1. USE CASE DESCRIPTION (EN)

Pages Manage Ads functionality in Revolution X allows authenticated Facebook Page admins to create and manage advertisements for their Facebook Page. This permission is classified as Level B — it is defined in `constants.ts:15` in DEFAULT_SCOPES but has no actual API calls in the codebase. The permission is retained as optional because it provides ad management capabilities that complement the `pages_manage_posts` (Level A) permission. Per the decision in the audit: "MAINTAIN as optional level B, but LIGAR uma chamada real (POST /{page-id}/ads ou boost de post) para não reprovar por falta de uso." If a real call cannot be demonstrated, the video should be marked "LIGAR CHAMADA" in the manifest. The scope grants access to `POST /{page-id}/ads` for creating ads and `GET /{page-id}/ads` for listing existing ads. In the app, this appears in the Page ads management section where users can create new ad campaigns, set objectives, audiences, budgets, and durations. This permission is classified as Level B because it has code definition only (`constants.ts:15`) without real API calls, but is retained for future ad management capabilities.

Official Meta requirement (if demonstrated): "login + criar anúncio para a Page + mostrar criado"

## 2. REQUISITOS DE SCREENCAST (texto oficial do Meta)

| Permissão | Requisito Oficial |
|-----------|-------------------|
| `pages_manage_ads` | login + criar anúncio para a Page + mostrar criado |

## 3. ROTEIRO DO SCREENCAST (tabela tempo|ação|anotação EN, 60-120s)

| tempo | ação | anotação EN |
|-------|------|-------------|
| 0:00 | Acessar section de gerenciamento de Anúncios | "Navigating to Page Ads management section" |
| 0:30 | Selecionar página conectada | "Selecting connected Facebook Page from list" |
| 1:00 | Preencher objetivo do anúncio | " filling ad objective (LINK_CLICKS, etc.)" |
| 1:30 | Definir público e orçamento | "Defining audience and budget" |
| 2:00 | Submeter criação do anúncio | "Submitting ad creation" |
| 2:30 | Confirmar rascunho ou campanha criado | "Confirming ad draft or campaign created" |

## 4. INSTRUÇÕES DE TESTE PARA O REVISOR (EN, 4 etapas)

1. [Navigate to the Page Ads management page on revolutionx.com.br] — Access the integrations section, select a connected Page, and click "Manage Ads" or "Create ad"
2. [Select the Facebook Page from the connections list] — Choose which connected Page to create ads for
3. [Fill in ad details: objective, audience, budget, duration] — Enter the ad creation form with test values
4. [Submit ad creation and verify draft/campaign is created] — Submit the form and confirm the ad appears as a draft or campaign

## 5. CHECKLIST

- [ ] Vídeo tem entre 60-120 segundos
- [ ] Resolução 1080p (1920x1080)
- [ ] Apenas a janela do app é visível (nenhuma barra de tarefa, desktop, outros apps)
- [ ] Sem áudio (mudo ou ruído de fundo aceitável, mas sem narração)
- [ ] Anotações em inglês em todos os frames
- [ ] Login completo (deslogado → logado → OAuth concluído)
- [ ] Concessão da permissão `pages_manage_ads` visível na tela
- [ ] Interface de criação de anúncio visível
- [ ] Cursor visível e maior que padrão
- [ ] Interface em inglês (ou navegador em inglês)
- [ ] Vídeo está alinhado com a justificativa escrita: "Level B — defined in constants, not actively called; retain with 'LIGAR CHAMADA' note if no real call"

## 6. NOME DO ARQUIVO DE VÍDEO

`RX_VID_pages_manage_ads_20261027.webm`

---

### Anotações em Inglês (detalhado)

- "Navigating to Page Ads management section"
- "Selecting connected Facebook Page from list"
- " filling ad objective (LINK_CLICKS, etc.)"
- "Defining audience (age, location, interests)"
- "Setting budget and duration for the ad"
- "Submitting ad creation form"
- "Ad creation submitted — draft/campaign created"
- "Ad appears in Page Ads manager as draft"
- "Ad campaign setup completed"
- "Confirmation screen ad was created successfully"
- "LIGAR CHAMADA: se não houver chamada real, registrar no manifest"