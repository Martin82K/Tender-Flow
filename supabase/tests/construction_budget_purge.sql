-- Synthetic fixtures only. Caller must wrap in BEGIN/ROLLBACK.
CREATE TEMP TABLE budget_purge_test_context AS SELECT p.id AS project_id,p.owner_id
FROM public.projects p WHERE private.budget_can_purge(p.id) LIMIT 0;
-- Find an organization owner who also owns a licensed project; do not mutate memberships.
INSERT INTO budget_purge_test_context SELECT p.id,p.owner_id FROM public.projects p JOIN public.organization_members m ON m.organization_id=p.organization_id AND m.user_id=p.owner_id AND m.is_active AND m.role IN ('owner','admin') WHERE p.status<>'archived' LIMIT 1;
GRANT SELECT ON budget_purge_test_context TO authenticated;
SELECT set_config('request.jwt.claim.sub',(SELECT owner_id::text FROM budget_purge_test_context),true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE p text; src jsonb; rev jsonb; manifest jsonb; job uuid:=gen_random_uuid(); denied boolean; doc jsonb;
BEGIN
 SELECT project_id INTO p FROM budget_purge_test_context;
 IF NOT private.budget_can_purge(p) THEN RAISE EXCEPTION 'No licensed administrator fixture'; END IF;
 src:=public.construction_budget_source(p,'purge-synthetic.xlsx',repeat('b',64));
 doc:='{"schemaVersion":1,"sheets":[],"issues":[],"figures":{},"nodes":[]}'::jsonb;
 rev:=public.construction_budget_save(p,(src->>'id')::uuid,NULL,0,'Purge test',doc,'[]',false);
 denied:=false;
 BEGIN PERFORM public.construction_budget_purge_start(p,job,jsonb_build_array(jsonb_build_object('id',rev->>'id','version',1)),'[]'); EXCEPTION WHEN serialization_failure THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Active revision purge accepted'; END IF;
 PERFORM public.construction_budget_trash(p,(rev->>'id')::uuid,'revision',false,1);
 PERFORM public.construction_budget_trash(p,(src->>'id')::uuid,'source',false);
 SELECT to_jsonb(s) INTO src FROM public.construction_budget_sources s WHERE id=(src->>'id')::uuid;
 denied:=false;
 BEGIN PERFORM public.construction_budget_purge_start(p,job,'[]',jsonb_build_array(src)); EXCEPTION WHEN raise_exception THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Referenced source purge accepted'; END IF;
 denied:=false;
 BEGIN PERFORM public.construction_budget_purge_start(p,job,jsonb_build_array(jsonb_build_object('id',rev->>'id','version',1)),jsonb_build_array(src)); EXCEPTION WHEN serialization_failure THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Stale revision purge accepted'; END IF;
 manifest:=public.construction_budget_purge_start(p,job,jsonb_build_array(jsonb_build_object('id',rev->>'id','version',2)),jsonb_build_array(src));
 IF manifest->>'revisionCount'<>'1' OR manifest->>'sourceCount'<>'1' THEN RAISE EXCEPTION 'Wrong manifest'; END IF;
 denied:=false;
 BEGIN PERFORM public.construction_budget_trash(p,(src->>'id')::uuid,'source',true); EXCEPTION WHEN raise_exception THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Source restored during purge'; END IF;
 denied:=false;
 BEGIN PERFORM public.construction_budget_trash(p,(rev->>'id')::uuid,'revision',true,2); EXCEPTION WHEN raise_exception THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Revision restored during purge'; END IF;
 IF public.construction_budget_purge_start(p,job,'[]','[]')->>'id'<>job::text THEN RAISE EXCEPTION 'Resume failed'; END IF;
 -- This synthetic source has no uploaded object, so finalization is safe.
 PERFORM public.construction_budget_purge_finish(p,job);
 PERFORM public.construction_budget_purge_finish(p,job);
 IF EXISTS(SELECT 1 FROM public.construction_budget_sources WHERE id=(src->>'id')::uuid) THEN RAISE EXCEPTION 'Source not purged'; END IF;
 IF EXISTS(SELECT 1 FROM public.construction_budget_history WHERE revision_id=(rev->>'id')::uuid) THEN RAISE EXCEPTION 'History not purged'; END IF;
 IF public.construction_budget_purge_start(p,job,'[]','[]')->>'completed'<>'true' THEN RAISE EXCEPTION 'Completed retry failed'; END IF;
 -- Metadata-only fixture: prove that finalization cannot bypass Storage API removal.
 src:=public.construction_budget_source(p,'purge-storage-guard.xlsx',repeat('c',64));
 INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('construction-budgets',src->>'storage_path',auth.uid()::text);
 PERFORM public.construction_budget_trash(p,(src->>'id')::uuid,'source',false);
 SELECT to_jsonb(s) INTO src FROM public.construction_budget_sources s WHERE id=(src->>'id')::uuid;
 job:=gen_random_uuid();
 PERFORM public.construction_budget_purge_start(p,job,'[]',jsonb_build_array(src));
 denied:=false;
 BEGIN PERFORM public.construction_budget_purge_finish(p,job); EXCEPTION WHEN raise_exception THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Storage object orphaned'; END IF;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 denied:=false;
 BEGIN PERFORM public.construction_budget_purge_finish(p,job); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Foreign purge accepted'; END IF;
END $$;
RESET ROLE;
SELECT 'purge guards, locking, storage prerequisite and retries passed' AS result;
