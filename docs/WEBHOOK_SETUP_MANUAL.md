# Webhook Setup - Manual Steps

## Status Atual

✅ **Código implementado e testado**
- 843 testes passando
- Build 82 rotas
- Deploy automático da branch `main` ativado

## Webhooks a Configurar Manualmente

Devido aos limites de segurança RLS, os webhooks OpenBSP precisam ser criados no painel OpenBSP com a service_role key do projeto PROD.

### Passos para Configurar

1. **Acesse o painel OpenBSP**: https://nheelwshzbgenpavwhcy.supabase.co

2. **Copie a SERVICE_ROLE_KEY do Hostinger hPanel**:
   - Acesse: https://hostinger.com/manager
   - Procure por: `SUPABASE_SERVICE_ROLE_KEY`
   - Valor: `0qn1a..._Bk` (verifique em CREDENCIAIS.md)

3. **Crie os 3 webhooks**:

| Tabela | URL | Operations |
|--------|-----|------------|
| messages | https://revolutionx.com.br/api/webhooks/openbsp/messages | INSERT, UPDATE |
| accounts | https://revolutionx.com.br/api/webhooks/openbsp/accounts | INSERT, UPDATE |
| contacts | https://revolutionx.com.br/api/webhooks/openbsp/contacts | INSERT, UPDATE |

4. **Configure o secret/tocen**:
   - Token: `revolutionx_webhook_2026`
   - Secret: `webhook_secret_7a8b9c0d1e2f`

## Alternativa: Script de Configuração Local

Se tiver a SERVICE_ROLE_KEY do prod, execute:

```bash
# Exportar a chave do prod
export SUPABASE_SERVICE_ROLE_KEY="sua_service_role_key_do_prod"

# Executar o script
node create-webhooks-final.js
```

## Endpoints Criados

- `GET  /api/webhooks/openbsp/messages` - Webhook para tabela `messages`
- `GET  /api/webhooks/openbsp/accounts` - Webhook para tabela `accounts`  
- `GET  /api/webhooks/openbsp/contacts` - Webhook para tabela `contacts`

## Verificação

Depois de configurar, teste com:

```bash
# Verificar webhooks listados
curl -s "https://nheelwshzbgenpavwhcy.supabase.co/rest/v1/webhooks?organization_id=eq.9d7114cd-013e-4e03-b91d-848518bf6514&select=id,table_name,url" -H "apikey: [sua_api_key]" -H "api-key: [sua_service_role_key]"
```

## Fluxo de Eventos

1. **messages** → `inbound_messages` + `message_status`
2. **accounts** → `whatsapp_channels` (status da conta WhatsApp)
3. **contacts** → `crm_contacts` (novos contatos detectados)