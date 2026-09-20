-- Run only against a disposable local database with synthetic fixtures, inside BEGIN/ROLLBACK.
DO $$
DECLARE pid text:='budget-primary-fixture'; uid uuid:='82000000-0000-4000-8000-000000000001'; org uuid:='82000000-0000-4000-8000-000000000002';
 src jsonb; rev jsonb; manifest jsonb; bad jsonb; job jsonb; denied boolean; count_before integer;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 src:=public.construction_budget_source(pid,'backup.xlsx',repeat('d',64),'attachment');
 rev:=public.construction_budget_save(pid,(src->>'id')::uuid,NULL,0,'Backup roundtrip','{"schemaVersion":1,"sheets":[],"issues":[],"figures":{},"nodes":[]}','[]',false);
 -- Model a source whose file upload has not completed; only metadata exists.
 PERFORM public.construction_budget_source(pid,'backup.xlsx',repeat('d',64),'attachment');
 manifest:=private.budget_backup_export(jsonb_build_object('organization_id',org,'projects',jsonb_build_array(jsonb_build_object('id',pid))));
 IF jsonb_array_length(manifest->'construction_budgets')<>1 OR manifest#>>'{construction_budgets,0,signature}' IS NULL THEN RAISE EXCEPTION 'Unsigned or incomplete backup'; END IF;
 bad:=jsonb_set(manifest,'{construction_budgets,0,payload}',to_jsonb((manifest#>>'{construction_budgets,0,payload}')||' '));
 denied:=false;
 BEGIN PERFORM private.budget_backup_restore(bad,org,'user'); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Tampered signature accepted'; END IF;
 denied:=false;
 BEGIN PERFORM public.export_user_backup(org); EXCEPTION WHEN raise_exception THEN
   IF position('Aktualizujte aplikaci' IN SQLERRM)=0 THEN RAISE; END IF; denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Legacy exporter silently omitted source files'; END IF;
 IF jsonb_array_length(public.export_user_backup(org,true)->'construction_budgets')<>1 THEN RAISE EXCEPTION 'Public backup omitted budget'; END IF;
 IF private.budget_backup_restore(manifest,org,'user')<>0 THEN RAISE EXCEPTION 'Existing revision overwritten'; END IF;
 DELETE FROM public.construction_budget_history WHERE project_id=pid;
 DELETE FROM public.construction_budget_revisions WHERE project_id=pid;
 DELETE FROM public.construction_budget_sources WHERE project_id=pid;
 IF private.budget_backup_restore(manifest,org,'user')<>1 THEN RAISE EXCEPTION 'Missing revision not restored'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.construction_budget_history WHERE revision_id=(rev->>'id')::uuid) THEN RAISE EXCEPTION 'History not restored'; END IF;
 IF (SELECT revision_id FROM private.construction_budget_preferences WHERE project_id=pid) IS DISTINCT FROM (rev->>'id')::uuid THEN RAISE EXCEPTION 'Primary revision not restored'; END IF;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 denied:=false;
 BEGIN PERFORM public.construction_budget_project_delete_start(pid); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Foreign project deletion accepted'; END IF;
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 job:=public.construction_budget_project_delete_start(pid);
 IF public.construction_budget_project_delete_start(pid)->>'id' IS DISTINCT FROM job->>'id' THEN RAISE EXCEPTION 'Retry changed deletion job'; END IF;
 denied:=false;
 BEGIN PERFORM public.construction_budget_source(pid,'late.xlsx',repeat('e',64),'attachment'); EXCEPTION WHEN raise_exception THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Import allowed during deletion'; END IF;
 PERFORM public.construction_budget_project_delete_finish(pid,(job->>'id')::uuid);
 IF EXISTS(SELECT 1 FROM public.projects WHERE id=pid) OR EXISTS(SELECT 1 FROM private.construction_budget_purge_jobs WHERE project_id=pid) THEN RAISE EXCEPTION 'Project cleanup incomplete'; END IF;
 IF public.construction_budget_project_delete_start(pid)->>'completed'<>'true' THEN RAISE EXCEPTION 'Completed deletion retry failed'; END IF;
END $$;
SELECT 'signed backup, restore, primary, audit, foreign deletion denial and retry passed' AS result;
