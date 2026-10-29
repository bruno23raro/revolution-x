# RX_DOC_whatsapp_business_management_20261027 — Screencast Documentation

## 1. USE CASE DESCRIPTION (EN)

WhatsApp Business Management functionality in Revolution X allows the app to manage WhatsApp Business Account (WABA) configurations, including webhook setup, phone number management, and event logging for conversion events (purchase, add-to-cart, leads). This permission is classified as Level B — it is a dependent permission of `whatsapp_business_messaging` (Level A) per the project's audit classification. The `whatsapp_business_messaging` scope grants access to the `POST /{phone-number-id}/messages` endpoint for sending messages, and `whatsapp_business_management` extends this to WABA configuration and event logging. Per the project audit: "whatsapp_business_management: dependência de whatsapp_business_messaging" — this permission is needed for WABA admin configuration but is not used for message sending. The project decided to CUT this permission from the original scope but later re-added it as a Level B dependency. The official Meta requirement notes: " temos WABA aprovada e webhook configurado. Se o webhook recebe evento, a permissão É usada." — confirming that this permission is used when webhook events are received. This permission is classified as Level B because it is dependent on `whatsapp_business_messaging` (Level A) and serves WABA administration and event logging purposes rather than direct message sending.

Official Meta requirement (via dependency): "dependência de `whatsapp_business_messaging`"

## 2. REQUISITOS DE SCREENCAST (texto oficial do Meta)

| Permissão | Requisito Oficial |
|-----------|-------------------|
| `whatsapp_business_management` | dependência de `whatsapp_business_messaging` |

## 3. ROTEIRO DO SCREENCAST (tabela tempo|ação|anotação EN, 60-120s)

| tempo | ação | anotação EN |
|-------|------|-------------|
| 0:00 | Acessar section de gerenciamento WABA | "Navigating to WhatsApp Business Account management page" |
| 0:30 | Verificar WABA já configurada | "Verifying WABA is already configured (ID: 801885496316680)" |
| 1:00 | Acessar configurações de webhook | "Accessing webhook configuration settings" |
| 1:30 | Confirmar webhook recebendo eventos | "Confirming webhook is receiving events (purchase, add-to-cart, leads)" |
| 2:00 | Gerenciar números de telefone da WABA | "Managing WhatsApp Business phone numbers" |
| 2:30 | Verificar lista de números e configurações | "Verifying phone number list and configurations" |

## 4. INSTRUÇÕES DE TESTE PARA O REVISOR (EN, 4 etapas)

1. [Navigate to the WhatsApp Business management page on revolutionx.com.br] — Access the integrations section and click "Manage WhatsApp" or "WABA settings"
2. [Verify WABA is already configured] — Confirm the WABA ID (801885496316680) appears as connected and configured
3. [Access webhook configuration and confirm event reception] — Go to webhook settings and verify that purchase, add-to-cart, and lead events are being received
4. [Manage phone numbers and verify configurations] — View the list of registered phone numbers and confirm their configurations are correct

## 5. CHECKLIST

- [ ] Vídeo tem entre 60-120 segundos
- [ ] Resolução 1080p (1920x1080)
- [ ] Apenas a janela do app é visível (nenhuma barra de tarefa, desktop, outros apps)
- [ ] Sem áudio (mudo ou ruído de fundo aceitável, mas sem narração)
- [ ] Anotações em inglês em todos os frames
- [ ] Login completo (deslogado → logado → OAuth concluído)
- [ ] Concessão da permissão `whatsapp_business_management` visível na tela (justificada por `whatsapp_business_messaging`)
- [ ] WABA configurada (ID: 801885496316680) visível na tela
- [ ] Webhook recebendo eventos (purchase, add-to-cart, leads) visível
- [ ] Cursor visível e maior que padrão
- [ ] Interface em inglês (ou navegador em inglês)
- [ ] Vídeo está alinhado com a justificativa escrita: "dependência de `whatsapp_business_messaging` — admin configuração WABA e log de eventos de conversão"

## 6. NOME DO ARQUIVO DE VÍDEO

`RX_VID_whatsapp_business_management_20261027.webm`

---

### Anotações em Inglês (detalhado)

- "Navigating to WhatsApp Business Account management page"
- "Verifying WABA is already configured (ID: 801885496316680)"
- "Accessing webhook configuration settings"
- "Confirming webhook is receiving events (purchase, add-to-cart, leads)"
- "Event: purchase — visible in webhook logs"
- "Event: add-to-cart — visible in webhook logs"
- "Event: lead — visible in webhook logs"
- "Managing WhatsApp Business phone numbers"
- "Phone number list visible with configurations"
- "Phone number: +55 11 9173-4529 configured"
- "Webhook event logging active"
- "WABA administration confirmed"
- "LIGAR CHAMADA: dependência de `whatsapp_business_messaging`, admin WABA apenas"