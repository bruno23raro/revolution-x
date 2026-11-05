-- 027_integration_events_cols.sql — T53: adicionar colunas que o código logEvent espera
-- ao schema de production. O código (src/integrations/repository.ts:logEvent) insere:
--   integration_id, user_id, workspace_id, event, payload
-- Production integration_events tem: event_id, meta_event_id, integration_id,
-- event_type, payload_hash, processed_at — falta user_id, workspace_id, payload, created_at.
-- Esta migration adiciona as colunas que o código precisa, sem remover as existentes.
-- Idempotente: usa ADD COLUMN IF NOT EXISTS.

do $$
begin
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='integration_events' and column_name='user_id') then
    alter table public.integration_events add column user_id uuid;
    comment on column public.integration_events.user_id is 'FK opcional ao usuário que originou o evento (nullable por tenancy).';
  end if;
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='integration_events' and column_name='workspace_id') then
    alter table public.integration_events add column workspace_id uuid;
    comment on column public.integration_events.workspace_id is 'FK opcional à workspace/ organização (nullable).';
  end if;
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='integration_events' and column_name='payload') then
    alter table public.integration_events add column payload jsonb DEFAULT '{}'::jsonb;
    comment on column public.integration_events.payload is 'Payload livre do evento; JSON genérico.';
  end if;
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='integration_events' and column_name='created_at') then
    alter table public.integration_events add column created_at timestamp with time zone DEFAULT now() NOT NULL;
    comment on column public.integration_events.created_at is 'Timestamp de criação do evento de auditoria.';
  end if;
end $$;

-- Ledger (T53)
do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    insert into supabase_migrations.schema_migrations (version, name)
    values ('027', 'integration_events_cols')
    on conflict (version) do nothing;
  end if;
end $$;

-- DOWN
-- alter table public.integration_events drop column if exists user_id;
-- alter table public.integration_events drop column if exists workspace_id;
-- alter table public.integration_events drop column if exists payload;
-- alter table public.integration_events drop column if exists created_at;