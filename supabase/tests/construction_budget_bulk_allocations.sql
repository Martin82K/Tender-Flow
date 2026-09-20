-- Disposable local fixture only. Caller wraps in BEGIN/ROLLBACK.
SET LOCAL statement_timeout='8s';
SELECT set_config('request.jwt.claim.sub','82000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
INSERT INTO public.demand_categories(id,project_id,title) VALUES('budget-bulk-category','budget-primary-fixture','Synthetic allocation');
DO $$
DECLARE src jsonb; doc jsonb; allocations jsonb; started timestamptz;
BEGIN
 src:=public.construction_budget_source('budget-primary-fixture','bulk.xlsx',repeat('1',64),'attachment');
 SELECT jsonb_build_object('schemaVersion',1,'sheets','[]'::jsonb,'issues','[]'::jsonb,'figures','{}'::jsonb,'nodes',jsonb_agg(jsonb_build_object('id',i::text,'kind','K','quantity','10','unitPrice','2','total','20'))) INTO doc FROM generate_series(1,5000) i;
 SELECT jsonb_agg(jsonb_build_object('itemId',i::text,'categoryId','budget-bulk-category','quantity','4')) INTO allocations FROM generate_series(1,5000) i;
 started:=clock_timestamp();
 PERFORM public.construction_budget_save('budget-primary-fixture',(src->>'id')::uuid,NULL,0,'Bulk allocations',doc,allocations,false);
 RAISE NOTICE '5000 item allocations saved in % ms',extract(epoch FROM clock_timestamp()-started)*1000;
END $$;
