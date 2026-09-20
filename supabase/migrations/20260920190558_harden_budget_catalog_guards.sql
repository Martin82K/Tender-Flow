BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';

-- Protect tender identity through every existing pipeline mutation, not only new RPCs.
-- Status/offer lifecycle changes do not alter the locked budget catalog.
CREATE FUNCTION private.budget_tender_identity_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.id,NEW.project_id,NEW.title,NEW.external_code)
    IS NOT DISTINCT FROM (OLD.id,OLD.project_id,OLD.title,OLD.external_code) THEN RETURN NEW; END IF;
 PERFORM private.budget_assert_unlocked(CASE WHEN TG_OP='DELETE' THEN OLD.project_id ELSE NEW.project_id END);
 IF TG_OP='UPDATE' AND OLD.project_id IS DISTINCT FROM NEW.project_id THEN PERFORM private.budget_assert_unlocked(OLD.project_id); END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.budget_tender_identity_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER budget_tender_identity_lock BEFORE INSERT OR UPDATE OR DELETE ON public.demand_categories
 FOR EACH ROW EXECUTE FUNCTION private.budget_tender_identity_guard();

-- Keep personal defaults bounded to 500 while supporting existing larger projects.
CREATE FUNCTION private.validate_tender_definitions(definitions jsonb,limit_input integer) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE entry jsonb;
BEGIN
 IF definitions IS NULL OR jsonb_typeof(definitions)<>'array' OR limit_input IS NULL OR limit_input<1 OR jsonb_array_length(definitions)>limit_input THEN RAISE EXCEPTION 'Číselník smí mít nejvýše % VŘ.',limit_input; END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(definitions) LOOP
   IF jsonb_typeof(entry)<>'object' OR jsonb_typeof(entry->'id') IS DISTINCT FROM 'string'
    OR length(entry->>'id') NOT BETWEEN 1 AND 100 OR jsonb_typeof(entry->'title') IS DISTINCT FROM 'string'
    OR length(btrim(entry->>'title')) NOT BETWEEN 1 AND 255 OR jsonb_typeof(entry->'externalCode') IS DISTINCT FROM 'string'
    OR length(entry->>'externalCode')>100 THEN RAISE EXCEPTION 'Vyplňte platné číslo a název VŘ.'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(definitions) e GROUP BY lower(btrim(e->>'title')) HAVING count(*)>1)
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(definitions) e WHERE btrim(e->>'externalCode')<>'' GROUP BY btrim(e->>'externalCode') HAVING count(*)>1)
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(definitions) e GROUP BY e->>'id' HAVING count(*)>1)
 THEN RAISE EXCEPTION 'Duplicitní název nebo číslo VŘ.'; END IF;
END $$;
REVOKE ALL ON FUNCTION private.validate_tender_definitions(jsonb,integer) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION private.validate_tender_definitions(definitions jsonb) RETURNS void
LANGUAGE sql SET search_path='' AS $$ SELECT private.validate_tender_definitions(definitions,500) $$;
CREATE OR REPLACE FUNCTION private.save_project_tender_catalog(project_input text,expected_input jsonb,definitions_input jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE catalog jsonb; entry jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('budget-categories:'||project_input,0));
 PERFORM 1 FROM public.projects WHERE id=project_input FOR UPDATE;
 IF NOT FOUND OR NOT private.budget_access(project_input,'read') OR NOT public.can_project_module_action(project_input,'module_pipeline',true)
 THEN RAISE EXCEPTION 'Úprava VŘ není povolena.' USING ERRCODE='42501'; END IF;
 PERFORM private.budget_assert_unlocked(project_input);
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'title',title,'externalCode',COALESCE(external_code,'')) ORDER BY id),'[]') INTO catalog FROM public.demand_categories WHERE project_id=project_input;
 PERFORM private.validate_tender_definitions(definitions_input,GREATEST(1000,jsonb_array_length(catalog)));
 IF catalog IS DISTINCT FROM expected_input THEN RAISE EXCEPTION 'Seznam VŘ se mezitím změnil. Načtěte jej znovu.' USING ERRCODE='40001'; END IF;
 IF EXISTS(SELECT 1 FROM public.demand_categories c WHERE c.project_id=project_input AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(definitions_input) d WHERE d->>'id'=c.id))
 THEN RAISE EXCEPTION 'Existující projektové VŘ nelze odstranit z číselníku.'; END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(definitions_input) LOOP
   IF EXISTS(SELECT 1 FROM public.demand_categories WHERE id=entry->>'id' AND project_id<>project_input) THEN RAISE EXCEPTION 'Cizí VŘ' USING ERRCODE='42501'; END IF;
   INSERT INTO public.demand_categories(id,project_id,title,external_code,status,description,budget_display,sod_budget,plan_budget)
   VALUES(entry->>'id',project_input,btrim(entry->>'title'),NULLIF(btrim(entry->>'externalCode'),''),'open','','',0,0)
   ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,external_code=EXCLUDED.external_code WHERE demand_categories.project_id=project_input;
 END LOOP;
END $$;

COMMIT;
