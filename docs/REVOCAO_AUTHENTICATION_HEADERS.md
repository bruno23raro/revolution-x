# Revocação de Headers de Autenticação Incorretos

## Status: ❌ **REVOGADO E CORRIGIDO**

## Problema Identificado

Durante a auditoria, foram encontradas informações incorretas sobre headers de autenticação HTTP que não correspondem ao padrão do projeto Revolution X.

### Headers Incorretos Mencionados:
```
- authorization: sb_publishable_jS_LQSbttNz2nRyAcjOVUw_J1KpXhUd
- nome REVOLUTION X
- Proprietário funçao
- sk_dcca9cc0057142ce95bba1e051b01699 api
```

## Análise Técnica

### 1. Headers de Autenticação Corretos no Revolution X

O projeto utiliza **dois padrões distintos de autenticação** conforme documentado em [`docs/INTEGRACOES_OPENBSP.md`](docs/INTEGRACOES_OPENBSP.md):

#### OpenBSP (PostgREST REST API)
```javascript
// Endpoint: https://nheelwshzbgenpavwhcy.supabase.co/rest/v1/{table}
{
  'Content-Type': 'application/json',
  'apikey': 'sb_publishable_jS_LQSbttNz2nRyAcjOVUw_J1KpXhUd',  // Chave pública
  'api-key': 'sk_dcca9cc0057142ce95bba1e051b01699'              // Chave owner/API
}
```

**Fonte**: [`src/integrations/whatsapp/openbsp/client.ts:62-72`](src/integrations/whatsapp/openbsp/client.ts#L62-L72)

#### Meta Graph API (OAuth Token)
```javascript
{
  'Authorization': 'Bearer <PAGE_ACCESS_TOKEN>',  // Token de página
  'Content-Type': 'application/json'
}
```

**Fonte**: [`src/integrations/meta/adapter.ts:45-50`](src/integrations/meta/adapter.ts#L45-L50)

### 2. Erro de Interpretação

Os headers mencionados no "prompt mestre" são uma **mistura de conceitos**:

- `sb_publishable_jS_LQSbttNz2nRyAcjOVUw_J1KpXhUd` - É a **chave publica do Supabase OpenBSP**, NÃO um token de autorização
- `sk_dcca9cc0057142ce95bba1e051b01699` - É a **API key owner do OpenBSP**, NÃO um "api" propriamente dito
- "nome REVOLUTION X" e "Proprietório funçao" - NÃO são headers HTTP, são metadados de conta

## Correção Implementada

### 1. Documentação Atualizada

Criado novo arquivo de documentação técnica:
- [`docs/REVOCAO_AUTHENTICATION_HEADERS.md`](docs/REVOCAO_AUTHENTICATION_HEADERS.md) - Este documento

### 2. Padronização dos Headers

Verificado que todos os clientes de integração usam os padrões corretos:

**OpenBSP Client** (`src/integrations/whatsapp/openbsp/client.ts`):
```typescript
headers: {
  'Content-Type': 'application/json',
  apikey: cfg.publishableKey,     // Chave publica
  'api-key': cfg.apiKey,          // Chave owner/secret
  Prefer: 'return=representation',
}
```

**Meta Adapter** (`src/integrations/meta/adapter.ts`):
```typescript
headers: {
  'Authorization': `Bearer ${pageAccessToken}`,
  'Content-Type': 'application/json',
}
```

## Credenciais Válidas (Mascaradas)

| Serviço | Header Correto | Valor Atual |
|---------|---------------|-------------|
| OpenBSP | `apikey` | `sb_publishable_...` |
| OpenBSP | `api-key` | `sk_dcca...` |
| Meta | `Authorization: Bearer` | `<PAGE_ACCESS_TOKEN>` |
| Supabase | `anon_key` / `service_role` | JWT padrão Supabase |

## Recomendações

1. **Não usar os headers mencionados** como padrão - eles são confusos e misturam conceitos
2. **Seguir a convenção do projeto**: separar claramente entre:
   - Chaves públicas (`apikey`, `sb_publishable_*`)
   - Chaves secretas (`api-key`, `sk_*`, `service_role`)
   - Tokens OAuth (`Bearer`)
3. **Documentar headers corretos** em cada client de integração

## Arquivos Analisados

- `src/integrations/whatsapp/openbsp/client.ts` - ✅ Correto
- `src/integrations/meta/adapter.ts` - ✅ Correto
- `src/integrations/types.ts` - ✅ Tipos corretos definidos
- `src/lib/auth.ts` - ✅ Auth Supabase GoTrue correto

## Conclusão

Os headers mencionados não são aplicáveis ao Revolution X. O projeto já possui implementações corretas de autenticação para todas as integrações. Esta revocação serve apenas como documentação técnica para evitar confusão futura.

---
*Auditado: 2026-11-09*
*Status: CORRIGIDO - Nenhuma alteração de código necessária*