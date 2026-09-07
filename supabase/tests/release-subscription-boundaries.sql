-- Administrative connection; all session settings and fixture writes roll back.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';
DO $$
DECLARE u uuid; email text; org uuid; denied boolean;
BEGIN
  IF has_function_privilege('anon', 'public.get_or_create_user_organization(uuid,text,text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.get_or_create_user_organization_internal(uuid,text,text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.get_or_create_user_organization_internal(uuid,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Untrusted roles must not execute provisioning internals or anonymous bootstrap';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.get_or_create_user_organization_internal(uuid,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Trusted provisioning must remain available';
  END IF;
  SELECT a.id, a.email, m.organization_id INTO STRICT u, email, org
    FROM auth.users a JOIN public.organization_members m ON m.user_id=a.id
    WHERE a.email IS NOT NULL ORDER BY a.id, m.organization_id LIMIT 1;
  PERFORM set_config('request.jwt.claims', '{}', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  denied := false;
  BEGIN
    PERFORM public.get_or_create_user_organization(u,email);
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Missing caller identity must be rejected'; END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub',u,'role','authenticated')::text, true);
  denied := false;
  BEGIN
    PERFORM public.get_or_create_user_organization(gen_random_uuid(),email);
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Foreign caller identity must be rejected'; END IF;
  denied := false;
  BEGIN
    PERFORM public.get_or_create_user_organization(u,'foreign@example.invalid');
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Foreign caller email must be rejected'; END IF;
  IF public.get_or_create_user_organization() IS NULL
    OR public.get_or_create_user_organization(u,email) IS NULL THEN
    RAISE EXCEPTION 'Own provisioning must preserve default and explicit arguments';
  END IF;

  -- An authenticated identity with no entitlement can resolve a public code,
  -- but cannot enumerate the table, create links or call neighboring RPCs.
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
  PERFORM set_config('request.path','/rpc/get_short_url_target',true);
  PERFORM public.enforce_subscription_boundary();
  PERFORM public.get_short_url_target('!invalid-code');
  FOREACH email IN ARRAY ARRAY['/short_urls','/rpc/increment_short_url_clicks','/rpc/get_short_url_target_other','/projects'] LOOP
    PERFORM set_config('request.path',email,true);
    denied := false;
    BEGIN
      PERFORM public.enforce_subscription_boundary();
    EXCEPTION WHEN SQLSTATE 'PT402' THEN denied := true;
    END;
    IF NOT denied THEN RAISE EXCEPTION 'Public resolver exception must remain exact'; END IF;
  END LOOP;
  EXECUTE 'RESET ROLE';
END;
$$;
ROLLBACK;
SELECT 'passed; provisioning and public resolver boundaries verified' AS regression_result;
