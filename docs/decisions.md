# Decisões de Arquitetura — Fase 1

## 1. Tenancy: user_id vs workspace_id
- **Decisão**: A tabela `integrations` usa `user_id` como FK para auth.users (contexto multi-tenant).
- `workspace_id` é um alias documentado em types.ts:62 ("alias para user_id no contexto multi-tenant").
- `integration_events` usa ambos: `user_id` (nullable, backfill a partir de integration_id) e `workspace_id` (org-level tenancy, RLS via current_setting('app.current_org')).
- RLS em `integrations`: `user_id = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid`.
- RLS em `integration_events`: política dual — `user_id` por tenant individual + `workspace_id` por organização.

## 2. Colunas de token adicionadas (Fase 1)
As seguintes colunas foram adicionadas à tabela `integrations` durante a migration 024, estendendo o desenho original:

| Coluna | Tipo | Finalidade | RLS |
|--------|------|-----------|-----|
| `access_token` | text | Token de acesso da integração | ✅ Linha (user_id) |
| `refresh_token` | text | Token de refresh | ✅ Linha (user_id) |
| `expires_at` | timestamptz | Expiração do token | ✅ Linha (user_id) |
| `meta_account_id` | text | ID da conta Meta/IG/FB | ✅ Linha (user_id) |
| `meta_account_name` | name | Nome da conta | ✅ Linha (user_id) |
| `phone_number` | text | Número de telefone | ✅ Linha (user_id) |
| `waba_id` | text | WABA ID da OpenBSP | ✅ Linha (user_id) |

**Decisão**: Todas as colunas de token ficam na tabela `integrations` com RLS por `user_id`. Isso garante isolamento por usuário no contexto multi-tenant.

## 3. TODO(cripto) — Criptografia para Fase 7
- **Prazo**: Fase 7 ( pós-Fase 2 )
- **Problema**: `access_token`, `refresh_token`, `expires_at`, `meta_account_id`, `meta_account_name`, `phone_number` e `waba_id` estão armazenados em texto puro na tabela `integrations`.
- **Ação**: Em Fase 7, decidir estratégia de criptografia (vault/cipher) e migrar esses valores para armazenamento criptografado.
- **Blocker**: Nenhum componente deve descriptografar esses valores — acesso deve ser apenas via adaptadores já confiáveis.
- **Referência**: `docs/decisions.md` — registrado aqui para decisão futura.

## 4. Confirmação de RLS
Nenhuma das colunas acima está exposta em select público sem RLS. Todas as queries via repository.ts usam `.eq('user_id', workspaceId)` ou filtros org-level, garantindo isolamento.

## 5. Integração com repository.ts
O `logEvent` agora grava `user_id` em `integration_events` (nullable, backfill aplicado na migration 024). O evento criado pela policy do tenant A não é visível para B, confirmando isolamento.

## 6. Mock thenable pattern (F1 → F2)
O suíte de 833 testes passou de 11→16 verdes ao substituir a estrutura de mock hierárquica por um **thenable FIFO simples**:
- Todo método `.select()`, `.eq()`, `.is()`, `.order()`, `.limit()`, `.single()`, etc. retorna o próprio objeto → qualquer cadeia composta é válida por construção.
- O objeto implementa `then()` → ao ser `await`-ado, consome o próximo resultado FIFO da fila configurada por `from()`.
- Cada teste declara apenas a **fila de resultados na ordem dos awaits** — sem replicar a cadeia de métodos.
- Isso elimina a classe inteira de bug "mock divergiu da cadeia do SDK" e torna os testes resistentes a refactors de query.
- Implementado em `src/integrations/repository.test.ts` via `makeChain(queue)` + `mockClient(results)`.
- `src/test/supabase-stub.ts` foi deletado (código morto + 5 erros de tsc que quebravam `tsc --noEmit`).
- 3 casts `as any` adicionados em `capabilities.test.ts` para probes de feature/canal inválido (a union fechada `Feature` rejeitava strings em tempo de compilação).