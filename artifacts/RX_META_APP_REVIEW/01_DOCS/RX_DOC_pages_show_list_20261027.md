# RX_DOC_pages_show_list_20261027 — Screencast Documentation

## 1. USE CASE DESCRIPTION (EN)

Pages Show List functionality in Revolution X allows authenticated Facebook users to list and view all Facebook Pages connected to their account through the OAuth login flow. This permission is core to the app's Facebook integration — it's the first step in connecting any Facebook Page to the platform. Without `pages_show_list`, no Pages can be discovered or selected in the app. The `pages_show_list` scope is requested during the OAuth flow when logging in with Facebook, and it grants access to the Graph API endpoint `GET /me/accounts`. In the app, this appears in the Integrations section where users can see "Connected Pages" and select which Page to use for publishing, analytics, and other operations. This permission is classified as Level A because it has actual code execution (`constants.ts:6` in DEFAULT_SCOPES; `app/api/auth/callback/meta/route.ts` — Graph API `/me/accounts`; `app/api/auth/meta/route.ts:58` — builds OAuth URL; `app/api/instagram/accounts/route.ts:49`) and is essential for the core Facebook Page discovery use case of Revolution X.

Official Meta requirement: "login completo + Pages do usuário conectadas com sucesso"

## 2. REQUISITOS DE SCREENCAST (texto oficial do Meta)

| Permissão | Requisito Oficial |
|-----------|-------------------|
| `pages_show_list` | login completo + Pages do usuário conectadas com sucesso |

## 3. ROTEIRO DO SCREENCAST (tabela tempo|ação|anotação EN, 60-120s)

| tempo | ação | anotação EN |
|-------|------|-------------|
| 0:00 | Acessar login com Facebook | "Navigating to Facebook OAuth login page" |
| 0:30 | Clicar em "Login with Facebook" | "Clicking Facebook login button" |
| 1:00 | Autorizar permissões no dialog da Meta | "Authorizing Facebook permissions in Meta dialog" |
| 1:30 | Redirecionar de volta para revolutionx.com.br | "Redirecting back to revolutionx.com.br after OAuth" |
| 2:00 | Selecionar página da lista de páginas conectadas | "Selecting from list of connected Facebook pages" |
| 2:30 | Verificar que página aparece como "Conectada" | "Verifying selected page appears as 'Connected' in UI" |

## 4. INSTRUÇÕES DE TESTE PARA O REVISOR (EN, 4 etapas)

1. [Navigate to the Facebook login page on revolutionx.com.br] — Access the integrations section and click "Connect via Facebook" or "Login with Facebook"
2. [Authorize the app permissions in the Meta Facebook dialog] — Select the requested permissions and confirm the authorization
3. [Wait for redirect back to revolutionx.com.br] — Wait for the OAuth callback to complete and the page to reload
4. [Select a connected Facebook page from the list] — Choose one of the displayed connected pages and confirm it appears as "Connected"

## 5. CHECKLIST

- [ ] Vídeo tem entre 60-120 segundos
- [ ] Resolução 1080p (1920x1080)
- [ ] Apenas a janela do app é visível (nenhuma barra de tarefa, desktop, outros apps)
- [ ] Sem áudio (mudo ou ruído de fundo aceitável, mas sem narração)
- [ ] Anotações em inglês em todos os frames
- [ ] Login completo (deslogado → logado → OAuth concluído)
- [ ] Concessão da permissão `pages_show_list` visível na tela
- [ ] Lista de páginas Facebook conectadas exibida na UI
- [ ] Cursor visível e maior que padrão
- [ ] Interface em inglês (ou navegador em inglês)
- [ ] Vídeo está alinhado com a justificativa escrita: "login completo + Pages do usuário conectadas com sucesso"

## 6. NOME DO ARQUIVO DE VÍDEO

`RX_VID_pages_show_list_20261027.webm`

---

### Anotações em Inglês (detalhado)

- "Navigating to Facebook OAuth login page"
- "Clicking Facebook login button"
- "Authorizing Facebook permissions in Meta dialog"
- "Selecting Facebook permissions (pages_show_list, public_profile, etc.)"
- "Redirecting back to revolutionx.com.br after OAuth"
- "Loading connected pages list"
- "Displaying list of Facebook pages with names and IDs"
- "Selecting a page from the connected pages list"
- "Page appears as 'Connected' with name and profile picture"
- "Page selection confirmed in the UI"