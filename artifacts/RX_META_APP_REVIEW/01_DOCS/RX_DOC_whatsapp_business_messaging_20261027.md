# RX_DOC_whatsapp_business_messaging_20261027 — Screencast Documentation

## 1. USE CASE DESCRIPTION (EN)

WhatsApp Business messaging functionality in Revolution X allows authenticated business users to send messages to customers via the WhatsApp Business API. This permission is core to the app's messaging capabilities — without it, no WhatsApp messages can be sent from the platform. The `whatsapp_business_messaging` scope is requested during the OAuth flow when connecting a WhatsApp Business account, and it grants access to the `POST /{phone-number-id}/messages` endpoint. In the app, this is used in the WhatsApp section where users can compose and send messages to registered customers. The scope is also necessary for the `runMassSend` functionality which sends broadcast messages to multiple recipients. This permission is classified as Level A because it has actual code execution (`src/integrations/meta/whatsappSender.ts` makes POST `/{phone-number-id}/messages`; `app/api/whatsapp/send/route.ts` uses `runMassSend`) and is essential for the core messaging use case of Revolution X.

Official Meta requirement: "o APP envia e o cliente WhatsApp recebe. Gravar o ENVIO pelo app, não o recebimento."

## 2. REQUISITOS DE SCREENCAST (texto oficial do Meta)

| Permissão | Requisito Oficial |
|-----------|-------------------|
| `whatsapp_business_messaging` | o APP envia e o cliente WhatsApp recebe. Gravar o ENVIO pelo app, não o recebimento. |

## 3. ROTEIRO DO SCREENCAST (tabela tempo|ação|anotação EN, 60-120s)

| tempo | ação | anotação EN |
|-------|------|-------------|
| 0:00 | Acessar página de conexão WhatsApp | "Navigating to WhatsApp connection page" |
| 0:30 | Clicar em "Conectar WhatsApp" | "Clicking Connect WhatsApp button" |
| 1:00 | Autorizar permissões no dialog da Meta | "Authorizing WhatsApp Business permissions in Meta dialog" |
| 1:30 | Selecionar número de telefone registrado | "Selecting registered phone number +55 11 9173-4529" |
| 2:00 | Verificar conexão aparecendo como conectada | "Verifying WhatsApp connection appears as connected in UI" |
| 2:30 | Navegar para section de envio de mensagens | "Navigating to WhatsApp message send section" |

## 4. INSTRUÇÕES DE TESTE PARA O REVISOR (EN, 4 etapas)

1. [Navigate to the WhatsApp connection page on revolutionx.com.br] — Access the integrations section and click "Connect WhatsApp"
2. [Authorize the app permissions in the Meta Facebook dialog] — Select the WhatsApp Business onboarding and authorize the requested permissions
3. [Select the registered phone number] — Choose the already-registered WhatsApp number (+55 11 9173-4529) and confirm connection
4. [Verify the message send flow in the app] — Navigate to the message sending section and confirm the WhatsApp connection is active and ready for sending

## 5. CHECKLIST

- [ ] Vídeo tem entre 60-120 segundos
- [ ] Resolução 1080p (1920x1080)
- [ ] Apenas a janela do app é visível (nenhuma barra de tarefa, desktop, outros apps)
- [ ] Sem áudio (mudo ou ruído de fundo aceitável, mas sem narração)
- [ ] Anotações em inglês em todos os frames
- [ ] Login completo (deslogado → logado → OAuth concluído)
- [ ] Concessão da permissão `whatsapp_business_messaging` visível na tela
- [ ] Fluxo de envio de mensagem visível (sem áudio)
- [ ] Cursor visível e maior que padrão
- [ ] Interface em inglês (ou navegador em inglês)
- [ ] Vídeo está alinhado com a justificativa escrita: "o APP envia e o cliente WhatsApp recebe. Gravar o ENVIO pelo app, não o recebimento."

## 6. NOME DO ARQUIVO DE VÍDEO

`RX_VID_whatsapp_business_messaging_20261027.webm`

---

### Anotações em Inglês (detalhado)

- "Navigating to WhatsApp connection page"
- "Clicking Connect WhatsApp button"
- "Authorizing WhatsApp Business permissions in Meta dialog"
- "Selecting registered phone number +55 11 9173-4529"
- "Verifying WhatsApp connection appears as connected in UI"
- "Navigating to WhatsApp message send section"
- (During send) "Composing test message in the send interface"
- (During send) "Clicking Send message button"
- (After send) "Verifying message send successfully visible in UI"
- "WhatsApp client receiving the message (client side)"
- "Connection status shows as active/connected"