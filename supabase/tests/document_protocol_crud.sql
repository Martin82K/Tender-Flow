-- All fixture writes roll back. Uses an already entitled owner; changes no real access grants.
BEGIN;
DO $$
DECLARE candidate record; selected boolean := false; contract_id uuid := gen_random_uuid();
BEGIN
  FOR candidate IN SELECT c.project_id,c.owner_id,c.organization_id,p.owner_id AS project_owner
    FROM public.contracts c JOIN public.projects p ON p.id=c.project_id WHERE p.owner_id IS NOT NULL ORDER BY c.id LOOP
    PERFORM set_config('request.jwt.claim.sub',candidate.project_owner::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',candidate.project_owner,'role','authenticated')::text,true);
    IF public.has_active_subscription() AND public.can_project_module_action(candidate.project_id::text,'module_contracts',true) THEN selected := true; EXIT; END IF;
  END LOOP;
  IF NOT selected THEN RAISE EXCEPTION 'No entitled writable fixture'; END IF;
  PERFORM set_config('test.docs_contract',contract_id::text,true);
  INSERT INTO public.contracts(id,project_id,vendor_name,title,status,currency,base_price,source,owner_id,organization_id)
    VALUES(contract_id,candidate.project_id,'Test','Rollback document regression','active','CZK',1000,'manual',candidate.owner_id,candidate.organization_id);
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE cid uuid := current_setting('test.docs_contract')::uuid; docid uuid := gen_random_uuid(); s jsonb; first public.contract_generated_documents; second public.contract_generated_documents; work public.contract_generated_documents;
BEGIN
  s := jsonb_build_object('schemaVersion',1,'templateVersion',1,'kind','sub_site_handover','logo',null,'fields',jsonb_build_object(
    'organizationName','Test','organizationAddress','','vendorName','Test','vendorIco','','vendorAddress','','contractNumber','TEST',
    'projectName','Test','siteLocation','','issuerRepresentative','','vendorRepresentative','','scope','Etapa A','scopeKind','whole',
    'actualDate','','result','','defects','','defectsDeadline','','attachments','','handwritingLines',0,
    'plannedDate',current_date::text,'siteConditions','Brána A','siteSafety','Přilba','siteFacilities','Voda'));
  first := public.save_contract_document_version(cid,docid,0,s);
  IF first.snapshot->>'kind' <> 'sub_site_handover' OR first.created_by <> auth.uid() THEN RAISE EXCEPTION 'Invalid site snapshot'; END IF;
  second := public.save_contract_document_version(cid,docid,1,s);
  BEGIN
    PERFORM public.save_contract_document_version(cid,docid,1,s);
    RAISE EXCEPTION 'Stale save accepted';
  EXCEPTION WHEN serialization_failure THEN NULL; END;
  BEGIN
    PERFORM public.confirm_document_handover(first.id,current_date,'accepted','Old version');
    RAISE EXCEPTION 'Stale confirmation accepted';
  EXCEPTION WHEN serialization_failure THEN NULL; END;
  BEGIN
    PERFORM public.save_contract_document_version(cid,docid,2,jsonb_set(s,'{kind}','"sub_work_handover"'));
    RAISE EXCEPTION 'Kind change accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Typ existujícího dokumentu nelze měnit.' THEN RAISE; END IF; END;
  PERFORM public.confirm_document_handover(second.id,current_date,'accepted','Signed test');
  IF NOT EXISTS (SELECT 1 FROM public.contract_handover_events WHERE document_version_id=second.id AND contract_id=cid AND kind='site_handover' AND created_by=auth.uid()) THEN RAISE EXCEPTION 'Missing linked site event'; END IF;
  work := public.save_contract_document_version(cid,gen_random_uuid(),0,jsonb_set(s,'{kind}','"sub_work_handover"'));
  PERFORM public.confirm_document_handover(work.id,current_date,'with_defects','Work test');
  IF NOT EXISTS (SELECT 1 FROM public.contract_handover_events WHERE document_version_id=work.id AND kind='handover') THEN RAISE EXCEPTION 'Missing work event'; END IF;
  IF EXISTS(SELECT 1 FROM public.contracts WHERE id=cid AND warranty_start_at IS NOT NULL) THEN RAISE EXCEPTION 'Document changed warranty'; END IF;
  BEGIN
    PERFORM public.confirm_document_handover(second.id,current_date+1,'accepted','Future');
    RAISE EXCEPTION 'Future accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Vyplňte skutečné datum, výsledek a zdroj potvrzení.' THEN RAISE; END IF; END;
  BEGIN
    UPDATE public.contract_generated_documents SET snapshot=s WHERE id=second.id;
    RAISE EXCEPTION 'Snapshot mutable';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('test.docs_version',second.id::text,true);
  PERFORM set_config('test.docs_document',docid::text,true);
  BEGIN
    PERFORM public.delete_contract_document(cid,docid,1);
    RAISE EXCEPTION 'Stale deletion accepted';
  EXCEPTION WHEN serialization_failure THEN NULL; END;
  PERFORM public.delete_contract_document(cid,docid,2);
  IF (SELECT count(*) FROM public.contract_generated_documents WHERE document_id=docid AND deleted_at IS NOT NULL AND deleted_by=auth.uid()) <> 2 THEN RAISE EXCEPTION 'Deletion not applied to all versions'; END IF;
  IF EXISTS (SELECT 1 FROM public.contract_generated_documents WHERE document_id=docid AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Deleted record still active'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contract_handover_events WHERE document_version_id=second.id) THEN RAISE EXCEPTION 'Deletion lost audit history'; END IF;
  BEGIN
    PERFORM public.save_contract_document_version(cid,docid,2,s);
    RAISE EXCEPTION 'Deleted record revived';
  EXCEPTION WHEN serialization_failure THEN NULL; END;
  BEGIN
    PERFORM public.confirm_document_handover(second.id,current_date,'accepted','Deleted');
    RAISE EXCEPTION 'Deleted record confirmed';
  EXCEPTION WHEN serialization_failure THEN NULL; END;
  BEGIN
    PERFORM public.delete_contract_document(cid,docid,2);
    RAISE EXCEPTION 'Repeated deletion accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Dokument není dostupný nebo již byl smazán.' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('request.jwt.claim.sub'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.contract_generated_documents WHERE contract_id=current_setting('test.docs_contract')::uuid) OR EXISTS(SELECT 1 FROM public.contract_handover_events WHERE contract_id=current_setting('test.docs_contract')::uuid) THEN RAISE EXCEPTION 'Foreign user can read'; END IF;
  BEGIN
    PERFORM public.confirm_document_handover(current_setting('test.docs_version')::uuid,current_date,'accepted','Foreign');
    RAISE EXCEPTION 'Foreign confirmation accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.delete_contract_document(current_setting('test.docs_contract')::uuid,current_setting('test.docs_document')::uuid,2);
    RAISE EXCEPTION 'Foreign deletion accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.save_contract_document_version(current_setting('test.docs_contract')::uuid,gen_random_uuid(),0,'{}');
    RAISE EXCEPTION 'Foreign save accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM public.delete_contract_document(current_setting('test.docs_contract')::uuid,current_setting('test.docs_document')::uuid,2);
    RAISE EXCEPTION 'Anonymous deletion accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.confirm_document_handover(current_setting('test.docs_version')::uuid,current_date,'accepted','Anonymous');
    RAISE EXCEPTION 'Anonymous confirmation accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
