-- Isolated fixture only, wrapped by caller in BEGIN/ROLLBACK.
DO $$
DECLARE src jsonb; doc jsonb:='{"schemaVersion":1,"sheets":[],"issues":[],"figures":{},"nodes":[]}'; bad jsonb; denied boolean; key text;
BEGIN
 PERFORM set_config('request.jwt.claim.sub','82000000-0000-4000-8000-000000000001',true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 src:=public.construction_budget_source('budget-primary-fixture','shape.xlsx',repeat('f',64),'attachment');
 FOREACH key IN ARRAY ARRAY['sheets','issues','figures'] LOOP
   denied:=false;
   BEGIN PERFORM public.construction_budget_save('budget-primary-fixture',(src->>'id')::uuid,NULL,0,'Invalid',doc-key,'[]',false);
   EXCEPTION WHEN raise_exception THEN denied:=true; END;
   IF NOT denied THEN RAISE EXCEPTION 'Missing collection accepted: %',key; END IF;
 END LOOP;
 FOR bad IN SELECT value FROM jsonb_array_elements('[{"tags":null},{"tags":{}},{"tags":[3]},{"tenders":null},{"source":null},{"source":{"sheet":"x","cells":null}},{"description":null},{"source":{"sheet":"x","cells":{},"row":{}}},{"source":{"sheet":"x","cells":{},"row":"2"}},{"source":{"sheet":"x","cells":{},"row":1.5}},{"source":{"sheet":"x","cells":{},"row":-1}},{"source":{"sheet":"x","cells":{}}}]') LOOP
   denied:=false;
   BEGIN PERFORM public.construction_budget_save('budget-primary-fixture',(src->>'id')::uuid,NULL,0,'Invalid',jsonb_set(doc,'{nodes}',jsonb_build_array('{"id":"n","kind":"note"}'::jsonb||bad)),'[]',false);
   EXCEPTION WHEN raise_exception THEN denied:=true; END;
   IF NOT denied THEN RAISE EXCEPTION 'Malformed node accepted: %',bad; END IF;
 END LOOP;
END $$;
SELECT 'mandatory document collections and malformed node guards passed' AS result;
