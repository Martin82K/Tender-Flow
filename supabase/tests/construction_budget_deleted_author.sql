-- Disposable local fixture; caller wraps BEGIN/ROLLBACK.
DO $$
DECLARE uid uuid:='82000000-0000-4000-8000-000000000099'; pid text:='budget-primary-fixture'; src jsonb; rev jsonb; job jsonb; manifest jsonb;
BEGIN
 PERFORM set_config('session_replication_role','replica',true);
 INSERT INTO auth.users(id,email) VALUES(uid,'deleted-budget-author@fixture.invalid');
 PERFORM set_config('session_replication_role','origin',true);
 PERFORM set_config('request.jwt.claim.sub','82000000-0000-4000-8000-000000000001',true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 src:=public.construction_budget_source(pid,'author.xlsx',repeat('9',64),'attachment');
 rev:=public.construction_budget_save(pid,(src->>'id')::uuid,NULL,0,'Deleted author','{"schemaVersion":1,"nodes":[],"sheets":[],"issues":[],"figures":{}}','[]',false);
 UPDATE public.construction_budget_sources SET created_by=uid,deleted_by=uid WHERE id=(src->>'id')::uuid;
 UPDATE public.construction_budget_revisions SET created_by=uid,deleted_by=uid WHERE id=(rev->>'id')::uuid;
 UPDATE public.construction_budget_history SET actor_id=uid WHERE revision_id=(rev->>'id')::uuid;
 INSERT INTO private.construction_budget_restore_files(source_id,actor_id) VALUES((src->>'id')::uuid,uid);
 PERFORM public.construction_budget_source(pid,'author.xlsx',repeat('9',64),'attachment');
 manifest:=private.budget_backup_export(jsonb_build_object('organization_id','82000000-0000-4000-8000-000000000002','projects',jsonb_build_array(jsonb_build_object('id',pid))));
 job:=public.construction_budget_project_delete_start(pid);
 UPDATE private.construction_budget_purge_jobs SET actor_id=uid WHERE id=(job->>'id')::uuid;
 DELETE FROM auth.users WHERE id=uid;
 IF NOT EXISTS(SELECT 1 FROM public.construction_budget_sources WHERE id=(src->>'id')::uuid AND created_by IS NULL AND deleted_by IS NULL)
 OR NOT EXISTS(SELECT 1 FROM public.construction_budget_revisions WHERE id=(rev->>'id')::uuid AND created_by IS NULL AND deleted_by IS NULL)
 OR NOT EXISTS(SELECT 1 FROM public.construction_budget_history WHERE revision_id=(rev->>'id')::uuid AND actor_id IS NULL)
 OR NOT EXISTS(SELECT 1 FROM private.construction_budget_purge_jobs WHERE id=(job->>'id')::uuid AND actor_id IS NULL)
 OR EXISTS(SELECT 1 FROM private.construction_budget_restore_files WHERE source_id=(src->>'id')::uuid)
 THEN RAISE EXCEPTION 'Deleted author lost data or retained capability'; END IF;
 -- Another authorized owner can still finish the durable operation.
 PERFORM public.construction_budget_project_delete_finish(pid,(job->>'id')::uuid);
 IF EXISTS(SELECT 1 FROM public.projects WHERE id=pid) THEN RAISE EXCEPTION 'Deletion job cannot resume'; END IF;
 INSERT INTO public.projects(id,name,status,owner_id,organization_id) VALUES(pid,'Restored','tender','82000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000002');
 PERFORM private.budget_backup_restore(manifest,'82000000-0000-4000-8000-000000000002','user');
 IF EXISTS(SELECT 1 FROM public.construction_budget_sources WHERE project_id=pid AND (created_by IS NOT NULL OR deleted_by IS NOT NULL)) OR EXISTS(SELECT 1 FROM public.construction_budget_revisions WHERE project_id=pid AND (created_by IS NOT NULL OR deleted_by IS NOT NULL)) OR EXISTS(SELECT 1 FROM public.construction_budget_history WHERE project_id=pid AND actor_id IS NOT NULL) THEN RAISE EXCEPTION 'Backup reattributed deleted author'; END IF;
END $$;
SELECT 'deleted author anonymized; audit retained; restore grant removed; job resumable' AS result;
