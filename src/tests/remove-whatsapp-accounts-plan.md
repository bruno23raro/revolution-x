# Plano de Teste: Remoção de Contas WhatsApp Conectadas

## Objetivo
Validar que a remoção de contas WhatsApp conectadas funciona corretamente:
1. Listar contas existentes
2. Remover contas via API
3. Verificar se a lista está vazia após a remoção

## Estrutura dos Testes

### 1. Listar Contas Existentes
**Endpoint:** `GET /api/whatsapp/accounts`
- Verifica retorno de contas conectadas
- Verifica que não expõe tokens/secrets
- Verifica isolamento multi-tenant

### 2. Remover Contas
**Endpoint:** `DELETE /api/integrations/meta?provider=whatsapp`
- Deve marcar integrações como DISCONNECTED
- Retorna sucesso para organização autenticada
- Bloqueia operações de outras organizações (RLS)

### 3. Verificar Remoção
**Endpoint:** `GET /api/integrations/meta`
- Verifica que não há integrações de WhatsApp
- Verifica array vazio de integrações

## Arquivos a Criar/Modificar

### Novos Arquivos
- `app/api/whatsapp/accounts/route.test.ts` - testes da rota de contas

### Modificações
- `app/api/whatsapp/accounts/route.ts` - adicionar método DELETE

## Implementação Detalhada

### Rotas a Testar

```
GET    /api/whatsapp/accounts           - Lista contas do tenant
DELETE /api/whatsapp/accounts           - Remove todas as contas do tenant
GET    /api/integrations/meta           - Lista integrações (para verificação)
DELETE /api/integrations/meta?provider=whatsapp - Remove integrações de provider
```

### Casos de Teste

1. **401 - Sem sessão**
   - Requer autenticação válida

2. **401 - Usuário não-admin**
   - DELETE requer admin/owner

3. **200 - Lista vazia sem conexões**
   - Quando não há contas, retorna available=false

4. **200 - Remove com sucesso**
   - Marca como DISCONNECTED

5. **200 - Verificação pós-remoção**
   - API de listagem retorna vazio