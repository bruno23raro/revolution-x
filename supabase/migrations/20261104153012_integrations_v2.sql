-- Migration integrations_v2 — Modelo Unificado e Idempotente
-- ============================================================
-- Fase 1: Cria a tabela `integrations` (se não existir) e adiciona/garante
-- todas as colunas necessárias para o contrato de adapter factory e repository.
-- Idempotente: roda em banco vazio, em banco com tabela antiga e em banco já migrado.
-- Compatible com Caso A (tabela inexistente), Caso B (tabela no remoto), Caso C (tabela com colunas divergentes)
-- e Caso D (colunas divergentes do código).
-- ============================================================

-- --- 1. Criação da tabela integrations (Caso A: tabela inexistente) ---
-- Só cria se a tabela não existir. Usa IF NOT EXISTS para idempotência.
-- Colunas derivadas do contrato IntegrationRow e do repositório repository.ts.
-- Tenancy: user-level (workspace_id = user_id). RLS por user_id.
--
-- Colunas esperadas pelo código (repository.ts, types.ts, adapter-factory.ts):
--   workspace_id (alias user_id), channel, provider, connection_mode, status,
--   status_reason, last_checked_at, last_error_at, external_account_id,
--   external_account_label, credentials_ref, access_token, refresh_token, expires_at,
--   meta_account_id, meta_account_name, phone_number, waba_id, meta jsonb,
--   deleted_at, created_at, updated_at, mode (legado, Fase 8)

create table if not exists integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('whatsapp','instagram','facebook')),
  connection_mode text not null default 'non_official'
    check (connection_mode in ('official','non_official')),
  provider text check (provider in ('openbsp','evolution','session_login','oauth_meta')),
  status text not null default 'disconnected'
    check (status in ('disconnected','pending_credentials','connecting','connected','expired','error','archived')),
  status_reason text,
  last_checked_at timestamptz,
  last_error_at timestamptz,
  external_account_id text,
  external_account_label text,
  credentials_ref text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  meta_account_id text,
  meta_account_name text,
  phone_number text,
  waba_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- --- 2. Colunas idempotentes (Casos B, C, D) ---
-- add column if not existe cobre os cenários onde a tabela já existe (no remoto ou
-- parcialmente migrada) mas falta alguma coluna. Toda nova coluna recebe COMMENT ON COLUMN.

alter table integrations add column if not exists connection_mode text;
comment on column integrations.connection_mode is
  'Modo de conexão: oficial (via OpenBSP/Meta Cloud API) ou non_official (Evolution/QR/sessão/login manual). Default: non_official.';

alter table integrations add column if not exists provider text;
comment on column integrations.provider is
  'Provedor técnico: openbsp (WhatsApp oficial), evolution (WhatsApp non-oficial/QR), session_login (IG/FB via login de sessão), oauth_meta (IG/FB via Graph API).';

alter table integrations add column if not exists status_reason text;
comment on column integrations.status_reason is
  'Motivo da situação corrente (ex.: "consolidado_em_openbsp", "nova_conta", erro descriptivo). Livre; nunca vaza detalhes técnicos internos.';

alter table integrations add column if not exists last_checked_at timestamptz;
comment on column integrations.last_checked_at is
  'Timestamp do último check de status. Usado para health check e timeout 90s no estado "conectando".';

alter table integrations add column if not exists last_error_at timestamptz;
comment on column integrations.last_error_at is
  'Timestamp do último erro. Nunca armazenado junto com dados sensíveis; apenas mensagem curta.';

alter table integrations add column if not exists external_account_id text;
comment on column integrations.external_account_id is
  'ID da conta externa no provedor (ex.: WABA ID da OpenBSP, Page ID do Facebook, IG Account ID).';

alter table integrations add column if not exists external_account_label text;
comment on column integrations.external_account_label is
  'Rótulo amigável da conta externa (ex.: "Central Da Black01", "@handle_instagram").';

alter table integrations add column if not exists credentials_ref text;
comment on column integrations.credentials_ref is
  'Referência à credencial no banco de credenciais (ex.: ref para OPENBSP_API_KEY / OPENBSP_BASE_URL).';

alter table integrations add column if not exists meta jsonb not null default '{}'::jsonb;
comment on column integrations.meta is
  'Campos extras da plataforma em JSON livre. Qualquer dado que não tenha campo próprio vai aqui.';

--- Índices únicos e de leitura (só se a tabela integrations existir)

-- Índice único parcial: uma integração ativa por (workspace, canal, modo).
-- O WHERE garante que registros arquivados (deleted_at not null, status = 'archived')
-- não bloqueiem novo registro.
create unique index if not exists integrations_unique_active_mode
  on integrations (user_id, channel, connection_mode)
  where deleted_at is null and status <> 'archived';

-- Índice de leitura: busca por user_id + canal + status (filtros UI mais comuns).
create index if not exists integrations_read_idx
  on integrations (user_id, channel, status);

-- Índice de saúde: status + último check (monitoramento e timeout 90s).
create index if not exists integrations_health_idx
  on integrations (status, last_checked_at);

--- 3. Tabela integration_events (audit trail) ---

create table if not exists integration_events (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references integrations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  workspace_id uuid not null,
  event text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists integration_events_recent_idx
  on integration_events (integration_id, created_at desc);

--- 4. RLS (Row Level Security) ---

-- Habilitar RCS nas duas tabelas (se ainda não estiverem)
do $$
begin
  -- integrations: política por user_id (workspace-level tenancy)
  if not exists (select 1 from pg_policies where policyname = 'integrations_user_select') then
    create policy integrations_user_select on integrations
      for select using (user_id = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'integrations_user_insert') then
    create policy integrations_user_insert on integrations
      for insert with check (user_id = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'integrations_user_update') then
    create policy integrations_user_update on integrations
      for update using (user_id = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'integrations_user_delete') then
    create policy integrations_user_delete on integrations
      for delete using (user_id = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid);
  end if;

  -- integration_events: política por user_id (via integração) e workspace_id (compatibilidade)
  if not exists (select 1 from pg_policies where policyname = 'integration_events_user_select') then
    create policy integration_events_user_select on integration_events
      for select using (user_id = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'integration_events_user_insert') then
    create policy integration_events_user_insert on integration_events
      for insert with check (user_id = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'integration_events_workspace_select') then
    create policy integration_events_workspace_select on integration_events
      for select using (workspace_id = NULLIF(current_setting('app.current_org', TRUE), '')::uuid);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'integration_events_workspace_insert') then
    create policy integration_events_workspace_insert on integration_events
      for insert with check (workspace_id = NULLIF(current_setting('app.current_org', TRUE), '')::uuid);
  end if;
end
$$;

--- 5. Comentos em colunas já existentes (idempotente) ---

comment on column integrations.user_id is
  'FK para auth.users ON DELETE CASCADE; usado como workspace/tenant identifier no contexto multi-tenant. Alias do workspace_id.';

comment on column integrations.channel is
  'Canal da integração: whatsapp, instagram ou facebook.';

comment on column integrations.status is
  'Status da integração: disconnected, pending_credentials, connecting, connected, expired, error, archived.';

--- 6. Backfill de meta_integrations → integrations (quando houver dados) ---

-- Este bloco roda mesmo com 0 linhas (idempotente).
-- Mapeia organização → usuário. Se a organização do usuário atual tiver integrações
-- no meta_integrations, insere cópia para integrations com on conflict do nothing.
--
-- Lógica: organizationId de meta_integrations → user_id de integrations (alias workspace_id).
-- Se não houver like-for-like, nada é feito (on conflict do nothing preserva integridade).
--
-- Nota: O mapeamento exato de orgId → userId depende do fluxo humano de criação de conta.
-- Este script assume que o usuário logado é o dono da organização; se houver organização
-- estrangeira, o agente deve parar com bloqueio F1.4 em vez de adivinhar o mapping.
--
do $$
declare
  org_uuid uuid := current_setting('app.current_org', TRUE)::uuid;
begin
  -- Apenas executa se houver organização corrente e a tabela meta_integrations existir
  if org_uuid is not null then
    insert into integrations (user_id, channel, connection_mode, provider, status,
                             status_reason, last_checked_at, last_error_at,
                             external_account_id, external_account_label,
                             credentials_ref, meta_account_id, meta_account_name,
                             phone_number, waba_id, meta, created_at, updated_at)
    select
      org_uuid::uuid as user_id,
      case
        when lower(m.provider) = 'whatsapp' then 'whatsapp'
        when lower(m.provider) = 'instagram' then 'instagram'
        when lower(m.provider) = 'facebook' then 'facebook'
        else 'meta' end as channel,
        case
          when lower(m.provider) = 'whatsapp' then 'official'
          when lower(m.provider) in ('instagram','facebook') and current_setting('enable_meta_oauth', true) then 'oauth_meta'
          else 'non_official' end as connection_mode,
        m.provider,
        m.status,
        null as status_reason,
        now() as last_checked_at,
        null as last_error_at,
        null as external_account_id,
        null as external_account_label,
        null as credentials_ref,
        m.accountId as meta_account_id,
        null as meta_account_name,
        m.phoneNumberId as phone_number,
        m.whatsappBusinessAccountId as waba_id,
        '{}'::jsonb as meta,
        m.createdAt as created_at,
        m.updatedAt as updated_at
    from meta_integrations m
    where m.organizationId = org_uuid
      and not exists (
        select 1 from integrations i
        where i.user_id = org_uuid
          and i.channel = case when lower(m.provider) = 'whatsapp' then 'whatsapp'
                              when lower(m.provider) = 'instagram' then 'instagram'
                              when lower(m.provider) = 'facebook' then 'facebook'
                              else 'meta' end
      )
    on conflict (user_id, channel) do nothing;
  end if;
end
$$;

--- 7. Normalização de status (mapa de valores antigos → novos) ---
-- Este update garante que status antigos (da migration 018: PENDING/AUTHENTICATED/CONNECTED/DISCONNECTED/ERROR/EXPIRED/REVOKED)
-- sejam mapeados para o novo enum. Roda apenas se houver linhas na tabela.
update integrations
set status = case
  when status = 'PENDING' then 'pending_credentials'
  when status = 'AUTHENTICATED' then 'connected'
  when status = 'CONNECTED' then 'connected'
  when status = 'DISCONNECTED' then 'disconnected'
  when status = 'ERROR' then 'error'
  when status = 'EXPIRED' then 'expired'
  when status = 'REVOKED' then 'archived'
  else status
end
where status not in ('disconnected','pending_credentials','connecting','connected','expired','error','archived');

--- 8. Backfill user_id em integration_events a partir integrations ---
-- Preenche user_id a partir da integração relacionada, quando user_id for nulo
update integration_events set user_id = i.user_id
from integrations i
where integration_events.integration_id = i.id
  and integration_events.user_id is null;

--- 8. Migration down (reverte tudo) ---

drop index if exists integrations_unique_active_mode;
drop index if exists integrations_read_idx;
drop index if exists integrations_health_idx;

drop table if exists integration_events;

drop policy if exists integrations_user_select on integrations;
drop policy if exists integrations_user_insert on integrations;
drop policy if exists integrations_user_update on integrations;
drop policy if exists integrations_user_delete on integrations;

drop policy if exists integration_events_workspace_select on integration_events;
drop policy if exists integration_events_workspace_insert on integration_events;

alter table if exists integrations drop constraint if exists integrations_mode_check;

alter table if exists integrations drop column if exists connection_mode;
comment on column integrations.connection_mode is 'removed in down migration';

alter table if exists integrations drop column if exists provider;
comment on column integrations.provider is 'removed in down migration';

alter table if exists integrations drop column if exists status_reason;
comment on column integrations.status_reason is 'removed in down migration';

alter table if exists integrations drop column if exists last_checked_at;
comment on column integrations.last_checked_at is 'removed in down migration';

alter table if exists integrations drop column if exists last_error_at;
comment on column integrations.last_error_at is 'removed in down migration';

alter table if exists integrations drop column if exists external_account_id;
comment on column integrations.external_account_id is 'removed in down migration';

alter table if exists integrations drop column if exists external_account_label;
comment on column integrations.external_account_label is 'removed in down migration';

alter table if exists integrations drop column if exists credentials_ref;
comment on column integrations.credentials_ref is 'removed in down migration';

alter table if exists integrations drop column if exists meta;
comment on column integrations.meta is 'removed in down migration';

alter table if exists integrations drop column if exists deleted_at;
comment on column integrations.deleted_at is 'removed in down migration';

-- tabela integrations mantida (apenas colunas antigas da migration 018/021)
-- mode, user_id, channel, status, etc. permanecem — only removemos o novo.