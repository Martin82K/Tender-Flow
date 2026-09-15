-- Only random fixtures; no deletion; all writes roll back.
BEGIN;
DO $$
DECLARE candidate record; selected boolean := false; cid uuid := gen_random_uuid(); item jsonb; manifest jsonb;
BEGIN
  FOR candidate IN SELECT p.id,p.owner_id,p.organization_id FROM public.projects p
    WHERE p.owner_id IS NOT NULL AND p.organization_id IS NOT NULL AND p.status <> 'archived' LOOP
    PERFORM set_config('request.jwt.claim.sub',candidate.owner_id::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',candidate.owner_id,'role','authenticated')::text,true);
    IF public.is_org_admin(candidate.organization_id) AND public.has_active_subscription()
      AND public.can_project_module_action(candidate.id,'module_contracts',true) THEN selected := true; EXIT; END IF;
  END LOOP;
  IF NOT selected THEN RAISE EXCEPTION 'No entitled fixture'; END IF;
  INSERT INTO public.contracts(id,project_id,vendor_name,title,status,currency,base_price,source,owner_id,organization_id,retention_short_percent,retention_short_release_on)
  VALUES(cid,candidate.id,'Rollback fixture','Backup tampering regression','active','CZK',1000,'manual',candidate.owner_id,candidate.organization_id,5,DATE '2026-08-01');
  SELECT to_jsonb(c) INTO item FROM public.contracts c WHERE id=cid;
  manifest := jsonb_build_object('version','1.0','contracts',jsonb_build_array(item || jsonb_build_object('retention_short_status','released','retention_short_release_on','2026-08-12','contract_retention_events','[]'::jsonb)));
  PERFORM public.restore_user_backup(manifest,candidate.organization_id);
  IF (SELECT retention_short_status FROM public.contracts WHERE id=cid) IS DISTINCT FROM 'held' THEN RAISE EXCEPTION 'Unsigned backup changed existing retention without audit'; END IF;
  IF EXISTS(SELECT 1 FROM public.contract_retention_events WHERE contract_id=cid) THEN RAISE EXCEPTION 'Backup forged existing audit'; END IF;
END $$;
ROLLBACK;
