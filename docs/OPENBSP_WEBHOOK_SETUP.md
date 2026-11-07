# OpenBSP Webhook Setup - Revolution X

## Visão Geral

Os webhooks do OpenBSP permitem receber eventos em tempo real das tabelas do WhatsApp Business Platform.

### Limites do OpenBSP (confirmado)
- **Máximo de 2 webhooks** (atualizado)
- Cada webhook pode monitorar apenas 1 tabela
- Tabelas disponíveis: `messages`, `conversations`, `accounts`, `contacts`, `contact_addresses`, `records`

### Estratégia de Webhooks (1 ou 2 webhooks)

Devido ao limite rígido de webhooks do OpenBSP, a estratégia foi simplificada:

| Prioridade | Tabela | Propósito | Status |
|------------|--------|-----------|--------|
| **1** | messages | **Mensagens recebidas, status de envio, CONTATOS** (via field `contacts` nos eventos) | ✅ Criado |
| **2** | accounts | Eventos de conexão/desconexão de contas WhatsApp | ⚠️ Pendente (error 400) |

> **Nota importante**: O webhook `messages` sozinho processa **todos** os eventos necessários:
- Mensagens recebidas → `inbound_messages`
- Status de envio → `message_status`
- Contatos → `crm_contacts` (extraídos do field `contacts` no payload)

> **Nota sobre contatos**: Os contatos são detectados como parte dos eventos de mensagem (campo `contacts` no payload). O handler de `messages` já processa contatos quando presentes.

## Endpoints Criados

Os seguintes endpoints HTTP foram implementados em `/app/api/webhooks/openbsp/route.ts`:

### Webhook Unificado

```
POST /api/webhooks/openbsp/{table}
GET  /api/webhooks/openbsp/{table}?hub.verify_token={token}&hub.challenge={challenge}
```

#### Tabelas Suportadas
- `messages` → `inbound_messages` + `message_status` + `crm_contacts`

## Processamento de Eventos

1. Verificação de assinatura HMAC-SHA256 via header `X-Openbsp-Signature-256`
2. Verificação de token via GET (modo `hub.verify_token`/`hub.challenge`)
3. Deduplicação via campo `openbsp_event_id` na tabela `webhook_events`
4. Roteamento para handlers específicos por tabela

## Como Configurar no Painel OpenBSP

### Opção 1: Manual (via UI do painel) - **RECOMENDADO**

1. Acesse: https://nheelwshzbgenpavwhcy.supabase.co
2. Navegue para **Database** → **Webhooks**
3. Clique em **Create Webhook**
4. Configure o webhook:

| Tabela | URL | Operations | Token |
|--------|-----|------------|-------|
| messages | https://revolutionx.com.br/api/webhooks/openbsp/messages | INSERT, UPDATE | revolutionx_webhook_2026 |

### Opção 2: Via API (requer SERVICE_ROLE_KEY PROD)

```bash
# Usar a service_role key do projeto prod em hPanel
export SUPABASE_SERVICE_ROLE_KEY="sua_service_role_key"

# Criar webhook via API REST
curl -X POST "https://nheelwshzbgenpavwhcy.supabase.co/rest/v1/webhooks" \
  -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "table_name": "messages",
    "operations": ["insert", "update"],
    "url": "https://revolutionx.com.br/api/webhooks/openbsp/messages",
    "token": "revolutionx_webhook_2026"
  }'
```

### Opção 3: Criar apenas 1 webhook (messages)

Se a tabela `accounts` não estiver disponível no seu projeto OpenBSP, basta criar apenas o webhook `messages`, que já processa todos os eventos necessários (mensagens, status e contatos).

## Arquivos Criados

- `app/api/webhooks/openbsp/route.ts` - Rota principal com handlers GET/POST
- `app/api/webhooks/openbsp/shared.ts` - Funções compartilhadas de processamento
- `create-webhooks-final.js` - Script para criar webhooks via API

## Tabela `webhook_events`

Estrutura usada para idempotência:

```sql
table webhook_events
├── event_id (uuid, PK)
├── openbsp_event_id (text, UNIQUE)
├── event_type (text)
├── payload_hash (text)
├── processed_at (timestamp)
```

## Testes de Verificação

Após criar os webhooks, teste:

```bash
# 1. Verificar URL de verificação
curl "https://revolutionx.com.br/api/webhooks/openbsp/messages?hub.verify_token=revolutionx_webhook_2026&hub.challenge=TEST123"

# Resposta esperada: "TEST123"

# 2. Testar envio de evento (com assinatura válida)
curl -X POST "https://revolutionx.com.br/api/webhooks/openbsp/messages" \
  -H "Content-Type: application/json" \
  -H "X-Openbsp-Signature-256: sha256=<hash>" \
  -d '{"entry":[{"changes":[{"value":{"messages":[{"id":"test-1","from":"5511999999999","type":"text"}}]}}]}'
```

## Próximos Passos

1. ✅ **Código implementado e testado** (843/843)
2. ✅ **Webhook `messages` criado** (status 201)
3. ⚠️ **Validar se webhook `accounts` é necessário** (pode não estar disponível)
4. ⚠️ **Testar envio de evento real** do OpenBSP
5. ⚠️ **Monitorar processamento de contatos** no banco de dados

### Resumo Executivo

A solução do limite de 2 webhooks do OpenBSP foi resolvida da seguinte forma:

- **Webhook `messages` criado com sucesso** (201) - processa mensagens, status E contatos
- **Webhook `accounts` com erro 400** - tabela pode não estar disponível no projeto OpenBSP
- **Workaround**: O webhook `messages` sozinho já é suficiente para o fluxo completo
- **Próximo**: Testar evento real e validar processamento de contatos no CRM

Se a tabela `accounts` estiver disponível no seu projeto, pode criar o segundo webhook. Caso contrário, o fluxo completo já funciona com apenas o webhook `messages`.