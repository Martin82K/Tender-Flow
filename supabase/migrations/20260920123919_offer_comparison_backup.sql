BEGIN;
-- Extend the established signed backup envelope. External source files are not
-- copied; the exact extracted snapshot and source hash are part of the view.
ALTER FUNCTION private.budget_backup_export(jsonb) RENAME TO budget_backup_export_before_offers;
CREATE FUNCTION private.budget_backup_export(manifest jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; project jsonb; payload text; envelopes jsonb:='[]';
BEGIN
 result:=private.budget_backup_export_before_offers(manifest);
 FOR project IN SELECT value FROM jsonb_array_elements(manifest->'projects') LOOP
  IF NOT EXISTS(SELECT 1 FROM public.offer_comparison_views WHERE project_id=project->>'id') THEN CONTINUE; END IF;
  IF private.offer_comparison_access(project->>'id',false) IS NOT TRUE THEN RAISE EXCEPTION 'Comparison backup access denied' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object('project_id',project->>'id','organization_id',manifest->>'organization_id','views',jsonb_agg(to_jsonb(v) ORDER BY id))::text INTO payload FROM public.offer_comparison_views v WHERE project_id=project->>'id';
  envelopes:=envelopes||jsonb_build_array(jsonb_build_object('payload',payload,'signature',private.budget_backup_signature(payload)));
 END LOOP;
 RETURN result||jsonb_build_object('offer_comparisons',envelopes);
END $$;
ALTER FUNCTION private.budget_backup_restore(jsonb,uuid,text) RENAME TO budget_backup_restore_before_offers;
CREATE FUNCTION private.budget_backup_restore(manifest jsonb,org_id uuid,scope text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE restored integer; envelope jsonb; snapshot jsonb; item jsonb; entry public.offer_comparison_views; pid text;
BEGIN
 restored:=private.budget_backup_restore_before_offers(manifest,org_id,scope);
 IF NOT manifest ? 'offer_comparisons' THEN RETURN restored; END IF;
 IF auth.uid() IS NULL OR scope IS NULL OR scope NOT IN ('user','tenant') OR public.is_org_member(org_id) IS NOT TRUE OR (scope='tenant' AND public.is_org_admin(org_id) IS NOT TRUE) THEN RAISE EXCEPTION 'Comparison restore denied' USING ERRCODE='42501'; END IF;
 FOR envelope IN SELECT value FROM jsonb_array_elements(manifest->'offer_comparisons') LOOP
  IF envelope->>'payload' IS NULL OR envelope->>'signature' IS NULL OR private.budget_backup_signature(envelope->>'payload') IS DISTINCT FROM envelope->>'signature' THEN RAISE EXCEPTION 'Invalid comparison backup signature'; END IF;
  snapshot:=(envelope->>'payload')::jsonb;pid:=snapshot->>'project_id';
  IF (snapshot->>'organization_id')::uuid IS DISTINCT FROM org_id OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(manifest->'projects') p WHERE p->>'id'=pid)
   OR NOT EXISTS(SELECT 1 FROM public.projects p WHERE p.id=pid AND p.organization_id=org_id AND (scope='tenant' OR p.owner_id=auth.uid()))
   OR private.offer_comparison_access(pid,true) IS NOT TRUE THEN RAISE EXCEPTION 'Foreign comparison backup'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(snapshot->'views') LOOP
   entry:=jsonb_populate_record(NULL::public.offer_comparison_views,item);
   IF entry.project_id IS DISTINCT FROM pid OR entry.organization_id IS DISTINCT FROM org_id THEN RAISE EXCEPTION 'Foreign comparison entry'; END IF;
   IF EXISTS(SELECT 1 FROM public.offer_comparison_views WHERE id=entry.id AND (project_id<>pid OR organization_id<>org_id OR document IS DISTINCT FROM entry.document)) THEN RAISE EXCEPTION 'Comparison restore conflict'; END IF;
   IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=entry.created_by) THEN entry.created_by:=NULL; END IF;
   INSERT INTO public.offer_comparison_views SELECT entry.* ON CONFLICT(id) DO NOTHING;
  END LOOP;
 END LOOP;
 RETURN restored;
END $$;
REVOKE ALL ON FUNCTION private.budget_backup_export(jsonb),private.budget_backup_export_before_offers(jsonb),private.budget_backup_restore(jsonb,uuid,text),private.budget_backup_restore_before_offers(jsonb,uuid,text) FROM PUBLIC,anon,authenticated,service_role,tenderflow_mcp_client;
COMMIT;
