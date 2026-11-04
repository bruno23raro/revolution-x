-- Recria o auth hook custom_access_token_hook (perdido no db reset de 2026-11-04).
-- GoTrue chama esta função em todo login; sem ela, /token retorna 500.
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  claims jsonb;
  user_role text;
  org_id uuid;
BEGIN
  claims := (event -> 'claims')::jsonb;
  BEGIN
    SELECT om.role::text, om."organizationId"
      INTO user_role, org_id
    FROM public."OrganizationMember" om
    WHERE om."userId" = (event -> 'user' ->> 'id')::uuid
    ORDER BY om."joinedAt" ASC
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    user_role := NULL;
    org_id := NULL;
  END;
  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_role}', to_jsonb(user_role));
  END IF;
  IF org_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_org}', to_jsonb(org_id::text));
  END IF;
  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$fn$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
