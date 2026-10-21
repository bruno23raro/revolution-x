-- ============================================================================
-- test_multiaccount.sql — PROBE DE MULTI-CONTA (REVERSÍVEL)
--
--   EXECUTAR SOMENTE DEPOIS que apply_dev.sh (cadeia 002a+005+015+016)
--   tiver APLICADO e o verify_dev.sql tenha passado, NO PROJETO DEV
--   (urdmpzjycwywsjzhpntc). NUNCA em produção.
--
--   O que prova:
--     1) DUAS contas do MESMO provedor (facebook) coexistem na MESMA org
--        (a constraint UNIQUE(org,provider) de 005 foi removida por 016).
--     2) Duplicata EXATA da MESMA conta (org, provider, mesma page) é
--        BLOQUEADA pelo índice de expressão uq_meta_integrations_account.
--     3) Linha PENDING (sem nenhum id) continua inserível (NULLs não colidem
--        no índice de expressão) — preserva o fluxo de pending do app.
--
--   Reversível: cria uma org com slug único (rx-dev-test-xxxxxxxx) e faz
--   DELETE dela + de suas meta_integrations ao final. Re-execuável à vontade.
--
--   Assumem-se as mesmas credenciais do apply (superuser/BYPASSRLS do banco
--   DEV). Ajusta app.current_org para que, mesmo sob um papel RLS-subject,
--   a política de tenant não bloqueie as inserções.
-- ============================================================================
\set ON_ERROR_STOP 1

DO $$
DECLARE
  test_org     UUID;
  slug         TEXT;
  acc_a        UUID;
  exact_blocked BOOLEAN := FALSE;
BEGIN
  -- 0) org dedicada, slug único (reexecução nunca colide).
  slug := 'rx-dev-test-' || substr(gen_random_uuid()::text, 1, 8);
  INSERT INTO public.organizations (name, slug)
    VALUES ('RX dev multi-account probe', slug)
    RETURNING id INTO test_org;
  PERFORM set_config('app.current_org', test_org::text, false);

  -- 1) DUAS contas do MESMO provider (facebook), páginas distintas.
  INSERT INTO public.meta_integrations
    (organization_id, provider, meta_page_id, encrypted_access_token, status)
    VALUES (test_org, 'facebook', 'PAGE_A', 'enc-test-A', 'CONNECTED')
    RETURNING id INTO acc_a;
  INSERT INTO public.meta_integrations
    (organization_id, provider, meta_page_id, encrypted_access_token, status)
    VALUES (test_org, 'facebook', 'PAGE_B', 'enc-test-B', 'CONNECTED');

  -- 1b) Uma linha PENDING sem nenhum id continua inserível (NULL no índice).
  INSERT INTO public.meta_integrations
    (organization_id, provider, encrypted_access_token, status)
    VALUES (test_org, 'facebook', 'enc-test-C', 'PENDING');

  -- 2) Duplicata EXATA (org, provider, PAGE_A) DEVE ser bloqueada.
  BEGIN
    INSERT INTO public.meta_integrations
      (organization_id, provider, meta_page_id, encrypted_access_token, status)
      VALUES (test_org, 'facebook', 'PAGE_A', 'enc-test-A-dup', 'CONNECTED');
    RAISE EXCEPTION 'FALHOU: duplicata exata foi ACEITA (uq_meta_integrations_account ausente?)';
  EXCEPTION
    WHEN unique_violation THEN
      exact_blocked := TRUE;
      RAISE NOTICE 'exata duplicada corretamente bloqueada (unique_violation)';
  END;

  -- 3) Assert: as duas contas de página distintas coexistem.
  IF (SELECT count(*) FROM public.meta_integrations
       WHERE organization_id = test_org AND provider = 'facebook'
         AND meta_page_id IN ('PAGE_A','PAGE_B')) <> 2 THEN
    RAISE EXCEPTION 'FALHOU: duas contas do mesmo provider não coexistem (got %)',
      (SELECT count(*) FROM public.meta_integrations
       WHERE organization_id = test_org AND provider = 'facebook'
         AND meta_page_id IN ('PAGE_A','PAGE_B'));
  END IF;

  RAISE NOTICE 'OK: 2 contas do mesmo provider coexistem; exact-dup blocked=%; pending ok', exact_blocked;

  -- CLEANUP reversível.
  DELETE FROM public.meta_integrations WHERE organization_id = test_org;
  DELETE FROM public.organizations WHERE id = test_org;
  RAISE NOTICE 'limpeza: org % e suas meta_integrations removidas', test_org;
END
$$;
