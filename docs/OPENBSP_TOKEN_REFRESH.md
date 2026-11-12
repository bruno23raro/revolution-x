# Refresh de Token OpenBSP

## Visão Geral

O OpenBSP (WhatsApp oficial) utiliza um modelo diferente de refresh token em comparação com Meta/TikTok.

### Como funciona o OpenBSP

1. **Onboarding Token**: Token único gerado durante o onboarding (válido 7 dias)
2. **Access Token**: Gerado automaticamente pelo OpenBSP quando o onboarding é concluído
3. **Renovação Automática**: O OpenBSP mantém o access_token válido enquanto o onboarding token não expirar

### Quando o token precisa ser verificado

- Token expirou localmente (cache `integrations.expires_at`)
- Acesso foi revogado no provedor (onboarding cancelado)
- Erro de autenticação em chamadas do provedor

## Endpoints

### POST /api/integrations/openbsp/refresh-token

**Propósito**: Verificar e atualizar token do canal OpenBSP

**Autenticação**: Admin/owner (mesmo gate do refresh Meta/TikTok)

**Respostas**:
- `200`: `{ ok: true, tokenId, expiresIn }` - Token verificado/atualizado
- `409`: `{ error: 'not_connected' }` - Canal não conectado
- `409`: `{ error: 'token_expired' }` - Onboarding expirou, requer re-onboarding
- `409`: `{ error: 'token_revoked' }` - Access token revogado
- `503`: `{ error: 'config_missing' }` - Credenciais OpenBSP não configuradas
- `502`: `{ error: 'fetch_failed' }` - Provedor indisponível

### POST /api/cron/openbsp-refresh

**Propósito**: Cron de verificação automática de tokens

**Autenticação**: `x-cron-secret` header (comparacao em tempo constante)

**Configuração no hPanel**:
```
Hostinger → Websites → revolutionx.com.br → Cron Jobs
Período: Every 1 day
Comando: curl -fsS -X POST -H "x-cron-secret: <SEGREDO>" https://revolutionx.com.br/api/cron/openbsp-refresh >/dev/null
```

**Variáveis necessárias**:
- `CRON_SECRET` - Segredo para autenticação do cron (gerar com `openssl rand -hex 32`)

## Migrações

### Migration 026: webhook_events_openbsp_unique

Adiciona índice único para idempotência dos eventos OpenBSP:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_events_openbsp_event_id
  ON public.webhook_events (openbsp_event_id)
  WHERE openbsp_event_id IS NOT NULL;
```

Aplicação:
```bash
# No ambiente local (supabase-docker)
npx supabase db push

# Em produção (via CLI)
supabase migration up --project-ref ardpabjoepzhkpmkgwgu
```

## Configuração de Ambiente

### Variáveis necessárias

| Variável | Valor | Status |
|----------|-------|--------|
| `OPENBSP_BASE_URL` | URL do PostgREST OpenBSP | ✅ Configurado |
| `OPENBSP_PUBLISHABLE_KEY` | Chave publica | ✅ Configurado |
| `OPENBSP_API_KEY` | Chave owner/admin | ✅ Configurado |
| `OPENBSP_ORG_ID` | ID da organização OpenBSP | ✅ Configurado |
| `META_APP_SECRET` | App Meta Secret (para webhook signature) | ✅ Configurado |
| `CRON_SECRET` | Segredo para cron refresh | ⚠️ **Pendente** (hPanel) |

## Troubleshooting

| Erro | Causa | Solução |
|------|-------|---------|
| `token_expired` | Onboarding token expirou (7 dias) | Re-onboarding necessário |
| `token_revoked` | Acesso cancelado no provedor | Verificar no painel OpenBSP |
| `no_access_token` | Linha não está conectada | Verificar `organizations_addresses` |
| `config_missing` | OPENBSP_ORG_ID ausente | Configurar no hPanel |
| `fetch_failed` | Provedor indisponível | Verificar saúde do OpenBSP |

## Fluxo de Verificação

```
Cron (24h) → POST /api/cron/openbsp-refresh
    ↓
Listar canais connected (provider=openbsp)
    ↓
Para cada canal:
    1. Verificar expires_at local
    2. Buscar organizations_addresses pelo onboarding_token_id
    3. Se access_token presente → atualizar cache
    4. Registrar erro se falhar
```

## Segurança

- Todos os tokens são armazenados cifrados em `accessTokenEnc` (AES-256-GCM)
- O `CRON_SECRET` é comparado em tempo constante
- O `META_APP_SECRET` é usado apenas para verificação de assinatura de webhook
- Nenhum token é logado ou retornado na resposta

## Arquivos

- Endpoint API: `app/api/integrations/openbsp/refresh-token/route.ts`
- Cron job: `app/api/cron/openbsp-refresh/route.ts`
- Migration: `migrations/026_webhook_events_openbsp_unique.sql`
- Cliente OpenBSP: `src/integrations/whatsapp/openbsp/client.ts`