-- Disposable local fixture, caller wraps BEGIN/ROLLBACK.
DO $$
DECLARE pid text:='budget-primary-fixture'; src jsonb; rev jsonb; doc jsonb; changed jsonb; audit jsonb; denied boolean;
BEGIN
 PERFORM set_config('request.jwt.claim.sub','82000000-0000-4000-8000-000000000001',true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 INSERT INTO public.demand_categories(id,project_id,title) VALUES('budget-delta-category',pid,'Delta fixture');
 src:=public.construction_budget_source(pid,'delta.xlsx',repeat('2',64),'attachment');
 SELECT jsonb_build_object('schemaVersion',1,'sheets','[]'::jsonb,'issues','[]'::jsonb,'figures','{}'::jsonb,'nodes',jsonb_agg(jsonb_build_object('id',i::text,'kind','K','quantity','10','unitPrice','2','total','20','description','Before'))) INTO doc FROM generate_series(1,1000) i;
 rev:=public.construction_budget_save(pid,(src->>'id')::uuid,NULL,0,'Delta',doc,'[{"itemId":"1","categoryId":"budget-delta-category","quantity":"1"}]',false);
 doc:=rev->'document';
 changed:=jsonb_set(doc,'{nodes,0,description}','"After"');
 rev:=public.construction_budget_save(pid,(src->>'id')::uuid,(rev->>'id')::uuid,1,'Delta',changed,'[{"itemId":"1","categoryId":"budget-delta-category","quantity":"1"},{"itemId":"1","categoryId":"budget-delta-category","quantity":"2"}]',false);
 SELECT to_jsonb(h) INTO audit FROM public.construction_budget_history h WHERE revision_id=(rev->>'id')::uuid ORDER BY id DESC LIMIT 1;
 IF audit->'previous_document'<>'null'::jsonb OR audit->'previous_allocations'<>'null'::jsonb THEN RAISE EXCEPTION 'Full document snapshot retained for tiny edit'; END IF;
 IF jsonb_array_length(audit#>'{changes,nodes,items}')<>1 OR audit#>>'{changes,nodes,items,0,value,description}'<>'Before'
   OR audit#>>'{changes,allocations,length}'<>'1' OR jsonb_array_length(audit#>'{changes,allocations,items}')<>0 THEN RAISE EXCEPTION 'Reverse change evidence incomplete'; END IF;
 IF pg_column_size(audit->'changes')>=pg_column_size(doc)/10 THEN RAISE EXCEPTION 'History delta is too large'; END IF;
 denied:=false;
 BEGIN DELETE FROM public.demand_categories WHERE id='budget-delta-category'; EXCEPTION WHEN raise_exception THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Category deletion accepted with live allocation'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.demand_categories WHERE id='budget-delta-category') THEN RAISE EXCEPTION 'Category was removed'; END IF;
END $$;
SELECT 'compact reversible history and referenced category deletion guard passed' AS result;
