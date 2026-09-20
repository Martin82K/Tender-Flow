-- Caller must wrap in BEGIN/ROLLBACK; only synthetic budget records are written.
-- A statement timeout bounds the regression load; never disable it on production.
SET LOCAL statement_timeout = '8s';
CREATE TEMP TABLE budget_validation_context AS
 SELECT p.id AS project_id,p.owner_id FROM public.projects p
 JOIN public.organization_members m ON m.organization_id=p.organization_id AND m.user_id=p.owner_id AND m.is_active
 WHERE p.status<>'archived' AND NOT COALESCE(p.is_demo,false) LIMIT 1;
GRANT SELECT ON budget_validation_context TO authenticated;
SELECT set_config('request.jwt.claim.sub',(SELECT owner_id::text FROM budget_validation_context),true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE p text; src jsonb; doc jsonb; bad jsonb; rejected boolean; started timestamptz;
BEGIN
 SELECT project_id INTO p FROM budget_validation_context;
 IF p IS NULL THEN RAISE EXCEPTION 'No fixture owner available'; END IF;
 src := public.construction_budget_source(p,'validation-test.xlsx',repeat('c',64),'attachment');
 doc := '{"schemaVersion":1,"sheets":[],"issues":[],"figures":{},"nodes":[]}'::jsonb;
 FOR bad IN SELECT value FROM jsonb_array_elements('[
   [{"id":"a","kind":"sheet"},{"id":"a","kind":"sheet"}],
   [{"id":"a","kind":"sheet","parentId":"missing"}],
   [{"id":"a","kind":"sheet","parentId":"b"},{"id":"b","kind":"sheet"}],
   [{"id":"a","kind":"sheet","parentId":"a"}],
   [{"kind":"sheet"}],
   [{"id":"a","kind":"unknown"}],
   [{"id":"a"}]
 ]'::jsonb) LOOP
   rejected := false;
   BEGIN PERFORM public.construction_budget_save(p,(src->>'id')::uuid,NULL,0,'Invalid hierarchy',jsonb_set(doc,'{nodes}',bad),'[]',false);
   EXCEPTION WHEN raise_exception THEN
     IF SQLERRM<>'Invalid hierarchy' THEN RAISE; END IF;
     rejected := true;
   END;
   IF NOT rejected THEN RAISE EXCEPTION 'Invalid hierarchy accepted: %',bad; END IF;
 END LOOP;
 -- 100,000 valid nodes distinguish the old quadratic scan from set-based validation.
 SELECT jsonb_set(doc,'{nodes}',jsonb_agg(jsonb_build_object(
   'id',i::text,'kind','note','parentId',CASE WHEN i=1 THEN NULL ELSE '1' END,
   'description','Synthetic validation row','tags','[]'::jsonb
 ) ORDER BY i)) INTO doc FROM generate_series(1,100000) i;
 started := clock_timestamp();
 PERFORM public.construction_budget_save(p,(src->>'id')::uuid,NULL,0,'Large synthetic validation',doc,'[]',false);
 PERFORM set_config('budget.validation_ms',(extract(epoch FROM clock_timestamp()-started)*1000)::text,true);
END $$;
RESET ROLE;
SELECT 'hierarchy guards and bounded large document validation passed' AS result, current_setting('budget.validation_ms') AS milliseconds;
