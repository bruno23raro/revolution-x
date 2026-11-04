# F1 — Diagnóstico e correção dos vermelhos (repository.test.ts) — RESOLVIDO

## Resultado Final (2026-11-04)

**833/833 testes verdes, 59 suítes, tsc 0 erros.** (meta era 828; suítes novas de factory/capabilities/repository elevaram o total)

## Causa Raiz (confirmada: mock errado, código correto)

Os vermelhos em `src/integrations/repository.test.ts` eram todos de **estrutura de mock** — o mock tentava reproduzir a hierarquia exata de cada cadeia de métodos do Supabase SDK (um objeto aninhado por combinação de métodos), e qualquer divergência entre a cadeia escrita no mock e a cadeia real em `repository.ts` quebrava com `TypeError: ... is not a function`.

`repository.ts` nunca teve bug: `tsc --noEmit` = 0 e a lógica (constraint check → update/insert, tolerância a PGRST116, DuplicateIntegrationError em 23505, validação de transição de status, auditoria via logEvent) está correta.

## Solução Definitiva (10ª iteração — a que fechou)

Em vez de imitar a hierarquia do SDK, o mock final usa **cadeia auto-retornável + thenable**:

- Todo método (`select`, `insert`, `update`, `eq`, `neq`, `is`, `order`, `limit`, `single`, …) retorna o próprio objeto → qualquer cadeia composta é válida por construção.
- O objeto implementa `then()` → ao ser `await`-ado, consome o próximo resultado de uma fila FIFO configurada por `from()`.
- Cada teste declara apenas a **fila de resultados na ordem dos awaits** que a função executa — sem descrever a cadeia.

Isso elimina a classe inteira de bug "mock divergiu da cadeia" e torna os testes resistentes a refactors de query.

### Cobertura adicionada (16 testes, vs 11 originais)

Além dos caminhos originais, agora cobertos:
- `getByChannel` propaga erro não-PGRST116
- `upsertConnection` lança `DuplicateIntegrationError` em unique violation (23505) no insert (corrida de upserts)
- `setStatus` lança `InvalidStatusTransitionError` em connected→connected com `nova_conta`
- `archive` e `logEvent` propagam erros do banco

## Arquivos

- `src/integrations/repository.test.ts` — reescrito com o mock thenable (16/16 verdes)
- `src/test/supabase-stub.ts` — **removido**: código morto (nenhum teste o importava) e continha 5 erros de compilação (propriedade duplicada `single`, re-export conflitante) que quebravam `tsc --noEmit`
- `src/integrations/capabilities.test.ts` — 3 casts `as any` em probes de feature/canal inválidos (o parâmetro é union fechada `Feature`; o teste exercita runtime, não tipo)

## Validação

```
npx jest          → Test Suites: 59 passed | Tests: 833 passed, 833 total
npx tsc --noEmit  → EXIT=0
```
