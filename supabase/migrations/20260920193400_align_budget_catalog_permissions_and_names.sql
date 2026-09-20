BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';
CREATE OR REPLACE FUNCTION private.validate_tender_definitions(definitions jsonb,limit_input integer) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE entry jsonb;
BEGIN
 IF definitions IS NULL OR jsonb_typeof(definitions)<>'array' OR limit_input IS NULL OR limit_input<1 OR jsonb_array_length(definitions)>limit_input THEN RAISE EXCEPTION 'Číselník smí mít nejvýše % VŘ.',limit_input; END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(definitions) LOOP
   IF jsonb_typeof(entry)<>'object' OR jsonb_typeof(entry->'id') IS DISTINCT FROM 'string'
    OR length(entry->>'id') NOT BETWEEN 1 AND 100 OR jsonb_typeof(entry->'title') IS DISTINCT FROM 'string'
    OR length(btrim(regexp_replace(entry->>'title','\s+',' ','g'))) NOT BETWEEN 1 AND 255 OR jsonb_typeof(entry->'externalCode') IS DISTINCT FROM 'string'
    OR length(entry->>'externalCode')>100 THEN RAISE EXCEPTION 'Vyplňte platné číslo a název VŘ.'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(definitions) e GROUP BY lower(btrim(regexp_replace(e->>'title','\s+',' ','g'))) HAVING count(*)>1)
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(definitions) e WHERE btrim(e->>'externalCode')<>'' GROUP BY btrim(e->>'externalCode') HAVING count(*)>1)
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(definitions) e GROUP BY e->>'id' HAVING count(*)>1)
 THEN RAISE EXCEPTION 'Duplicitní název nebo číslo VŘ.'; END IF;
END $$;
CREATE OR REPLACE FUNCTION private.budget_load(project_input text,revision_input uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 result:=private.budget_load_before_edit_lock(project_input,revision_input);
 IF revision_input IS NULL THEN
   result:=jsonb_set(result,'{permissions}',COALESCE(result->'permissions','{}'::jsonb)||jsonb_build_object('editTenders',COALESCE(public.can_project_module_action(project_input,'module_pipeline',true),false)),true);
   result:=result||jsonb_build_object('locked',COALESCE((SELECT locked FROM private.budget_edit_locks WHERE project_id=project_input),false),
    'lockVersion',COALESCE((SELECT version FROM private.budget_edit_locks WHERE project_id=project_input),0));
 END IF;
 RETURN result;
END $$;

COMMIT;
