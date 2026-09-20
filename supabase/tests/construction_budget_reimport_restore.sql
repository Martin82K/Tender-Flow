-- Disposable local fixture; caller wraps BEGIN/ROLLBACK.
DO $$
DECLARE pid text:='budget-primary-fixture'; org uuid:='82000000-0000-4000-8000-000000000002'; old_source jsonb; new_source jsonb; old_revision jsonb; new_revision jsonb; manifest jsonb; doc jsonb:='{"schemaVersion":1,"nodes":[],"sheets":[],"issues":[],"figures":{}}';
BEGIN
 PERFORM set_config('request.jwt.claim.sub','82000000-0000-4000-8000-000000000001',true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 old_source:=public.construction_budget_source(pid,'old.xlsx',repeat('8',64),'attachment');
 old_revision:=public.construction_budget_save(pid,(old_source->>'id')::uuid,NULL,0,'Old revision',doc,'[]',false);
 PERFORM public.construction_budget_source(pid,'old.xlsx',repeat('8',64),'attachment');
 manifest:=private.budget_backup_export(jsonb_build_object('organization_id',org,'projects',jsonb_build_array(jsonb_build_object('id',pid))));
 DELETE FROM public.construction_budget_history WHERE project_id=pid;
 DELETE FROM public.construction_budget_revisions WHERE project_id=pid;
 DELETE FROM public.construction_budget_sources WHERE project_id=pid;
 new_source:=public.construction_budget_source(pid,'reimport.xlsx',repeat('8',64),'attachment');
 new_revision:=public.construction_budget_save(pid,(new_source->>'id')::uuid,NULL,0,'New revision',doc,'[]',false);
 IF private.budget_backup_restore(manifest,org,'user')<>1 THEN RAISE EXCEPTION 'Old revision not restored after reimport'; END IF;
 IF (SELECT source_id FROM public.construction_budget_revisions WHERE id=(old_revision->>'id')::uuid) IS DISTINCT FROM (new_source->>'id')::uuid THEN RAISE EXCEPTION 'Restored source not reconciled'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.construction_budget_revisions WHERE id=(new_revision->>'id')::uuid AND title='New revision') THEN RAISE EXCEPTION 'Current revision overwritten'; END IF;
 IF (SELECT count(*) FROM public.construction_budget_sources WHERE project_id=pid)<>1 THEN RAISE EXCEPTION 'Duplicate source created'; END IF;
 IF private.budget_backup_restored_sources(manifest,org)->>(old_source->>'id') IS DISTINCT FROM new_source->>'id' THEN RAISE EXCEPTION 'Storage source mapping missing'; END IF;
 IF private.budget_backup_restore(manifest,org,'user')<>0 THEN RAISE EXCEPTION 'Repeated reconciliation is not idempotent'; END IF;
END $$;
SELECT 'same-hash reimport reconciled; both revisions preserved; storage map and retry passed' AS result;
