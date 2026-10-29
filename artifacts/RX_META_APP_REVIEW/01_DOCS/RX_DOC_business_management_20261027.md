# RX_DOC_business_management_20261027 — Screencast Documentation

## 1. USE CASE DESCRIPTION (EN)

Business Management functionality in Revolution X enables the app to manage multiple Meta accounts (Facebook Pages, Instagram Business profiles, and WhatsApp Business accounts) under a single organization. This permission is essential for the multi-tenant architecture of the platform — it allows the system to support users who operate across multiple Facebook Pages and Instagram accounts within the same Revolution X installation. The `business_management` scope is requested during the OAuth flow when connecting additional Meta accounts, and it grants access to the Graph API endpoints for managing business connections. In the app, this appears in the Integrations section where users can "Add account" to connect new Facebook/Instagram/WhatsApp resources under their organization. This permission is classified as Level A because it has actual code execution (`constants.ts:11` in DEFAULT_SCOPES; `oauth.ts:12` used in `processOAuthCallback`; `app/api/whatsapp/accounts/route.ts:66`; `app/api/instagram/accounts/route.ts:49`) and serves as the dependency driver for `pages_read_engagement` (Level B) per Meta's rule that "if business_management enters as a dependency, Meta allows declaring the primary permission in the use case description." Official Meta requirement: "declaração como dependência de `pages_show_list` na descrição."

## 2. REQUISITOS DE SCREENCAST (texto oficial do Meta)

| Permissão | Requisito Oficial |
|-----------|-------------------|
| `business_management` | declarar como dependência de `pages_show_list` na descrição |

## 3. ROTEIRO DO SCREENCAST (tabela tempo|ação|anotação EN, 60-120s)

| tempo | ação | anotação EN |
|-------|------|-------------|
| 0:00 | Acessar section de gerenciamento de integrações | "Navigating to Multi-account management page" |
| 0:30 | Clicar em "Conectar nova conta" | "Clicking Add account button" |
| 1:00 | Selecionar provedor (Facebook/Instagram/WhatsApp) | "Selecting Facebook/Instagram/WhatsApp as provider" |
| 1:30 | Autorizar fluxo OAuth com `business_management` scope | "Authorizing business management permissions in Meta dialog" |
| 2:00 | Selecionar conta a conectar (página/perfil) | "Selecting additional account to connect" |
| 2:30 | Verificar lista mostrando múltiplas contas conectadas | "Verifying multiple accounts visible in connections list" |

## 4. INSTRUÇÕES DE TESTE PARA O REVISOR (EN, 4 etapas)

1. [Navigate to the integrations management page on revolutionx.com.br] — Access the settings and click "Manage integrations" or "Connected accounts"
2. [Click "Add account" to connect a new Meta resource] — Select "Connect Facebook/Instagram/WhatsApp account"
3. [Authorize the app with business_management permissions] — Go through the Meta OAuth dialog and authorize the business_management scope
4. [Verify multiple accounts appear in the connections list] — Confirm that 2+ accounts are now listed with distinct names/IDs

## 5. CHECKLIST

- [ ] Vídeo tem entre 60-120 segundos
- [ ] Resolução 1080p (1920x1080)
- [ ] Apenas a janela do app é visível (nenhuma barra de tarefa, desktop, outros apps)
- [ ] Sem áudio (mudo ou ruído de fundo aceitável, mas sem narração)
- [ ] Anotações em inglês em todos os frames
- [ ] Login completo (deslogado → logado → OAuth concluído)
- [ ] Concessão da permissão `business_management` visível na tela
- [ ] Fluxo de conexão de múltiplas contas visível
- [ ] Cursor visível e maior que padrão
- [ ] Interface em inglês (ou navegador em inglês)
- [ ] Vídeo está alinhado com a justificativa escrita: "declarar como dependência de `pages_show_list` na descrição"

## 6. NOME DO ARQUIVO DE VÍDEO

`RX_VID_business_management_20261027.webm`

---

### Anotações em Inglês (detalhado)

- "Navigating to Multi-account management page"
- "Clicking Add account button"
- "Selecting Facebook/Instagram/WhatsApp as provider"
- "Authorizing business management permissions in Meta dialog"
- "Selecting additional account to connect"
- "Verifying multiple accounts visible in connections list"
- "Account connected successfully with name: [account name]"
- "Selecting Facebook page from list of available pages"
- "Instagram account selection and authorization"
- "WhatsApp Business number selection"
- "Final confirmation screen showing account addition complete"