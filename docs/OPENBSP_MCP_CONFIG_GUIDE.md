# OpenBSP — Configuração MCP e Integração com Revolution X

**Data:** 2026-11-07  
**Status da integração:** ✅ Webhook configurado | ⚠️ MCP precisa ser configurado manualmente

---

## 1. O que já está configurado

| Item | Status | Valor |
|------|--------|-------|
| Webhook `messages` | ✅ Criado | `https://revolutionx.com.br/api/webhooks/openbsp/messages` |
| Webhook `accounts` | ❌ Erro 400 | Tabela pode não estar disponível — não necessário |
| OPENBSP_BASE_URL | ✅ Configurado | `https://nheelwshzbgenpavwhcy.supabase.co/rest/v1` |
| OPENBSP_ORG_ID | ✅ Configurado | `9d7114cd-013e-4e03-b91d-848518bf6514` |
| Chave API existente | ✅ Gerada | `sk_c1191f...85c479e25` |
| Pré-processamento mídia | ✅ Configurado | Modelo: `gemini-2.5-flash` |
| GEMINI_API_KEY | ✅ No .env.local | Disponível para uso |

---

## 2. Como configurar o Cliente MCP no OpenBSP

Acesse o painel OpenBSP: **https://web.openbsp.dev**

### Passo 1: Adicionar Cliente MCP

Vá em **Configurações > Clientes MCP** → **Adicionar cliente MCP**

Preencha os campos assim:

| Campo | Valor | Explicação |
|-------|-------|------------|
| **Nome** | `Revolution X` | Identificador do seu sistema |
| **URL** | `https://mcp.openbsp.dev/sse` | URL padrão SSE do OpenBSP |
| **Token** | Deixar vazio (opcional) | Usaremos headers customizados |

### Passo 2: Configurar Headers HTTP Personalizados

No mesmo formulário, adicione estes cabeçalhos:

| Header | Valor |
|--------|-------|
| `organization-id` | `9d7114cd-013e-4e03-b91d-848518bf6514` |
| `agent-id` | `revx-agent-main` |

> **Nota**: Os outros headers (`organization-address`, `conversation-id`, `contact-id`, `contact-address`) são gerados dinamicamente pelo sistema e não precisam ser fixos.

---

## 3. Configurar Agente de IA no OpenBSP

Vá em **Agentes > Novo Agente**

| Campo | Valor |
|-------|-------|
| **Nome** | `Revolution X Assistant` |
| **Status** | `Ativo` |
| **Instruções** | `Você é um assistente de marketing automatizado da Revolution X. Responda mensagens de clientes com empatia, profissionalismo e foco em conversão. Sempre inclua CTA (call-to-action). Use português brasileiro.` |
| **Ferramentas** | Adicionar: `send_message`, `get_contact`, `create_lead` |
| **Modelo de IA** | Selecione: `gemini-2.5-flash` |

> Se `gemini-2.5-flash` não estiver disponível na lista, use `openai/gpt-oss-20b` como fallback.

---

## 4. Configurar Link de Onboarding (para terceiros conectarem WhatsApp)

Vá em **Integrações > Gerar Link**

| Campo | Valor |
|-------|-------|
| **Nome** | `Revolution X - WhatsApp Connect` |
| **Expiração** | `30 dias` |
| **URL de webhook (opcional)** | `https://revolutionx.com.br/api/webhooks/openbsp/messages` |
| **Token de verificação** | `revolutionx_webhook_2026` |

### O link gerado será algo como:
```
https://web.openbsp.dev/onboard/instagram/0a5c4d02-645f-4793-b8f6-19cee1c03ebc
```

**Para quem usar:** Envie este link para qualquer pessoa/empresa que quer conectar seu WhatsApp ao Revolution X. Eles clicam, autorizam, e o WhatsApp deles fica vinculado automaticamente.

---

## 5. Pré-processamento de Mídia (Já Configurado)

Vá em **Configurações > Pré-processamento de mídia**

| Campo | Status Atual | Ação Necessária |
|-------|--------------|-----------------|
| **Status** | Desativado | **ATIVAR** se quiser usar IA para processar imagens/vídeos |
| **Modelo** | `Gemini 2.5 Flash` | ✅ Correto |
| **Chave API do Google** | `Alza...` (oculto) | Já configurada? Verifique |
| **Idioma** | Español | ⚠️ Mudar para **Português (Brasil)** |
| **Instruções adicionais** | Nenhuma | Opcional: `Responda sempre em português brasileiro` |

### Para ativar:
1. Certifique-se que `GEMINI_API_KEY` está no `.env.local` do Revolution X
2. Vá na tela e clique **Atualizar** com o status ativado

---

## 6. Workflow Completo de Automação

Uma vez configurado, este é o fluxo:

```
Cliente envia mensagem WhatsApp
        ↓
OpenBSP recebe e processa
        ↓
Webhook → /api/webhooks/openbsp/messages (POST)
        ↓
Revolution X processa:
  - Extrai contatos → crm_contacts
  - Armazena mensagem → inbound_messages
  - Atualiza status → message_status
        ↓
IA do OpenBSP responde (se agente configurado)
        ↓
Mensagem enviada via template ou texto livre
```

---

## 7. Validação dos Webhooks

Após configurar, teste com:

```bash
# Testar verificação GET
curl "https://revolutionx.com.br/api/webhooks/openbsp/messages?hub.verify_token=revolutionx_webhook_2026&hub.challenge=TESTE123"

# Deve retornar: TESTE123
```

Se responder corretamente, o webhook está ativo!

---

## 8. Próximos Passos Recomendados

1. ✅ **Configurar cliente MCP no OpenBSP** (guiado acima)
2. ✅ **Criar agente IA com modelo Gemini**
3. ✅ **Ativar pré-processamento de mídia**
4. ⏳ **Testar envio de mensagem real** (via WhatsApp conectado)
5. ⏳ **Verificar recebimento no painel** de mensagens do Revolution X

---

## 9. Credenciais Necessárias

Todas já estão no `.env.local`:

```bash
OPENBSP_BASE_URL=https://nheelwshzbgenpavwhcy.supabase.co/rest/v1
OPENBSP_PUBLISHABLE_KEY=sb_publishable_jS_LQSbttNz2nRyAcjOVUw_J1KpXhUd
OPENBSP_API_KEY=sk_dcca9cc0057142ce95bba1e051b01699
OPENBSP_ORG_ID=9d7114cd-013e-4e03-b91d-848518bf6514
GEMINI_API_KEY=<sua_chave_gemini>
```
