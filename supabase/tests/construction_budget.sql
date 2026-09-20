-- Run in a transaction and always roll back. No customer budget data is read or changed.
-- Select an existing active owner context solely for authorization fixture IDs.
CREATE TEMP TABLE budget_test_context AS SELECT p.id AS project_id,p.owner_id,p.organization_id
FROM public.projects p JOIN public.organization_members m ON m.organization_id=p.organization_id AND m.user_id=p.owner_id AND m.is_active
WHERE p.status<>'archived' AND NOT COALESCE(p.is_demo,false) LIMIT 1;
GRANT SELECT ON budget_test_context TO authenticated;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM budget_test_context) THEN RAISE EXCEPTION 'No owner fixture available'; END IF; END $$;
SELECT set_config('request.jwt.claim.sub',(SELECT owner_id::text FROM budget_test_context),true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE p text; src jsonb; rev jsonb; doc jsonb; denied boolean;
BEGIN
 SELECT project_id INTO p FROM budget_test_context;
 IF NOT private.budget_access(p,'edit') THEN RAISE EXCEPTION 'Owner fixture lacks licensed access'; END IF;
 src:=public.construction_budget_source(p,'synthetic-test.xlsx',repeat('a',64),'attachment');
 doc:='{"schemaVersion":1,"sheets":[],"issues":[],"figures":{},"nodes":[{"id":"s","parentId":null,"sheetId":"s","kind":"sheet","description":"Test","tags":[]},{"id":"i","parentId":"s","sheetId":"s","kind":"K","description":"Synthetic","code":"001","quantity":"2","unitPrice":"25","total":"50.00","tags":[],"source":{"sheet":"S","row":2,"cells":{}}}]}'::jsonb;
 rev:=public.construction_budget_save(p,(src->>'id')::uuid,NULL,0,'Synthetic test',doc,'[]',false);
 IF rev->>'version'<>'1' THEN RAISE EXCEPTION 'Create failed'; END IF;
 IF public.construction_budget_load(p,(rev->>'id')::uuid)#>>'{document,nodes,1,total}'<>'50.00' THEN RAISE EXCEPTION 'Read failed'; END IF;
 denied:=false;
 BEGIN PERFORM public.construction_budget_save(p,(src->>'id')::uuid,(rev->>'id')::uuid,0,'Stale',doc,'[]',false); EXCEPTION WHEN serialization_failure THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Stale overwrite accepted'; END IF;
 denied:=false;
 BEGIN PERFORM public.construction_budget_save(p,(src->>'id')::uuid,(rev->>'id')::uuid,1,'Foreign allocation',doc,'[{"itemId":"i","categoryId":"foreign-category","quantity":"1"}]',false); EXCEPTION WHEN raise_exception THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Foreign allocation accepted'; END IF;
 denied:=false;
 BEGIN UPDATE public.construction_budget_revisions SET title='direct bypass'; EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Direct writes permitted'; END IF;
 rev:=public.construction_budget_save(p,(src->>'id')::uuid,(rev->>'id')::uuid,1,'Confirmed',doc,'[]',true);
 denied:=false;
 BEGIN PERFORM public.construction_budget_save(p,(src->>'id')::uuid,(rev->>'id')::uuid,2,'Overwrite confirmed',doc,'[]',false); EXCEPTION WHEN serialization_failure THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Confirmed revision changed'; END IF;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 IF EXISTS(SELECT 1 FROM public.construction_budget_sources WHERE id=(src->>'id')::uuid) THEN RAISE EXCEPTION 'Cross-tenant source read'; END IF;
 denied:=false;
 BEGIN PERFORM public.construction_budget_load(p,(rev->>'id')::uuid); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Cross-tenant revision read'; END IF;
END $$;
RESET ROLE;
SELECT 'construction budget authorization and revision tests passed' AS result;
