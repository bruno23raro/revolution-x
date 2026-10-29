# RX_DOC_pages_read_engagement_20261027 — Screencast Documentation

## 1. USE CASE DESCRIPTION (EN)

Pages Read Engagement functionality in Revolution X allows authenticated users to view engagement metrics for connected Facebook Pages. This permission is classified as Level B — it is not actively called in real code flows but is retained as a dependent permission because `business_management` (Level A) is declared as a primary permission. Per Meta's official rule: "Se business_management entrar como dependência, o Meta permite declarar a permissão principal na descrição do use case." Without `business_management` declared, `pages_read_engagement` would risk rejection. With it declared, Meta accepts this permission as dependent. The permission grants access to `GET /{page-id}/insights` with `date_preset=last_30d&fields=engagement,comments,shares,likes` to display likes, comments, shares, and engagement rates for Facebook Pages connected through the `business_management` flow. In the app, this appears in the Page analytics section where users can view engagement statistics for their connected Pages.

Official Meta requirement (via dependency): "login + acessar conteúdo de um post + exibir" — justified by `business_management` dependency.

## 2. REQUISITOS DE SCREENCAST (texto oficial do Meta)

| Permissão | Requisito Oficial |
|-----------|-------------------|
| `pages_read_engagement` | login + acessar conteúdo de um post + exibir — justificada pela dependência de `business_management` |

## 3. ROTEIRO DO SCREENCAST (tabela tempo|ação|anotação EN, 60-120s)

| tempo | ação | anotação EN |
|-------|------|-------------|
| 0:00 | Acessar seção de métricas de engajamento | "Navigating to Page engagement metrics page" |
| 0:30 | Selecionar página Facebook conectada | "Selecting connected Facebook Page from list" |
| 1:00 | Solicitar métricas de engajamento | "Requesting engagement metrics via API" |
| 1:30 | Carregar gráfico/tabela com dados | "Loading engagement data chart/table" |
| 2:00 | Exibir likes, comentários, compartilhamentos | "Displaying likes, comments, shares metrics" |
| 2:30 | Verificar que métricas são precisas e atuais | "Verifying engagement metrics are accurate and current" |

## 4. INSTRUÇÕES DE TESTE PARA O REVISOR (EN, 4 etapas)

1. [Navigate to the Page engagement metrics page on revolutionx.com.br] — Access the analytics section and select a connected Facebook Page
2. [Select the Facebook Page to view engagement metrics] — Choose which connected Page to analyze
3. [Request and load engagement metrics data] — Click "Get Engagement Metrics" or similar and wait for data to load
4. [Verify likes, comments, shares are displayed] — Confirm all 3 engagement metrics have values

## 5. CHECKLIST

- [ ] Vídeo tem entre 60-120 segundos
- [ ] Resolução 1080p (1920x1080)
- [ ] Apenas a janela do app é visível (nenhuma barra de tarefa, desktop, outros apps)
- [ ] Sem áudio (mudo ou ruído de fundo aceitável, mas sem narração)
- [ ] Anotações em inglês em todos os frames
- [ ] Login completo (deslogado → logado → OAuth concluído)
- [ ] Concessão da permissão `pages_read_engagement` visível na tela (justificada por `business_management`)
- [ ] Métricas de engajamento visíveis (likes, comentários, compartilhamentos)
- [ ] Cursor visível e maior que padrão
- [ ] Interface em inglês (ou navegador em inglês)
- [ ] Vídeo está alinhado com a justificativa escrita: "login + acessar conteúdo de um post + exibir — justificada pela dependência de `business_management`"

## 6. NOME DO ARQUIVO DE VÍDEO

`RX_VID_pages_read_engagement_20261027.webm`

---

### Anotações em Inglês (detalhado)

- "Navigating to Page engagement metrics page"
- "Selecting connected Facebook Page from list"
- "Requesting engagement metrics via API"
- "Loading engagement data chart/table"
- "Displaying likes, comments, shares metrics"
- "Likes: [number]" (mostrar valor na tela)
- "Comments: [number]"
- "Shares: [number]"
- "Engagement rate: [percentage]"
- "Time range selector (last 30d, last 7d, etc.)"
- "Verifying engagement metrics are accurate and current"
- "Engagement metrics displayed for connected Page"