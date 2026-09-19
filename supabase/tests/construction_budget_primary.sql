-- Execute inside BEGIN / ROLLBACK; fixtures and preference changes are never committed.
CREATE TEMP TABLE budget_primary_context AS SELECT p.id AS project_id,p.owner_id
 FROM public.projects p JOIN public.organization_members m ON m.organization_id=p.organization_id AND m.user_id=p.owner_id AND m.is_active
 WHERE p.status<>'archived' AND NOT COALESCE(p.is_demo,false) LIMIT 1;
GRANT SELECT ON budget_primary_context TO authenticated;
SELECT set_config('request.jwt.claim.sub',(SELECT owner_id::text FROM budget_primary_context),true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE p text; src jsonb; first_rev jsonb; second_rev jsonb; doc jsonb; prior uuid; denied boolean;
BEGIN
 SELECT project_id INTO p FROM budget_primary_context;
 IF p IS NULL THEN RAISE EXCEPTION 'Missing test context'; END IF;
 src:=public.construction_budget_source(p,'synthetic-primary-test.xlsx',repeat('e',64),'attachment');
 doc:='{"schemaVersion":1,"sheets":[],"issues":[],"figures":{},"nodes":[]}'::jsonb;
 first_rev:=public.construction_budget_save(p,(src->>'id')::uuid,NULL,0,'Primary test',doc,'[]',false);
 second_rev:=public.construction_budget_save(p,(src->>'id')::uuid,NULL,0,'Copy test',doc,'[]',false);
 prior:=(public.construction_budget_load(p)->>'mainRevisionId')::uuid;
 PERFORM public.construction_budget_set_primary(p,(second_rev->>'id')::uuid,prior);
 prior:=(second_rev->>'id')::uuid;
 PERFORM public.construction_budget_set_primary(p,(first_rev->>'id')::uuid,prior);
 IF public.construction_budget_load(p)->>'mainRevisionId' IS DISTINCT FROM first_rev->>'id' THEN RAISE EXCEPTION 'Primary not stored'; END IF;
 denied:=false;
 BEGIN PERFORM public.construction_budget_set_primary(p,(second_rev->>'id')::uuid,prior); EXCEPTION WHEN serialization_failure THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Stale primary overwrite permitted'; END IF;
 denied:=false;
 BEGIN PERFORM public.construction_budget_set_primary('foreign-project',(first_rev->>'id')::uuid,NULL); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Foreign project allowed'; END IF;
 denied:=false;
 BEGIN PERFORM public.construction_budget_set_primary(p,gen_random_uuid(),(first_rev->>'id')::uuid); EXCEPTION WHEN raise_exception THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Foreign revision allowed'; END IF;
 PERFORM public.construction_budget_set_primary(p,(second_rev->>'id')::uuid,(first_rev->>'id')::uuid);
 IF public.construction_budget_load(p,(first_rev->>'id')::uuid)->>'version'<>'1' THEN RAISE EXCEPTION 'Document modified by preference'; END IF;
 PERFORM public.construction_budget_trash(p,(second_rev->>'id')::uuid,'revision',false,1);
 IF public.construction_budget_load(p)->>'mainRevisionId' IS NOT DISTINCT FROM second_rev->>'id' THEN RAISE EXCEPTION 'Trash retained as primary'; END IF;
 prior:=(public.construction_budget_load(p)->>'mainRevisionId')::uuid;
 PERFORM public.construction_budget_trash(p,(second_rev->>'id')::uuid,'revision',true,2);
 IF (public.construction_budget_load(p)->>'mainRevisionId')::uuid IS DISTINCT FROM prior THEN RAISE EXCEPTION 'Restored revision stole primary status'; END IF;
 PERFORM public.construction_budget_trash(p,(second_rev->>'id')::uuid,'revision',false,3);
 denied:=false;
 BEGIN PERFORM public.construction_budget_set_primary(p,(second_rev->>'id')::uuid,NULL); EXCEPTION WHEN raise_exception THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Trashed revision selected'; END IF;
 denied:=false;
 BEGIN UPDATE private.construction_budget_preferences SET revision_id=(first_rev->>'id')::uuid WHERE project_id=p; EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Direct preference write permitted'; END IF;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 denied:=false;
 BEGIN PERFORM public.construction_budget_set_primary(p,(first_rev->>'id')::uuid,NULL); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Foreign user allowed'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF has_function_privilege('anon','public.construction_budget_set_primary(text,uuid,uuid)','execute') THEN RAISE EXCEPTION 'Anonymous primary change permitted'; END IF;
END $$;
