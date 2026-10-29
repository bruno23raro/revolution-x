# RX_DOC_PADROES_SCREENCAST_20261027 — Regras Oficiais de Screencast Meta

## Requisitos Obrigatórios (Todos os vídeos)

- **Um vídeo por permissão** — 10 vídeos totais (8 Level A + 2 Level B)
- **Login completo** — do deslogado ao logado, fluxo OAuth finalizado
- **Concessão da permissão visível** — o prompt de autorização da Meta deve aparecer e ser aceito
- **Dado visível** — as métricas/resultados da operação solicitada devem aparecer na tela
- **SEM ÁUDIO** — o revisor não ouve áudio; não grave áudio nem narração
- **Anotações em inglês** — todos os comentários, labels e descrições devem estar em inglês
- **1080p** — resolução 1920x1080
- **Monitor <=1440px** — só a janela do app; barra de tarefas e outros apps devem ficar fora ou ser mascarados
- **UI em inglês** — a interface do revoluçãox.com.br deve estar em inglês ou o navegador deve estar em modo inglês
- **Cursor grande** — cursor visível e maior que o padrão
- **Duração: 60-120 segundos** — cada vídeo deve ter entre 1 e 2 minutos
- **Link público** — se o vídeo for hospedado, deve ser em link público (YouTube não listado, etc.)
- **O erro que mais reprova** — vídeo não alinhado com a justificativa escrita é o erro que mais faz o Meta review rejeitar

## Formato de Cada Arquivo RX_DOC_<permissao>_

Cada arquivo deve conter estas 6 seções:

### 1. USE CASE DESCRIPTION (EN, ~600-900 chars)

Descrição do caso de uso em inglês, pronta para colar no formulário de review. Deve cobrir:
- O que o caso de uso faz
- Por que a permissão é necessária
- Como ela é usada no fluxo do app
- Dados que serão exibidos

### 2. REQUISITOS DE SCREENCAST (texto oficial do Meta)

Tabela oficial por permissão (copiar exatamente):

| Permissão | Requisito Oficial |
|-----------|-------------------|
| `pages_show_list` | login completo + Pages do usuário conectadas com sucesso |
| `instagram_basic` | login + seleção da conta Instagram |
| `instagram_content_publish` | login + criar post de foto E publicar no feed |
| `pages_manage_posts` | login + publicar conteúdo na Page |
| `ads_read` | login + dados de performance + mostrar Impressions, Conversions, Spend, Clicks, Reach |
| `whatsapp_business_messaging` | o APP envia e o cliente WhatsApp recebe. Gravar o ENVIO pelo app, não o recebimento |
| `business_management` | declarar como dependência de `pages_show_list` na descrição |
| `pages_read_engagement` | login + acessar conteúdo de um post + exibir |
| `pages_manage_ads` | login + criar anúncio para a Page + mostrar criado |
| `pages_read_user_content` | dependência de `instagram_basic` |
| `whatsapp_business_management` | dependência de `whatsapp_business_messaging` |

### 3. ROTEIRO DO SCREENCAST (tabela tempo|ação|anotação EN, 60-120s)

Tabela com 3 colunas:
- **tempo** — minutos decorridos (ex: 0:00, 0:30, 1:00, 1:30)
- **ação** — o que acontece na tela (clique, digitação, seleção, etc.)
- **anotação EN** — texto em inglês que aparece no vídeo (ex: "Clicking Facebook login button", "Selecting Instagram account", etc.)

Pelo menos 4-6 etapas por vídeo, cobrindo: login → autorização → operação → resultado.

### 4. INSTRUÇÕES DE TESTE PARA O REVISOR (EN, 4 etapas)

4 etapas em inglês para o revisor do Meta:

1. [Passo 1 em EN] — ex: "Navigate to the Meta OAuth login page"
2. [Passo 2 em EN] — ex: "Authorize the app with the requested permissions"
3. [Passo 3 em EN] — ex: "Perform the core action (post send, page selection, etc.)"
4. [Passo 4 em EN] — ex: "Verify the result is displayed correctly"

### 5. CHECKLIST

Checklist para validar antes de enviar o vídeo:

- [ ] Vídeo tem entre 60-120 segundos
- [ ] Resolução 1080p (1920x1080)
- [ ] Apenas a janela do app é visível (nenhuma barra de tarefa, desktop, outros apps)
- [ ] Sem áudio (mudo ou ruído de fundo aceitável, mas sem narração)
- [ ] Anotações em inglês em todos os frames
- [ ] Login completo (deslogado → logado → OAuth concluído)
- [ ] Concessão da permissão Meta visível na tela
- [ ] Dado da operação visível (métricas, postagem, página, etc.)
- [ ] Cursor visível e maior que padrão
- [ ] Interface em inglês (ou navegador em inglês)
- [ ] Vídeo está alinhado com a justificativa escrita no doc

### 6. NOME DO ARQUIVO DE VÍDEO

Padrão: `RX_VID_<permissao>_<data>.webm` ou `.mp4`

Exemplos:
- `RX_VID_whatsapp_business_messaging_20261027.webm`
- `RX_VID_business_management_20261027.webm`
- `RX_VID_pages_read_engagement_20261027.webm`

---

## Formato do Roteiro do Screencast (tabela tempo|ação|anotação EN)

Cada vídeo deve ter no mínimo 4 etapas cobrindo o fluxo completo:

| tempo | ação | anotação EN |
|-------|------|-------------|
| 0:00 | Acessar página de login do Meta OAuth | "Navigating to Meta OAuth login page" |
| 0:30 | Clicar no botão "Login with Facebook" | "Clicking Facebook login button" |
| 1:00 | Digitar credenciais de teste | "Entering test Facebook credentials" |
| 1:30 | Autorizar permissões no dialog da Meta | "Authorizing app permissions in Meta dialog" |
| 2:00 | Perform core action (varies por permissão) | "Performing core action" |
| 2:30 | Verificar resultado na UI | "Verifying result displayed in UI" |

---

## Anotações em Inglês — Exemplos por Permissão

### `whatsapp_business_messaging`
- "Navigating to WhatsApp connection page"
- "Clicking Connect WhatsApp button"
- "Authorizing WhatsApp Business permissions"
- "Selecting registered phone number"
- "Message sent successfully visible in UI"
- "Verifying message send flow completed"

### `business_management`
- "Navigating to Multi-account management page"
- "Clicking Add account button"
- "Selecting Facebook/Instagram/WhatsApp provider"
- "Authorizing business management permissions"
- "Selecting additional account to connect"
- "Multiple accounts visible in list"

### `pages_read_engagement`
- "Navigating to Page engagement metrics page"
- "Selecting connected Facebook page"
- "Loading engagement metrics (likes, comments, shares)"
- "Displaying engagement data in chart/table"
- "Verifying metrics are visible and accurate"

### `pages_manage_ads`
- "Navigating to Page Ads creation page"
- "Selecting Facebook page for ad"
- " filling ad objective and audience"
- "Submitting ad creation"
- "Confirming ad was created successfully"
- "Verifying ad appears in Page ads manager"