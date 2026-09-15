-- Run against the linked schema after migration. All test writes roll back.
BEGIN;
DO $$
DECLARE candidate record; selected boolean := false; test_id uuid := gen_random_uuid();
BEGIN
 -- Choose a real project only after checking the same entitlements as the RPC.
 -- No subscriptions, users or authorization records are changed to make the test pass.
 FOR candidate IN SELECT c0.project_id,c0.owner_id,c0.organization_id,p.owner_id AS project_owner
   FROM public.contracts c0 JOIN public.projects p ON p.id=c0.project_id
   WHERE p.owner_id IS NOT NULL ORDER BY c0.id LOOP
   PERFORM set_config('request.jwt.claim.sub',candidate.project_owner::text,true);
   PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',candidate.project_owner,'role','authenticated')::text,true);
   IF public.has_active_subscription() AND public.can_project_module_action(candidate.project_id::text,'module_contracts',true) THEN
     selected := true;
     EXIT;
   END IF;
 END LOOP;
 IF NOT selected THEN RAISE EXCEPTION 'No entitled writable project fixture available'; END IF;
 PERFORM set_config('test.retention_contract_id',test_id::text,true);
 PERFORM set_config('test.retention_owner',candidate.project_owner::text,true);
 INSERT INTO public.contracts(id,project_id,vendor_name,title,status,currency,base_price,source,owner_id,organization_id,retention_short_percent,retention_short_release_on,retention_long_percent)
 VALUES(test_id,candidate.project_id,'Test','Rollback retention regression','active','CZK',1000,'manual',candidate.owner_id,candidate.organization_id,5,DATE '2026-08-01',0);
 IF (SELECT retention_short_expected_on FROM public.contracts WHERE id=test_id) IS DISTINCT FROM DATE '2026-08-01' THEN RAISE EXCEPTION 'Plan not copied on legacy insert'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('test.retention_owner'),true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.retention_owner'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
SELECT public.release_contract_retention(current_setting('test.retention_contract_id')::uuid,'short',DATE '2026-08-12');
DO $$
DECLARE c public.contracts; n integer;
BEGIN
 SELECT * INTO c FROM public.contracts WHERE id=current_setting('test.retention_contract_id')::uuid;
 IF c.retention_short_expected_on IS DISTINCT FROM DATE '2026-08-01' OR c.retention_short_release_on IS DISTINCT FROM DATE '2026-08-12' OR c.retention_short_status <> 'released' THEN RAISE EXCEPTION 'Plan or release lost'; END IF;
 SELECT count(*) INTO n FROM public.contract_retention_events WHERE contract_id=c.id AND kind='short' AND created_by=auth.uid() AND expected_on=DATE '2026-08-01' AND release_on=DATE '2026-08-12';
 IF n <> 1 THEN RAISE EXCEPTION 'Missing attributed event'; END IF;
 BEGIN
  PERFORM public.release_contract_retention(c.id,'short',DATE '2026-08-13');
  RAISE EXCEPTION 'Duplicate release allowed';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN
  UPDATE public.contract_retention_events SET release_on=current_date WHERE contract_id=c.id;
  RAISE EXCEPTION 'Audit was mutable';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.release_contract_retention(c.id,'long',current_date+1);
  RAISE EXCEPTION 'Future release allowed';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('request.jwt.claim.sub'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.contract_retention_events WHERE contract_id=current_setting('test.retention_contract_id')::uuid) THEN RAISE EXCEPTION 'Foreign user can read audit'; END IF;
 BEGIN
  PERFORM public.release_contract_retention(current_setting('test.retention_contract_id')::uuid,'long',DATE '2026-08-12');
  RAISE EXCEPTION 'Foreign user can release';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN
  PERFORM public.release_contract_retention(current_setting('test.retention_contract_id')::uuid,'long',DATE '2026-08-12');
  RAISE EXCEPTION 'Anonymous release allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
