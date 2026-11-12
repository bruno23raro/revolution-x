# Correção de Segurança: Webhook OpenBSP

## Problema Identificado

O endpoint POST `/api/integrations/openbsp/incoming` (webhook do WhatsApp OpenBSP) **não validava a assinatura HMAC** enviada pela Meta Cloud API. Isso permitia que qualquer chamada maliciosa fosse aceita no webhook, comprometendo a integridade dos dados.

## Vetores de Ataque

1. **Webhook Forgery**: Qualquer servidor poderia enviar payloads falsos ao webhook
2. **Replay Attacks**: Mensagens duplicadas poderiam ser processadas múltiplas vezes
3. **Dados Corrompidos**: Payload malicioso poderia causar erros no processamento

## Solução Implementada

### 1. Validação HMAC-SHA256 (Linha 68-75)

```typescript
// Validar assinatura X-Hub-Signature-256 (Meta Cloud API)
const signature = req.headers.get('X-Hub-Signature-256');
const secret = process.env.META_APP_SECRET;
if (!signature || !secret) {
  return NextResponse.json({ error: 'signature_missing' }, { status: 401 });
}

if (!verifyMetaSignature(raw, signature)) {
  return NextResponse.json({ error: 'signature_invalid' }, { status: 401 });
}
```

### 2. Função de Verificação (Linha 33-44)

Usa `crypto.timingSafeEqual` para prevenir ataques de timing:

```typescript
function verifyMetaSignature(payload: string, signature: string): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
  const sig = signature.startsWith('sha256=') ? signature.slice(7) : signature;
  if (expected.length !== sig.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'), 
    Buffer.from(sig, 'hex')
  );
}
```

### 3. Testes Cobertos (11 testes)

- `401 signature_missing` quando header ausente
- `401 signature_invalid` quando HMAC não confere
- `401 signature_missing` quando META_APP_SECRET não definido
- Roteamento de tenant correto através de phone_number_id
- Idempotência via wamid/openbspEventId
- Tratamento de payload inválido

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `app/api/integrations/openbsp/incoming/route.ts` | Adicionada validação HMAC |
| `app/api/integrations/openbsp/incoming/route.test.ts` | Novo arquivo de testes |
| `migrations/026_webhook_events_openbsp_unique.sql` | SQL migration (pendente aplicação) |

## Compatibilidade

- **Backwards Compatible**: Webhooks legítimos da Meta passam (assinatura válida)
- **Forward Secured**: Qualquer tentativa de forgery é rejeitada com 401

## Recomendações

1. **Aplicar migration 026** no banco de produção para índice único
2. **Monitorar logs** para eventos `signature_invalid` (podem indicar tentativas de ataque)
3. **Rotacionar META_APP_SECRET** periodicamente (30 dias recomendado)

## Referência

Pattern de implementação baseado em: `app/api/webhooks/meta/route.ts` (já validado em produção)