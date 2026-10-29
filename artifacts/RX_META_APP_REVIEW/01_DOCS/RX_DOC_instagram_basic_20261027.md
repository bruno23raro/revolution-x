# RX_DOC_instagram_basic_20261027 — Screencast Documentation

## 1. USE CASE DESCRIPTION (EN)

Instagram Basic profile info functionality in Revolution X allows authenticated Instagram Business users to access basic profile information about their connected Instagram account. This permission is core to the app's Instagram integration — it grants access to the `GET /{ig-user-id}` endpoint which returns username, name, biography, follower count, and other basic profile data. The `instagram_basic` scope is requested during the OAuth flow when connecting an Instagram Business account, and it is also a dependency of `pages_read_user_content` (Level B) per the official Meta dependency chart. In the app, this appears in the Instagram section where users can view their connected profile's basic information including follower count and profile stats. This permission is classified as Level A because it has actual code execution (`constants.ts:8` in DEFAULT_SCOPES; `INSTAGRAM_SCOPES` in `instagram/oauth.ts:23-29`; `app/api/instagram/accounts/route.ts:4,49`) and is essential for the core Instagram profile access use case of Revolution X.

Official Meta requirement: "login + seleção da conta Instagram"

## 2. REQUISITOS DE SCREENCAST (texto oficial do Meta)

| Permissão | Requisito Oficial |
|-----------|-------------------|
| `instagram_basic` | login + seleção da conta Instagram |

## 3. ROTEIRO DO SCREENCAST (tabela tempo|ação|anotação EN, 60-120s)

| tempo | ação | anotação EN |
|-------|------|-------------|
| 0:00 | Acessar login com Instagram | "Navigating to Instagram OAuth login page" |
| 0:30 | Clicar em "Conectar Instagram" | "Clicking Connect Instagram button" |
| 1:00 | Autorizar permissões no dialog da Meta/Instagram | "Authorizing Instagram permissions in Meta/Instagram dialog" |
| 1:30 | Redirecionar de volta para revolutionx.com.br | "Redirecting back to revolutionx.com.br after OAuth" |
| 2:00 | Selecionar conta Instagram da lista | "Selecting Instagram account from connection list" |
| 2:30 | Perfil Instagram exibindo username e follower count | "Displaying Instagram profile with username and follower count" |

## 4. INSTRUÇÕES DE TESTE PARA O REVISOR (EN, 4 etapas)

1. [Navigate to the Instagram connection page on revolutionx.com.br] — Access the integrations section and click "Connect Instagram" or "Log in with Instagram"
2. [Authorize the app permissions in the Meta/Instagram dialog] — Select "Instagram Business" and authorize the requested permissions
3. [Wait for redirect back to revolutionx.com.br] — Wait for the OAuth callback to complete
4. [View the connected Instagram profile with basic info] — Confirm the profile displays username, name, and follower count

## 5. CHECKLIST

- [ ] Vídeo tem entre 60-120 segundos
- [ ] Resolução 1080p (1920x1080)
- [ ] Apenas a janela do app é visível (nenhuma barra de tarefa, desktop, outros apps)
- [ ] Sem áudio (mudo ou ruído de fundo aceitável, mas sem narração)
- [ ] Anotações em inglês em todos os frames
- [ ] Login completo (deslogado → logado → OAuth concluído)
- [ ] Concessão da permissão `instagram_basic` visível na tela
- [ ] Perfil Instagram exibindo username e follower count
- [ ] Cursor visível e maior que padrão
- [ ] Interface em inglês (ou navegador em inglês)
- [ ] Vídeo está alinhado com a justificativa escrita: "login + seleção da conta Instagram"

## 6. NOME DO ARQUIVO DE VÍDEO

`RX_VID_instagram_basic_20261027.webm`

---

### Anotações em Inglês (detalhado)

- "Navigating to Instagram OAuth login page"
- "Clicking Connect Instagram button"
- "Authorizing Instagram permissions in Meta/Instagram dialog"
- "Selecting Instagram Business account"
- "Redirecting back to revolutionx.com.br after OAuth"
- "Loading connected Instagram accounts"
- "Displaying Instagram profile with username: [username]"
- "Follower count: [number]"
- "Profile name: [name]"
- "Bio/biography field visible"
- "Profile selection confirmed in the UI"
- "Instagram account connection successful"