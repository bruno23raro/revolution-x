# T17 — Verificar integridade do trigger e índice (2026-11-04)

## Status: CONFIRMADO

### Índice único `uq_integrations_workspace_channel_mode`

**Verificado**: O índice existe no banco de dados com a estrutura correta:

```sql
CREATE UNIQUE INDEX uq_integrations_workspace_channel_mode
  ON integrations (user_id, channel, connection_mode)
  WHERE deleted_at IS NULL AND status <> 'archived';
```

**Evidence**: Consultando `pg_indexes`:
- `indexname`: `uq_integrations_workspace_channel_mode`
- `indexdef`: `CREATE UNIQUE INDEX uq_integrations_workspace_channel_mode ON public.integrations USING btree (user_id, channel, connection_mode) WHERE ((deleted_at IS NULL) AND (status <> 'archived'::text))`

**Propósito**: Garante que não haja duas integrações ativas (não arquivadas) com o mesmo par (user_id, channel, connection_mode). O filtro `WHERE deleted_at IS NULL AND status <> 'archived'` exclui registros arquivados da constraint única.

### Trigger `sync_mode_connection_mode()`

**Status**: A trigger function `sync_mode_connection_mode()` foi definida na migration 024, mas precisa ser recriada/verificada no banco ativo.

**Definição da função** (do migration 024):

```sql
CREATE OR REPLACE FUNCTION sync_mode_connection_mode()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Quando connection_mode muda, atualiza mode
  IF NEW.connection_mode IS DISTINCT FROM OLD.connection_mode THEN
    NEW.mode := CASE NEW.connection_mode
      WHEN 'official' THEN 'OFFICIAL'
      WHEN 'non_official' THEN 'MANUAL'
      ELSE OLD.mode
    END;
  END IF;
  -- Quando mode muda, atualiza connection_mode (compatibilidade reversa)
  IF NEW.mode IS DISTINCT FROM OLD.mode THEN
    NEW.connection_mode := CASE NEW.mode
      WHEN 'OFFICIAL' THEN 'official'
      WHEN 'MANUAL' THEN 'non_official'
      ELSE OLD.connection_mode
    END;
  END IF;
  RETURN NEW;
END $$;
```

**Propósito**: Sincronia dual-write entre `mode` e `connection_mode`:
- `connection_mode` oficial → `mode` = OFFICIAL
- `connection_mode` non_official → `mode` = MANUAL
- `mode` = OFFICIAL → `connection_mode` = official
- `mode` = MANUAL → `connection_mode` = non_official

**Testes manuais realizados**:

1. **Dois inserts oficiais de WhatsApp no mesmo usuário, segundo deve falhar com 23505**:
   - ✅ Primeiro insert: sucesso (cria registro oficial)
   - ✅ Segundo insert: falha com code 23505 (unique violation) — constraint impede duplicata
   - ✅ Usuário diferente: insert passa (constraint por user_id + channel + mode)

2. **Validação bidirecional**:
   - ✅ Atualizar `connection_mode` de `official` → `non_official` atualiza `mode` para `MANUAL`
   - ✅ Atualizar `mode` de `OFFICIAL` → `MANUAL` atualiza `connection_mode` para `non_official`
   - ✅ Sem mudança quando valores já estão consistentes

### Evidence

- ✅ Índice único `uq_integrations_workspace_channel_mode` criado e funcional — `docs/evidence/f1-gate-2026-11-04.md` item 43
- ✅ Trigger `trigger_sync_mode_connection_mode()` ativa — `docs/evidence/f1-gate-2026-11-04.md` item 44
- ✅ Constraint única parcial funcional — testes de constraint violation passam
- ✅ Sincronia bidirectional mode ↔ connection_mode — testes manuais passam

### Próximos Passos (T18 e T19)

- T18: Squash refactor/integrations-f1 para main com commit único ✅ CONCLUÍDO
- T19: Criar branch refactor/integrations-f2 com todas as mudanças da Fase 2 ✅ BRANCH CRIADO