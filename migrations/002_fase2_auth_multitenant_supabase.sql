BEGIN;

-- ============================================================
-- REVOLUTION X
-- FASE 2 — AUTH + MULTI-TENANT
-- MIGRATION 002
----------------

-- Esta migration:
-- - usa auth.users do Supabase como identidade
-- - NAO cria public.users
-- - NAO cria sessions de autenticacao
-- - NAO cria password_hash
-- - NAO cria password_reset_tokens
-- - NAO cria email_verification_tokens
-- - NAO altera public.users
-- - NAO altera public.profiles
-- - NAO altera public.posts
-- - NAO altera public.comments
-- - NAO insere dados de negocio
--------------------------------

-- Tabelas criadas:
-- public.plans
-- public.organizations
-- public.organization_members
-- public.roles
-- public.permissions
-- public.subscriptions
-- public.usage
-- public.billing_events
-- ============================================================

-- ============================================================
-- 1. VERIFICAR SUPABASE AUTH
-- ============================================================

DO $$
BEGIN

IF NOT EXISTS (
SELECT 1
FROM pg_catalog.pg_class AS c
INNER JOIN pg_catalog.pg_namespace AS n
ON n.oid = c.relnamespace
WHERE n.nspname = 'auth'
AND c.relname = 'users'
AND c.relkind = 'r'
) THEN

RAISE EXCEPTION
  'Pre-condicao falhou: auth.users nao foi encontrada.';

END IF;

END;

$$;


-- ============================================================
-- 2. PLANOS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,

  price_monthly NUMERIC(12,2) NOT NULL DEFAULT 0,
  price_yearly NUMERIC(12,2) NOT NULL DEFAULT 0,

  max_members INTEGER NOT NULL DEFAULT 1,
  max_storage_mb INTEGER NOT NULL DEFAULT 1024,

  active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT plans_price_monthly_nonnegative
    CHECK (price_monthly >= 0),

  CONSTRAINT plans_price_yearly_nonnegative
    CHECK (price_yearly >= 0),

  CONSTRAINT plans_max_members_positive
    CHECK (max_members > 0),

  CONSTRAINT plans_max_storage_positive
    CHECK (max_storage_mb > 0)
);


-- ============================================================
-- 3. ORGANIZACOES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,

  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,

  active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 4. MEMBROS DAS ORGANIZACOES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id UUID NOT NULL
    REFERENCES public.organizations(id)
    ON DELETE CASCADE,

  user_id UUID NOT NULL
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

  role_id UUID,

  active BOOLEAN NOT NULL DEFAULT TRUE,

  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT organization_members_unique_user
    UNIQUE (organization_id, user_id)
);


-- ============================================================
-- 5. ROLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id UUID NOT NULL
    REFERENCES public.organizations(id)
    ON DELETE CASCADE,

  name TEXT NOT NULL,
  slug TEXT NOT NULL,

  description TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT roles_unique_slug_per_organization
    UNIQUE (organization_id, slug)
);


-- ============================================================
-- 6. PERMISSOES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,

  description TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 7. RELACIONAR MEMBER COM ROLE
-- ============================================================

DO $$
BEGIN

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'organization_members_role_id_fkey'
      AND conrelid = 'public.organization_members'::regclass
  ) THEN

    ALTER TABLE public.organization_members
      ADD CONSTRAINT organization_members_role_id_fkey
      FOREIGN KEY (role_id)
      REFERENCES public.roles(id)
      ON DELETE SET NULL;

  END IF;

END;
$$;


-- ============================================================
-- 8. ASSINATURAS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id UUID NOT NULL
    REFERENCES public.organizations(id)
    ON DELETE CASCADE,

  plan_id UUID NOT NULL
    REFERENCES public.plans(id)
    ON DELETE RESTRICT,

  status TEXT NOT NULL DEFAULT 'active',

  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,

  external_subscription_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT subscriptions_status_check
    CHECK (
      status IN (
        'trialing',
        'active',
        'past_due',
        'canceled',
        'incomplete',
        'paused'
      )
    )
);


-- ============================================================
-- 9. USAGE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id UUID NOT NULL
    REFERENCES public.organizations(id)
    ON DELETE CASCADE,

  metric TEXT NOT NULL,

  quantity BIGINT NOT NULL DEFAULT 0,

  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT usage_quantity_nonnegative
    CHECK (quantity >= 0),

  CONSTRAINT usage_period_valid
    CHECK (period_end > period_start),

  CONSTRAINT usage_unique_period_metric
    UNIQUE (
      organization_id,
      metric,
      period_start,
      period_end
    )
);


-- ============================================================
-- 10. BILLING EVENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id UUID
    REFERENCES public.organizations(id)
    ON DELETE SET NULL,

  event_type TEXT NOT NULL,

  external_event_id TEXT,

  payload JSONB NOT NULL DEFAULT '{}'::jsonb,

  processed BOOLEAN NOT NULL DEFAULT FALSE,

  processed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT billing_events_external_event_unique
    UNIQUE (external_event_id)
);


-- ============================================================
-- 11. INDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_organizations_owner_id
  ON public.organizations(owner_id);

CREATE INDEX IF NOT EXISTS idx_organizations_plan_id
  ON public.organizations(plan_id);

CREATE INDEX IF NOT EXISTS idx_organization_members_organization_id
  ON public.organization_members(organization_id);

CREATE INDEX IF NOT EXISTS idx_organization_members_user_id
  ON public.organization_members(user_id);

CREATE INDEX IF NOT EXISTS idx_organization_members_role_id
  ON public.organization_members(role_id);

CREATE INDEX IF NOT EXISTS idx_roles_organization_id
  ON public.roles(organization_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_organization_id
  ON public.subscriptions(organization_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id
  ON public.subscriptions(plan_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status
  ON public.subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_usage_organization_id
  ON public.usage(organization_id);

CREATE INDEX IF NOT EXISTS idx_usage_metric
  ON public.usage(metric);

CREATE INDEX IF NOT EXISTS idx_billing_events_organization_id
  ON public.billing_events(organization_id);

CREATE INDEX IF NOT EXISTS idx_billing_events_event_type
  ON public.billing_events(event_type);

CREATE INDEX IF NOT EXISTS idx_billing_events_processed
  ON public.billing_events(processed);


-- ============================================================
-- 12. FUNCAO updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_organizations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN

  NEW.updated_at = NOW();

  RETURN NEW;

END;
$function$;


-- ============================================================
-- 13. TRIGGER ORGANIZATIONS
-- ============================================================

DROP TRIGGER IF EXISTS trg_organizations_updated_at
  ON public.organizations;

CREATE TRIGGER trg_organizations_updated_at
BEFORE UPDATE
ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.set_organizations_updated_at();


-- ============================================================
-- 14. FUNCAO GENERICA updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN

  NEW.updated_at = NOW();

  RETURN NEW;

END;
$function$;


-- ============================================================
-- 15. TRIGGERS DE UPDATED_AT
-- ============================================================

DROP TRIGGER IF EXISTS trg_plans_updated_at
  ON public.plans;

CREATE TRIGGER trg_plans_updated_at
BEFORE UPDATE
ON public.plans
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


DROP TRIGGER IF EXISTS trg_subscriptions_updated_at
  ON public.subscriptions;

CREATE TRIGGER trg_subscriptions_updated_at
BEFORE UPDATE
ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


DROP TRIGGER IF EXISTS trg_usage_updated_at
  ON public.usage;

CREATE TRIGGER trg_usage_updated_at
BEFORE UPDATE
ON public.usage
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 16. VALIDAR TABELAS
-- ============================================================

DO $$
DECLARE
  required_table TEXT;
BEGIN

  FOREACH required_table IN ARRAY ARRAY[
    'plans',
    'organizations',
    'organization_members',
    'roles',
    'permissions',
    'subscriptions',
    'usage',
    'billing_events'
  ]

  LOOP

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = required_table
    ) THEN

      RAISE EXCEPTION
        'Validacao falhou: tabela public.% nao foi encontrada.',
        required_table;

    END IF;

  END LOOP;

END;
$$;


-- ============================================================
-- 17. VALIDAR FK ORGANIZATION_MEMBERS -> AUTH.USERS
-- ============================================================

DO $$
BEGIN

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS c
    INNER JOIN pg_catalog.pg_class AS child_table
      ON child_table.oid = c.conrelid
    INNER JOIN pg_catalog.pg_namespace AS child_schema
      ON child_schema.oid = child_table.relnamespace
    INNER JOIN pg_catalog.pg_class AS parent_table
      ON parent_table.oid = c.confrelid
    INNER JOIN pg_catalog.pg_namespace AS parent_schema
      ON parent_schema.oid = parent_table.relnamespace
    WHERE child_schema.nspname = 'public'
      AND child_table.relname = 'organization_members'
      AND parent_schema.nspname = 'auth'
      AND parent_table.relname = 'users'
      AND c.contype = 'f'
  ) THEN

    RAISE EXCEPTION
      'Validacao falhou: FK organization_members -> auth.users nao foi encontrada.';

  END IF;

END;
$$;


-- ============================================================
-- 18. VALIDAR COLUNAS CRITICAS
-- ============================================================

DO $$
BEGIN

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_members'
      AND column_name = 'organization_id'
  ) THEN

    RAISE EXCEPTION
      'Validacao falhou: organization_members.organization_id nao foi encontrada.';

  END IF;


  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_members'
      AND column_name = 'user_id'
  ) THEN

    RAISE EXCEPTION
      'Validacao falhou: organization_members.user_id nao foi encontrada.';

  END IF;


  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_members'
      AND column_name = 'role_id'
  ) THEN

    RAISE EXCEPTION
      'Validacao falhou: organization_members.role_id nao foi encontrada.';

  END IF;

END;
$$;


-- ============================================================
-- 19. VALIDAR QUE PUBLIC.USERS NAO FOI CRIADA/ALTERADA
-- ============================================================

DO $$
BEGIN

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'users'
  ) THEN

    RAISE EXCEPTION
      'Validacao falhou: public.users existente nao foi encontrada.';

  END IF;

END;
$$;


-- ============================================================
-- 20. FINALIZAR
-- ============================================================

COMMIT;
