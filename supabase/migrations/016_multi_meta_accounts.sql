-- Migration 016 — Multicontas Meta (PASSO HUMANO / NÃO APLICAR AUTOMATICAMENTE)
-- ============================================================================
-- ⚠️  ESTE ARQUIVO É UM PASSO HUMANO NO BANCO: NÃO EXECUTE CONTRA PRODUÇÃO
--     SEM REVISÃO EXPLÍCITA. (Regra de segurança do projeto: nunca DDL/
--     migration contra produção sem autorização separada.)
--
-- FINALIDADE: liberar MULTÍPLAS contas do MESMO provedor Meta por tenant
-- (ex.: várias PÁGINAS do Facebook, vários números de WhatsApp). Hoje a
-- `UNIQUE(organization_id, provider)` (005) trava 1 linha por (org, provider),
-- então a camada de multicontas do app (resolvers determinísticos + seletor
-- de contas) só fica completa quando esta relaxation é aplicada.
--
-- O QUE MUDA (sem perda de dados):
--   1. `display_name` — rótulo da conta p/ o seletor de contas na UI
--      (nome da Página / do número). Nullable; backfilled da linha atual
--      quando possível.
--   2. REMOVEMOS `UNIQUE(organization_id, provider)` → várias linhas do
--      mesmo (org, provider) passam a ser permitidas (várias páginas/números).
--   3. ADICIONAMOS um UNIQUE de EXPRESSÃO para evitar duplicata EXATA da
--      mesma conta: (organization_id, provider, coalesce(meta_page_id,
--      phone_number_id, instagram_account_id)). NULLs não colidem (Postgres),
--      então linhas sem nenhum id (PENDING) continuam inseríveis.
--   4. ÍNDICE de apoio na expressão para o upsert por página do callback
--      (organization_id, provider, meta_page_id).
--
-- ROLBACK (manual): ver 016_rollback.sql ao final (remover constraint + coluna).
-- ============================================================================

ALTER TABLE meta_integrations ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Backfill conservador: pega o nome da Página quando houver (melhor esforço).
UPDATE meta_integrations
SET display_name = 'Página ' || meta_page_id
WHERE display_name IS NULL AND meta_page_id IS NOT NULL;
UPDATE meta_integrations
SET display_name = 'Nº ' || phone_number_id
WHERE display_name IS NULL AND meta_page_id IS NULL AND phone_number_id IS NOT NULL;

-- 2) Libera multicontas: remove o UNIQUE de 2 colunas.
-- O NOME da constraint varia por árvore (audit de lançamento 2026-10-21):
--   • DEV / banco novo (005 intacta): nome AUTOGERADO do Postgres
--     -> meta_integrations_organization_id_provider_key
--   • PRODUÇÃO: nome EXPLÍCITO -> uq_meta_integrations_org_provider
--     (verificado ao vivo em pg_constraint, contype=u, conkey=[2,3])
-- Dropamos AMBOS com IF EXISTS: o que não existe é no-op, o que existe é
-- removido. Aplicar 016 com um único nome seria no-op silencioso na outra
-- árvore (a constraint sobrevive e a 2ª conta segue com 23505).
ALTER TABLE meta_integrations DROP CONSTRAINT IF EXISTS uq_meta_integrations_org_provider;
ALTER TABLE meta_integrations DROP CONSTRAINT IF EXISTS meta_integrations_organization_id_provider_key;

-- 3) UNIQUE de expressão contra duplicata exata da mesma conta.
CREATE UNIQUE INDEX IF NOT EXISTS uq_meta_integrations_account
  ON meta_integrations (organization_id, provider,
                        coalesce(meta_page_id, phone_number_id, instagram_account_id));

-- 4) Índice de apoio p/ upsert por Página (usado pelo callback OAuth).
CREATE UNIQUE INDEX IF NOT EXISTS uq_meta_integrations_page
  ON meta_integrations (organization_id, provider, meta_page_id);

COMMENT ON COLUMN meta_integrations.display_name
  IS 'Rótulo da conta p/ seletor de contas (nome da Página / do número)';
