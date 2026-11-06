-- ============================================================================
-- 028_tenant_rls_reconstruction.sql — DRAFT (não aplicado)
-- Rev: 2026-11-06 | Auditoria docs/auditoria/PROBLEMAS_E_BLOQUEIOS.md C-2
-- Objetivo: restaurar isolamento por tenant em TODAS as tabelas do schema
-- público do banco de produção (Supabase), no padrão já vivo em produção
-- (NULLIF(current_setting('app.current_org',true),'')::uuid — espelha
-- AdminAlert_tenant / growth_leads_org / whatsapp_instances_org).
--
-- PRÉ-REQUISITOS (ver FASE3_PLANO_CREDENCIAIS_E_RLS.md):
--   1. Revisão humana do DDL.
--   2. Aplicar primeiro no banco de teste local (supabase-docker) e rodar a
--      suíte de autorização negativa.
--   3. Janela de deploy: policies são aditivas; apps atuais usam service_role
--      /postgres (BYPASSRLS) e NÃO quebram. A proteção vale para as vias
--      anon/authenticated e prepara o caminho para T3.3 (desligar BYPASSRLS
--      da via Prisma com role revx_app dedicada).
-- Idempotente: DROP POLICY IF EXISTS antes de cada CREATE.
-- ============================================================================
BEGIN;

-- ---------- Grupo A: tabelas com "organizationId" (uuid, PascalCase) ----------
DO $$
DECLARE
  t text;
  tabela text[] := ARRAY[
    'AgentMemory','BillingEvent','CalendarEvent','Campaign','CampaignRecipient',
    'Contact','Deal','Lead','Media','Message','OrganizationMember','Pipeline',
    'Post','Product','Report','RiskLog','Role','ScraperConfig','Session',
    'Subscription','Task','TaskEvent','TaskStep','Usage','Video',
    'growth_leads','whatsapp_channels','whatsapp_instances','whatsapp_templates'
  ];
BEGIN
  FOREACH t IN ARRAY tabela LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_tenant', t);
    IF t = 'Session' THEN
      -- sessão própria OU da organização (login precisa achar a própria sessão)
      EXECUTE format(
        $f$CREATE POLICY %I ON public.%I FOR ALL USING (
             "organizationId" = NULLIF(current_setting('app.current_org', true), '')::uuid
             OR "userId" = NULLIF(current_setting('app.current_user_id', true), '')::uuid)$f$,
        t || '_tenant', t);
    ELSE
      EXECUTE format(
        $f$CREATE POLICY %I ON public.%I FOR ALL USING (
             "organizationId" = NULLIF(current_setting('app.current_org', true), '')::uuid)
           WITH CHECK (
             "organizationId" = NULLIF(current_setting('app.current_org', true), '')::uuid)$f$,
        t || '_tenant', t);
    END IF;
  END LOOP;
END $$;

-- ---------- Grupo B: tenant snake_case ----------
ALTER TABLE public.meta_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_integrations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS meta_integrations_tenant ON public.meta_integrations;
CREATE POLICY meta_integrations_tenant ON public.meta_integrations FOR ALL USING (
  organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid)
WITH CHECK (
  organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid);

-- ---------- Grupo C: user-scoped (tokens de e-mail/reset) ----------
DO $$
DECLARE
  t text;
  tabela text[] := ARRAY['EmailVerificationToken','PasswordResetToken'];
BEGIN
  FOREACH t IN ARRAY tabela LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_user', t);
    EXECUTE format(
      $f$CREATE POLICY %I ON public.%I FOR ALL USING (
         "userId" = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
       WITH CHECK (
         "userId" = NULLIF(current_setting('app.current_user_id', true), '')::uuid)$f$,
      t || '_user', t);
  END LOOP;
END $$;

-- ---------- Grupo D: integração/eventos (snake_case, sem org) ----------
-- integration_events: já tem service_role(TRUE)+tenant por workspace_id; só FORÇA.
ALTER TABLE public.integration_events FORCE ROW LEVEL SECURITY;

-- webhook_events: SEM coluna de tenant (ligada por integration_id).
-- Política: somente papel de serviço; anon/authenticated ficam de fora.
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS webhook_events_service_only ON public.webhook_events;
CREATE POLICY webhook_events_service_only ON public.webhook_events FOR ALL
  USING (current_user IN ('service_role','postgres'))
  WITH CHECK (current_user IN ('service_role','postgres'));

-- integrations: policy user_id já existe; falta FORCE.
ALTER TABLE public.integrations FORCE ROW LEVEL SECURITY;

-- ---------- Grupo E: tabelas globais ----------
-- User/Organization/Plan/Permission: leitura só via serviço/membros.
-- Mantido SEM RLS nesta fase (a rota register depende de escrita service_role
-- e Organization é lida antes do GUC existir). Decisão T3.3 documentada.
-- AdminAlert: mantém policy atual (organizationId NULL = alerta de sistema).

-- ---------- Verificação final (rodar depois, esperado 0 linhas) ----------
-- select relname from pg_class where relnamespace='public'::regnamespace
--   and relkind='r' and not relforcerowsecurity
--   and relname not in ('User','Organization','Plan','Permission','_prisma_migrations');

COMMIT;
