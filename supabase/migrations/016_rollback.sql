-- ROLBACK da migration 016 (PASSO HUMANO / NÃO EXECUTAR AUTOMATICAMENTE)
-- ============================================================================
-- Inverte 016_multi_meta_accounts.sql na ordem exata contrária:
--   1. remove os 2 índices únicos de expressão criados pela 016;
--   2. recria o UNIQUE legado (organization_id, provider);
--   3. remove a coluna display_name.
--
-- ⚠️  CONDIÇÃO: o passo 2 só tem sucesso quando NÃO existem mais duplicatas
--     de (org, provider) (ou seja, nenhuma multi-conta Meta criada após a 016).
--     Se houver, primeiro remova/consolide as linhas duplicas (mantendo uma
--     por (org, provider)) e então rode este rollback.
--
-- ⚠️  ESCOPO: esta rotação NÃO reverte a 015 (webhook idempotency). Se ela
--     também precisar de rollback: DROP INDEX IF EXISTS uq_webhook_events_meta_event_id;
--
-- Segurança: DDL aditivo/invertido, sem perda de dados nas linhas de clientes
-- (meta_integrations em produção tinha 0 linhas no momento da auditoria
-- 2026-10-21; confira a contagem ANTES de aplicar — se houver linhas, a
-- condição acima vale em dobro).
-- ============================================================================

-- 1) Remove a camada nova da 016 (índices de expressão).
-- (DROP INDEX é instrução autônoma; não existe "ALTER TABLE ... DROP INDEX".)
DROP INDEX IF EXISTS uq_meta_integrations_page;
DROP INDEX IF EXISTS uq_meta_integrations_account;

-- 2) Recria o UNIQUE legado (no-op seguro se já existir).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.meta_integrations'::regclass
      AND contype = 'u'
      AND conkey = ARRAY[
        (SELECT attnum FROM pg_attribute
           WHERE attrelid = 'public.meta_integrations'::regclass
             AND attname = 'organization_id'),
        (SELECT attnum FROM pg_attribute
           WHERE attrelid = 'public.meta_integrations'::regclass
             AND attname = 'provider')
      ]
  ) THEN
    ALTER TABLE meta_integrations
      ADD CONSTRAINT uq_meta_integrations_org_provider UNIQUE (organization_id, provider);
  END IF;
END $$;

-- 3) Remove a coluna adicionada pela 016.
ALTER TABLE meta_integrations DROP COLUMN IF EXISTS display_name;
