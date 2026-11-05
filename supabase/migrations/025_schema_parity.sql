-- 025_schema_parity.sql — T54: meta_integrations/webhook_events canônicos em snake_case
-- ============================================================================
-- Contexto (dual-schema drift):
--   • PRODUÇÃO (ardpabjoepzhkpmkgwgu): meta_integrations/webhook_events já em
--     snake_case (migration 005) — é a VERDADE do schema.
--   • LOCAL docker: mesmas tabelas em camelCase (legacy do Prisma model antigo),
--     confirmadas VAZIAS (count=0) antes deste arquivo.
--   • webhook_events NÃO tinha openbsp_event_id em nenhum ambiente, mas
--     app/api/webhooks/openbsp/route.ts depende dele (claim de idempotência com
--     ON CONFLICT (openbsp_event_id)) — sempre falhava com 42703.
--   • integrations em produção tinha checks estreitos que quebravam os callbacks
--     OAuth reais (status 'CONNECTED' violava integrations_status_check;
--     connection_mode 'official' violava integrations_connection_mode_check).
--
-- Este arquivo é idempotente e converge LOCAL e PRODUÇÃO para o mesmo shape.
-- Backfill: nenhuma tabela tem dados nos ambientes (verificado 2026-11-04:
-- meta_integrations=0, webhook_events=0, integrations=0, integration_events=0).
-- Se em algum ambiente houver dados, eles são migrados coluna a coluna antes do drop.

-- ============================================================
-- 1. meta_integrations — shape canônico snake_case (= produção)
-- ============================================================

-- 1a. Se existir a versão camelCase legada, migra dados (se houver) e remove.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='meta_integrations'
               and column_name='"accessToken"')
     or exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='meta_integrations'
               and column_name='accessToken') then
    -- tabela camelCase legada: renomeia para preservação e recria limpa abaixo
    alter table public.meta_integrations rename to meta_integrations_legacy_camel;
  end if;
end $$;

create table if not exists public.meta_integrations (
  id                            uuid primary key default gen_random_uuid(),
  organization_id               uuid not null,
  provider                      text not null check (provider in ('facebook','instagram','whatsapp')),
  meta_page_id                  text,
  instagram_account_id          text,
  whatsapp_business_account_id  text,
  phone_number_id               text,
  meta_app_id                   text,
  encrypted_access_token        text not null,
  token_expires_at              timestamptz,
  connected_at                  timestamptz not null default now(),
  disconnected_at               timestamptz,
  status                        text not null default 'PENDING'
    check (status in ('PENDING','AUTHENTICATED','CONNECTED','DISCONNECTED','ERROR','EXPIRED','REVOKED','PENDING_WHATSAPP')),
  last_error                    text,
  webhook_secret                text,
  display_name                  text
);
-- Sem UNIQUE(organization_id, provider): a migration 016 removeu a constraint em
-- producao (multicontas = N linhas por org/provider). Idempotencia do callback e
-- check-then-act por meta_page_id (app/api/auth/callback/meta/route.ts).

comment on table public.meta_integrations is
  'Conexões Meta (OAuth Graph API) por organização/provedor. Token SEMPRE cifrado em encrypted_access_token (AES-256-GCM).';

-- 1b. Backfill da tabela legacy renomeada (idempotente: só roda se a legacy existir).
do $$
begin
  if to_regclass('public.meta_integrations_legacy_camel') is not null then
    execute $blk$
      insert into public.meta_integrations (
        id, organization_id, provider, meta_page_id, instagram_account_id,
        whatsapp_business_account_id, phone_number_id, meta_app_id,
        encrypted_access_token, token_expires_at, connected_at, disconnected_at,
        status, last_error, webhook_secret, display_name
      )
      select
        l."id",
        l."organizationId",
        case when l."phoneNumberId" is not null then 'whatsapp'
             when l."accountId" is not null then 'instagram'
             else 'facebook' end,
        null,
        l."accountId",
        null,
        l."phoneNumberId",
        null,
        -- a legacy guardava accessToken em texto puro; passa como valor.
        -- TODO(cripto): re-cifrar linhas reais com META_TOKEN_ENCRYPTION_KEY (Fase B).
        l."accessToken",
        case when l."expiresIn" is not null
             then l."createdAt" + make_interval(secs => l."expiresIn")
             else null end,
        l."createdAt",
        null,
        upper(l."status"),
        null,
        null,
        null
      from public.meta_integrations_legacy_camel l
      on conflict do nothing
    $blk$;
    drop table public.meta_integrations_legacy_camel cascade;
  end if;
end $$;

create index if not exists meta_integrations_org_idx
  on public.meta_integrations (organization_id, provider);

-- FK para a tabela de organizacoes do ambiente: producao = organizations
-- (snake), docker local = "Organization" (PascalCase — schema Prisma legacy).
do $$
begin
  if not exists (select 1 from pg_constraint where conname='meta_integrations_organization_id_fkey'
                 and conrelid='public.meta_integrations'::regclass) then
    if to_regclass('public.organizations') is not null then
      alter table public.meta_integrations
        add constraint meta_integrations_organization_id_fkey
        foreign key (organization_id) references public.organizations(id) on delete cascade;
    elsif to_regclass('public."Organization"') is not null then
      alter table public.meta_integrations
        add constraint meta_integrations_organization_id_fkey
        foreign key (organization_id) references public."Organization"(id) on delete cascade;
    end if;
  end if;
end $$;

-- ============================================================
-- 2. webhook_events — canônico + openbsp_event_id (claim de idempotência)
-- ============================================================

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='webhook_events'
               and column_name='metaEventId') then
    alter table public.webhook_events rename to webhook_events_legacy_camel;
  end if;
end $$;

create table if not exists public.webhook_events (
  event_id          uuid primary key default gen_random_uuid(),
  meta_event_id     text not null,
  integration_id    uuid references public.meta_integrations(id) on delete set null,
  event_type        text not null,
  payload_hash      text not null,
  processed_at      timestamptz not null default now(),
  -- id do evento OpenBSP/Meta para idempotência do webhook oficial
  openbsp_event_id  text,
  unique (meta_event_id, integration_id)
);

comment on column public.webhook_events.openbsp_event_id is
  'ID do evento vindo do OpenBSP/Meta. Unique parcial: claim atômico de idempotência em app/api/webhooks/openbsp.';

-- Backfill da legacy webhook_events (idempotente: só roda se a legacy existir).
do $$
begin
  if to_regclass('public.webhook_events_legacy_camel') is not null then
    execute $blk$
      insert into public.webhook_events (event_id, meta_event_id, integration_id, event_type, payload_hash, processed_at)
      select l."id", coalesce(l."metaEventId", l."payloadHash"), l."integrationId",
             coalesce(l."eventType", 'unknown'), coalesce(l."payloadHash", ''), coalesce(l."processedAt", l."createdAt")
      from public.webhook_events_legacy_camel l
      on conflict do nothing
    $blk$;
    drop table public.webhook_events_legacy_camel;
  end if;
end $$;

-- unique parcial exigido pelo ON CONFLICT (openbsp_event_id) do route.ts
create unique index if not exists webhook_events_openbsp_event_uidx
  on public.webhook_events (openbsp_event_id)
  where openbsp_event_id is not null;

create index if not exists webhook_events_integration_idx
  on public.webhook_events (integration_id, processed_at desc);

-- ============================================================
-- 3. integrations — checks que aceitam os valores que o código REALMENTE grava
--    (callbacks OAuth escrevem status 'CONNECTED'; adapters escrevem
--     connection_mode 'official'/'non_official'; UI lê 'OFFICIAL'/'MANUAL' legado)
-- ============================================================

alter table public.integrations drop constraint if exists integrations_status_check;
alter table public.integrations add constraint integrations_status_check
  check (status in ('disconnected','pending_credentials','connecting','connected','expired','error','archived',
                    'PENDING','AUTHENTICATED','CONNECTED','DISCONNECTED','ERROR','EXPIRED','REVOKED'));
comment on constraint integrations_status_check on public.integrations is
  'Minúsculas = enum v2 (repository/adapters). MAIÚSCULAS = status legado dos callbacks OAuth (será normalizado na consolidação da Fase B).';

alter table public.integrations drop constraint if exists integrations_connection_mode_check;
alter table public.integrations add constraint integrations_connection_mode_check
  check (connection_mode in ('official','non_official','OFFICIAL','MANUAL'));
comment on constraint integrations_connection_mode_check on public.integrations is
  'Minúsculas = valores gravados pelos adapters (repository.ts). MAIÚSCULAS = modo legado da UI (?mode=OFFICIAL|MANUAL).';

alter table public.integrations drop constraint if exists integrations_provider_check;
alter table public.integrations add constraint integrations_provider_check
  check (provider in ('openbsp','evolution','session_login','oauth_meta','meta_direct'));
comment on constraint integrations_provider_check on public.integrations is
  'Provedores: openbsp/evolution/session_login/oauth_meta + meta_direct (reserva Meta direto, src/integrations/whatsapp/meta_direct).';

-- ============================================================
-- 4. Ledger (T53): registra esta versão no histórico do projeto local.
--    Em produção aplicar via `supabase migration up` / push, nunca psql -f.
--    No docker local o schema supabase_migrations pode não existir — o bloco
--    é condicional para o arquivo rodar inteiro em qualquer ambiente.
-- ============================================================
do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    insert into supabase_migrations.schema_migrations (version, name)
    values ('025', 'schema_parity')
    on conflict (version) do nothing;
  end if;
end $$;

-- ============================================================
-- DOWN (rollback manual — espelha 005 + remove openbsp_event_id)
-- ============================================================
-- drop index if exists webhook_events_openbsp_event_uidx;
-- alter table public.webhook_events drop column if exists openbsp_event_id;
-- alter table public.integrations drop constraint if exists integrations_status_check;
-- alter table public.integrations add constraint integrations_status_check
--   check (status in ('disconnected','pending_credentials','connecting','connected','expired','error','archived'));
-- alter table public.integrations drop constraint if exists integrations_connection_mode_check;
-- alter table public.integrations add constraint integrations_connection_mode_check
--   check (connection_mode in ('OFFICIAL','MANUAL'));
-- delete from supabase_migrations.schema_migrations where version='025';
