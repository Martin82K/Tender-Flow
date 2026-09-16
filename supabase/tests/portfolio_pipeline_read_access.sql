BEGIN;
DO $$ DECLARE uid uuid;
BEGIN
  SELECT owner_id INTO uid FROM public.projects WHERE owner_id IS NOT NULL LIMIT 1;
  IF uid IS NULL THEN RAISE EXCEPTION 'No project fixture'; END IF;
  PERFORM set_config('request.jwt.claim.sub',uid::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
END $$;
SET LOCAL ROLE authenticated;
DO $$ DECLARE ids text[]; actual text[]; expected text[];
BEGIN
  SELECT array_agg(id ORDER BY id) INTO ids FROM public.projects;
  ids := COALESCE(ids,ARRAY[]::text[]) || gen_random_uuid()::text;
  SELECT array_agg(project_id ORDER BY project_id) INTO actual FROM public.get_portfolio_pipeline_read_access(ids);
  SELECT array_agg(id ORDER BY id) INTO expected FROM public.projects WHERE id=ANY(ids) AND public.can_project_module_action(id,'module_pipeline',false);
  IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Bulk permission check differs from RLS and module access'; END IF;
  IF has_function_privilege('anon','public.get_portfolio_pipeline_read_access(text[])','EXECUTE') THEN RAISE EXCEPTION 'Anonymous permission enumeration allowed'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
