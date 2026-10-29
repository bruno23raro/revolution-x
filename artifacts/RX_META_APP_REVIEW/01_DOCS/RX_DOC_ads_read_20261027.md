# RX_DOC_ads_read_20261027 — Screencast Documentation

## 1. USE CASE DESCRIPTION (EN)

Ads Read functionality in Revolution X allows authenticated users to view performance metrics and insights for Meta advertising campaigns. This permission is core to the app's analytics capabilities — without it, no ad performance data can be displayed. The `ads_read` scope is requested during the OAuth flow and it grants access to the Graph API endpoint `GET /{ad-account-id}/insights`. In the app, this is used in the Ads Insights section where users can view campaign performance including impressions, spend, clicks, reach, and conversions. The scope is also necessary for the `resolveAccess.ts` integration which fetches ad insights for display in the dashboard. This permission is classified as Level A because it has actual code execution (`src/integrations/meta/adsInsights.ts` makes `GET /{ad-account-id}/insights`; `resolveAccess.ts:222`) and is essential for the core analytics use case of Revolution X.

Official Meta requirement: "login + dados de performance + mostrar Impressions, Conversions, Spend, Clicks, Reach"

## 2. REQUISITOS DE SCREENCAST (texto oficial do Meta)

| Permissão | Requisito Oficial |
|-----------|-------------------|
| `ads_read` | login + dados de performance + mostrar Impressions, Conversions, Spend, Clicks, Reach |

## 3. ROTEIRO DO SCREENCAST (tabela tempo|ação|anotação EN, 60-120s)

| tempo | ação | anotação EN |
|-------|------|-------------|
| 0:00 | Acessar seção de insights de anúncios | "Navigating to Ads Insights page" |
| 0:30 | Selecionar conta de anúncios | "Selecting ad account ID" |
| 1:00 | Solicitar insights da campanha | "Requesting ad insights via API" |
| 1:30 | Carregar métricas de performance | "Loading performance metrics (impressions, spend, clicks)" |
| 2:00 | Exibir tabela com Impressions, Conversions, Spend, Clicks, Reach | "Displaying table with Impressions, Conversions, Spend, Clicks, Reach" |
| 2:30 | Verificar que os dados são precisos e atuais | "Verifying data is accurate and up-to-date" |

## 4. INSTRUÇÕES DE TESTE PARA O REVISOR (EN, 4 etapas)

1. [Navigate to the Ads Insights page on revolutionx.com.br] — Access the analytics section and select the ad account
2. [Select a campaign/ad set to view insights] — Choose an existing campaign from the dropdown
3. [Request and load ad insights data] — Click "Get Insights" or similar and wait for metrics to load
4. [Verify Impressions, Conversions, Spend, Clicks, Reach are displayed] — Confirm all 5 metrics are visible and have values

## 5. CHECKLIST

- [ ] Vídeo tem entre 60-120 segundos
- [ ] Resolução 1080p (1920x1080)
- [ ] Apenas a janela do app é visível (nenhuma barra de tarefa, desktop, outros apps)
- [ ] Sem áudio (mudo ou ruído de fundo aceitável, mas sem narração)
- [ ] Anotações em inglês em todos os frames
- [ ] Login completo (deslogado → logado → OAuth concluído)
- [ ] Concessão da permissão `ads_read` visível na tela
- [ ] Dados de performance visíveis (Impressions, Conversions, Spend, Clicks, Reach)
- [ ] Cursor visível e maior que padrão
- [ ] Interface em inglês (ou navegador em inglês)
- [ ] Vídeo está alinhado com a justificativa escrita: "login + dados de performance + mostrar Impressions, Conversions, Spend, Clicks, Reach"

## 6. NOME DO ARQUIVO DE VÍDEO

`RX_VID_ads_read_20261027.webm`

---

### Anotações em Inglês (detalhado)

- "Navigating to Ads Insights page"
- "Selecting ad account ID"
- "Selecting campaign/ad set from dropdown"
- "Requesting ad insights via API"
- "Loading performance metrics"
- "Displaying table with Impressions, Conversions, Spend, Clicks, Reach"
- "Impressions: [number]" (mostrar o valor na tela)
- "Conversions: [number]"
- "Spend: $[value]"
- "Clicks: [number]"
- "Reach: [number]"
- "Verifying data is accurate and up-to-date"
- "Time range selector (last 7d, last 30d, etc.)"