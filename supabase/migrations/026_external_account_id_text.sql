-- 026_external_account_id_text.sql — T55: integrations.external_account_id uuid -> text
-- ============================================================================
-- Causa: produção criou external_account_id como uuid; o LOCAL (docker) e o
-- código REAL (src/integrations/repository.ts:135/165, que grava ids externos
-- como texto: 'waba-123', IG business account id numérico, phone) assumem text.
-- Ids externos da Meta NÃO são UUIDs → insert em produção falharia com
-- 22P02 invalid_input_syntax_for_type. T55 exige que o callback Instagram
-- passe a gravar external_account_id (id da conta IG) — impossível com uuid.
--
-- A tabela está VAZIA nos dois ambientes (verificado 2026-11-05: count=0),
-- então a conversão de tipo é segura e sem perda.
-- Idempotente: só altera se o tipo atual for uuid.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='integrations'
      and column_name='external_account_id' and data_type='uuid'
  ) then
    alter table public.integrations
      alter column external_account_id type text using external_account_id::text;
    comment on column public.integrations.external_account_id is
      'ID da conta no provedor externo, como TEXTO (waba_id, IG business account id, phone). Não é UUID — ids da Meta são numéricos.';
  end if;
end $$;

-- Ledger (condicional — o schema pode não existir no docker local)
do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    insert into supabase_migrations.schema_migrations (version, name)
    values ('026', 'external_account_id_text')
    on conflict (version) do nothing;
  end if;
end $$;

-- DOWN
-- alter table public.integrations alter column external_account_id type uuid using nullif(external_account_id,'')::uuid;
